import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { renderHtmlDocument } from "./html/document";
import { basicAuthMiddleware } from "./services/auth";
import type {
  AppEnv,
  ConfigReadResult,
  ConfigSaveResult,
  EnvReadResult,
  GatewayStatus,
  LogTail,
  ModelProvidersMutationResponse,
  ModelYamlPatch,
  WorkspaceConfigHints,
} from "./types";

export type AppGateway = {
  status: () => GatewayStatus;
  start: () => Promise<GatewayStatus>;
  stop: () => Promise<GatewayStatus>;
  restart: () => Promise<GatewayStatus>;
  refreshHealth: () => Promise<GatewayStatus>;
};

export type AppLogs = {
  tail: (limit: number) => Promise<LogTail>;
  subscribe: (listener: (line: string) => void) => () => void;
};

export type AppConfig = {
  read: () => Promise<ConfigReadResult>;
  save: (content: string) => Promise<ConfigSaveResult>;
  patchModel: (updates: ModelYamlPatch) => Promise<ConfigSaveResult>;
  getWorkspaceConfigHints: () => Promise<WorkspaceConfigHints>;
  patchDiscordAllowedUsers: (allowed_users: string) => Promise<ConfigSaveResult>;
};

export type AppServices = {
  env: AppEnv;
  gateway: AppGateway;
  logs: AppLogs;
  config: AppConfig;
  envVars: {
    read: () => Promise<EnvReadResult>;
    upsert: (key: string, value: string) => Promise<EnvReadResult>;
    remove: (key: string) => Promise<EnvReadResult>;
    applyBatch: (input: {
      set?: Record<string, string>;
      remove?: string[];
    }) => Promise<EnvReadResult>;
  };
};

export function createApp(services: AppServices) {
  const app = new Hono();
  app.use("*", basicAuthMiddleware(services.env.adminUsername, services.env.adminPassword));

  return app
    .get("/assets/*", serveStatic({ root: "./dist" }))
    .get("/favicon.ico", (context) => context.body(null, 204))
    .get("/", (context) => {
      return context.html(
        renderHtmlDocument(
          "Hermes Agent",
          encodeURIComponent(JSON.stringify(services.gateway.status())),
        ),
      );
    })
    .get("/gateway/status", (context) => context.json(services.gateway.status()))
    .get("/gateway/health", async (context) => context.json(await services.gateway.refreshHealth()))
    .post("/gateway/start", async (context) =>
      context.json(await runGatewayAction(services.gateway, () => services.gateway.start())),
    )
    .post("/gateway/stop", async (context) =>
      context.json(await runGatewayAction(services.gateway, () => services.gateway.stop())),
    )
    .post("/gateway/restart", async (context) =>
      context.json(await runGatewayAction(services.gateway, () => services.gateway.restart())),
    )
    .get("/config", async (context) => {
      try {
        return context.json(await services.config.read());
      } catch (cause: unknown) {
        return context.json({ error: `Failed to read config: ${getErrorMessage(cause)}` }, 500);
      }
    })
    .post("/config", async (context) => {
      const content = await parseConfigContent(context.req.json());

      if (content === null) {
        return context.json({ error: "Config content must be a string." }, 400);
      }

      const wasRunning = services.gateway.status().state === "running";
      const config = await saveConfig(services.config, content);

      if (!config.ok) {
        return context.json({ error: `Failed to save config: ${config.error}` }, 500);
      }

      if (!config.value.saved) {
        return context.json(
          {
            config: config.value,
            restart: { attempted: false, ok: true, error: null },
            gateway: services.gateway.status(),
          },
          422,
        );
      }

      if (!wasRunning) {
        return context.json({
          config: config.value,
          restart: { attempted: false, ok: true, error: null },
          gateway: services.gateway.status(),
        });
      }

      try {
        const gateway = await services.gateway.restart();

        return context.json({
          config: config.value,
          restart: { attempted: true, ok: true, error: null },
          gateway,
        });
      } catch (cause: unknown) {
        return context.json({
          config: config.value,
          restart: {
            attempted: true,
            ok: false,
            error: getErrorMessage(cause),
          },
          gateway: services.gateway.status(),
        });
      }
    })
    .get("/env", async (context) => {
      try {
        return context.json(await services.envVars.read());
      } catch (cause: unknown) {
        return context.json({ error: `Failed to read env: ${getErrorMessage(cause)}` }, 500);
      }
    })
    .post("/env", async (context) => {
      const input = await parseEnvUpsertInput(context.req.json());
      if (input === null) {
        return context.json({ error: "Body must include string key and value." }, 400);
      }

      const envResult = await mutateEnv(() => services.envVars.upsert(input.key, input.value));
      if (!envResult.ok) {
        return context.json({ error: `Failed to update env: ${envResult.error}` }, 500);
      }

      return context.json(await withGatewayRestart(services.gateway, envResult.value));
    })
    .post("/env/batch", async (context) => {
      const input = await parseEnvBatchInput(context.req.json());
      if (input === null) {
        return context.json(
          {
            error:
              "Body must include set (object of string values) and/or remove (string[]), with at least one non-empty set value or remove key.",
          },
          400,
        );
      }

      const envResult = await mutateEnv(() => services.envVars.applyBatch(input));
      if (!envResult.ok) {
        return context.json({ error: `Failed to update env: ${envResult.error}` }, 500);
      }

      return context.json(await withGatewayRestart(services.gateway, envResult.value));
    })
    .get("/settings/workspace-hints", async (context) => {
      try {
        return context.json(await services.config.getWorkspaceConfigHints());
      } catch (cause: unknown) {
        return context.json({ error: `Failed to read config hints: ${getErrorMessage(cause)}` }, 500);
      }
    })
    .post("/settings/model-providers", async (context) => {
      const input = await parseModelProvidersInput(context.req.json());
      if (input === null) {
        return context.json(
          {
            error:
              "Body must include a model patch, discord.allowed_users update, and/or env set/remove with at least one mutation.",
          },
          400,
        );
      }

      let configResult: ConfigSaveResult;
      try {
        const baseline = await services.config.read();
        configResult = { ...baseline, saved: false };

        if (input.model !== undefined && Object.keys(input.model).length > 0) {
          const patched = await saveConfigPatch(services.config, input.model);
          if (!patched.ok) {
            return context.json({ error: `Failed to patch config: ${patched.error}` }, 500);
          }
          configResult = patched.value;
          if (!configResult.saved) {
            return context.json(
              {
                config: configResult,
                error: "Config validation failed; env was not modified.",
              },
              422,
            );
          }
        }

        if (input.discord !== undefined) {
          const patched = await saveDiscordPatch(services.config, input.discord.allowed_users);
          if (!patched.ok) {
            return context.json({ error: `Failed to patch config: ${patched.error}` }, 500);
          }
          configResult = patched.value;
          if (!configResult.saved) {
            return context.json(
              {
                config: configResult,
                error: "Config validation failed; env was not modified.",
              },
              422,
            );
          }
        }
      } catch (cause: unknown) {
        return context.json({ error: `Failed to read or patch config: ${getErrorMessage(cause)}` }, 500);
      }

      let envSnapshot: EnvReadResult;
      const envMutation = input.env;
      if (envMutation !== undefined) {
        const envResult = await mutateEnv(() => services.envVars.applyBatch(envMutation));
        if (!envResult.ok) {
          return context.json({ error: `Failed to update env: ${envResult.error}` }, 500);
        }
        envSnapshot = envResult.value;
      } else {
        try {
          envSnapshot = await services.envVars.read();
        } catch (cause: unknown) {
          return context.json({ error: `Failed to read env: ${getErrorMessage(cause)}` }, 500);
        }
      }

      const wasRunning = services.gateway.status().state === "running";
      let restart: ModelProvidersMutationResponse["restart"];
      let gateway: GatewayStatus;
      if (!wasRunning) {
        restart = { attempted: false, ok: true, error: null };
        gateway = services.gateway.status();
      } else {
        try {
          gateway = await services.gateway.restart();
          restart = { attempted: true, ok: true, error: null };
        } catch (cause: unknown) {
          restart = {
            attempted: true,
            ok: false,
            error: getErrorMessage(cause),
          };
          gateway = services.gateway.status();
        }
      }

      const payload: ModelProvidersMutationResponse = {
        env: envSnapshot,
        config: configResult,
        restart,
        gateway,
      };
      return context.json(payload);
    })
    .delete("/env/:key", async (context) => {
      const key = context.req.param("key");
      const envResult = await mutateEnv(() => services.envVars.remove(key));
      if (!envResult.ok) {
        return context.json({ error: `Failed to delete env: ${envResult.error}` }, 500);
      }

      return context.json(await withGatewayRestart(services.gateway, envResult.value));
    })
    .get("/logs/tail", async (context) => context.json(await services.logs.tail(200)))
    .get("/logs/stream", (context) => {
      const { readable, writable } = new TransformStream<Uint8Array>();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const unsubscribe = services.logs.subscribe((line) => {
        void writer.write(encoder.encode(`data: ${JSON.stringify({ line })}\n\n`));
      });

      context.req.raw.signal.addEventListener("abort", () => {
        unsubscribe();
        void writer.close();
      });

      return new Response(readable, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        },
      });
    });
}

export type AppType = ReturnType<typeof createApp>;

async function runGatewayAction(
  gateway: AppGateway,
  action: () => Promise<GatewayStatus>,
): Promise<GatewayStatus> {
  try {
    return await action();
  } catch {
    return gateway.status();
  }
}

async function parseConfigContent(bodyPromise: Promise<unknown>): Promise<string | null> {
  try {
    const body = await bodyPromise;

    if (!isRecord(body) || typeof body.content !== "string") {
      return null;
    }

    return body.content;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function saveConfig(
  config: AppConfig,
  content: string,
): Promise<{ ok: true; value: ConfigSaveResult } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await config.save(content) };
  } catch (cause: unknown) {
    return { ok: false, error: getErrorMessage(cause) };
  }
}

async function saveConfigPatch(
  config: AppConfig,
  updates: ModelYamlPatch,
): Promise<{ ok: true; value: ConfigSaveResult } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await config.patchModel(updates) };
  } catch (cause: unknown) {
    return { ok: false, error: getErrorMessage(cause) };
  }
}

async function saveDiscordPatch(
  config: AppConfig,
  allowed_users: string,
): Promise<{ ok: true; value: ConfigSaveResult } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await config.patchDiscordAllowedUsers(allowed_users) };
  } catch (cause: unknown) {
    return { ok: false, error: getErrorMessage(cause) };
  }
}

async function parseEnvUpsertInput(
  bodyPromise: Promise<unknown>,
): Promise<{ key: string; value: string } | null> {
  try {
    const body = await bodyPromise;
    if (!isRecord(body) || typeof body.key !== "string" || typeof body.value !== "string") {
      return null;
    }
    return {
      key: body.key,
      value: body.value,
    };
  } catch {
    return null;
  }
}

function parseEnvBatchRecord(body: unknown): { set?: Record<string, string>; remove?: string[] } | null {
  if (!isRecord(body)) {
    return null;
  }

  let set: Record<string, string> | undefined;
  if (body.set !== undefined) {
    if (!isRecord(body.set)) {
      return null;
    }
    set = {};
    for (const [key, value] of Object.entries(body.set)) {
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        set[key] = trimmed;
      }
    }
    if (Object.keys(set).length === 0) {
      set = undefined;
    }
  }

  let remove: string[] | undefined;
  if (body.remove !== undefined) {
    if (!Array.isArray(body.remove)) {
      return null;
    }
    if (!body.remove.every((item): item is string => typeof item === "string")) {
      return null;
    }
    remove = [...new Set(body.remove)];
  }

  if (
    (set === undefined || Object.keys(set).length === 0) &&
    (remove === undefined || remove.length === 0)
  ) {
    return null;
  }

  const result: { set?: Record<string, string>; remove?: string[] } = {};
  if (set !== undefined && Object.keys(set).length > 0) {
    result.set = set;
  }
  if (remove !== undefined && remove.length > 0) {
    result.remove = remove;
  }
  return result;
}

async function parseEnvBatchInput(
  bodyPromise: Promise<unknown>,
): Promise<{ set?: Record<string, string>; remove?: string[] } | null> {
  try {
    const body = await bodyPromise;
    return parseEnvBatchRecord(body);
  } catch {
    return null;
  }
}

function hasEnvBatchMutation(env: { set?: Record<string, string>; remove?: string[] }): boolean {
  const hasSet = env.set !== undefined && Object.keys(env.set).length > 0;
  const hasRemove = env.remove !== undefined && env.remove.length > 0;
  return hasSet || hasRemove;
}

async function parseModelProvidersInput(
  bodyPromise: Promise<unknown>,
): Promise<{
  model?: ModelYamlPatch;
  env?: { set?: Record<string, string>; remove?: string[] };
  discord?: { allowed_users: string };
} | null> {
  try {
    const body = await bodyPromise;
    if (!isRecord(body)) {
      return null;
    }

    let model: ModelYamlPatch | undefined;
    if (body.model !== undefined) {
      if (!isRecord(body.model)) {
        return null;
      }
      const out: ModelYamlPatch = {};
      for (const key of ["default", "provider", "base_url"] as const) {
        const value = body.model[key];
        if (typeof value === "string" && value.trim().length > 0) {
          out[key] = value.trim();
        }
      }
      if (Object.keys(out).length > 0) {
        model = out;
      }
    }

    let env: { set?: Record<string, string>; remove?: string[] } | undefined;
    if (body.env !== undefined) {
      const parsed = parseEnvBatchRecord(body.env);
      if (parsed === null) {
        return null;
      }
      if (hasEnvBatchMutation(parsed)) {
        env = parsed;
      }
    }

    let discord: { allowed_users: string } | undefined;
    if (body.discord !== undefined) {
      if (!isRecord(body.discord) || typeof body.discord.allowed_users !== "string") {
        return null;
      }
      discord = { allowed_users: body.discord.allowed_users };
    }

    const hasModel = model !== undefined && Object.keys(model).length > 0;
    const hasDiscord = discord !== undefined;
    if (!hasModel && env === undefined && !hasDiscord) {
      return null;
    }

    const result: {
      model?: ModelYamlPatch;
      env?: { set?: Record<string, string>; remove?: string[] };
      discord?: { allowed_users: string };
    } = {};
    if (model !== undefined) {
      result.model = model;
    }
    if (env !== undefined) {
      result.env = env;
    }
    if (discord !== undefined) {
      result.discord = discord;
    }
    return result;
  } catch {
    return null;
  }
}

async function mutateEnv(
  action: () => Promise<EnvReadResult>,
): Promise<{ ok: true; value: EnvReadResult } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await action() };
  } catch (cause: unknown) {
    return { ok: false, error: getErrorMessage(cause) };
  }
}

async function withGatewayRestart(
  gateway: AppGateway,
  env: EnvReadResult,
): Promise<{
  env: EnvReadResult;
  restart: { attempted: boolean; ok: boolean; error: string | null };
  gateway: GatewayStatus;
}> {
  try {
    const status = await gateway.restart();
    return {
      env,
      restart: { attempted: true, ok: true, error: null },
      gateway: status,
    };
  } catch (cause: unknown) {
    return {
      env,
      restart: {
        attempted: true,
        ok: false,
        error: getErrorMessage(cause),
      },
      gateway: gateway.status(),
    };
  }
}

function getErrorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause);
}
