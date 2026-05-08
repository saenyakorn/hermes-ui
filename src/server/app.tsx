import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { renderHtmlDocument } from "./html/document";
import { basicAuthMiddleware } from "./services/auth";
import { isValidProfileName } from "./services/paths";
import type {
  AppEnv,
  ConfigReadResult,
  ConfigSaveResult,
  DiscordSettingsPatch,
  EnvReadResult,
  GatewayProfileSummary,
  GatewayStatus,
  GatewaysSummary,
  LogTail,
  ModelProvidersMutationResponse,
  ModelYamlPatch,
  ProfileCreateInput,
  ProfileCreateMode,
  ProfileFileKind,
  ProfileFileReadResult,
  ProfileFileWriteResult,
  ProfileListResult,
  ProfileMutationResult,
  ProfileSessionCreateInput,
  ProfileSessionDeleteResult,
  ProfileSessionGetResult,
  ProfileSessionListResult,
  ProfileSessionRenameInput,
  WorkspaceConfigHints,
} from "./types";

export type AppGateway = {
  status: () => GatewayStatus;
  start: () => Promise<GatewayStatus>;
  stop: () => Promise<GatewayStatus>;
  restart: () => Promise<GatewayStatus>;
  refreshHealth: () => Promise<GatewayStatus>;
};

export type AppGateways = {
  /** Returns (constructing on first access) the gateway facade for a profile. */
  get: (profile: string | null) => AppGateway;
  /**
   * Summary used by the top-bar status chip; when `additionalProfiles` is
   * provided the registry expands the list to include profiles discovered on
   * disk that haven't been touched yet.
   */
  list: (additionalProfiles?: ReadonlyArray<string | null>) => Promise<GatewaysSummary>;
};

export type AppLogs = {
  tail: (profile: string | null, limit: number) => Promise<LogTail>;
  subscribe: (profile: string | null, listener: (line: string) => void) => () => void;
};

export type AppConfig = {
  read: (profile: string | null) => Promise<ConfigReadResult>;
  save: (profile: string | null, content: string) => Promise<ConfigSaveResult>;
  patchModel: (profile: string | null, updates: ModelYamlPatch) => Promise<ConfigSaveResult>;
  getWorkspaceConfigHints: (profile: string | null) => Promise<WorkspaceConfigHints>;
  patchDiscordSettings: (
    profile: string | null,
    updates: DiscordSettingsPatch,
  ) => Promise<ConfigSaveResult>;
};

export type AppProfiles = {
  list: () => Promise<ProfileListResult>;
  listProfileNames: () => Promise<Array<string | null>>;
  create: (input: ProfileCreateInput) => Promise<ProfileMutationResult>;
  rename: (from: string, to: string) => Promise<ProfileMutationResult>;
  remove: (name: string) => Promise<ProfileMutationResult>;
};

export type AppProfileFiles = {
  read: (profile: string | null, kind: ProfileFileKind) => Promise<ProfileFileReadResult>;
  write: (
    profile: string | null,
    kind: ProfileFileKind,
    content: string,
  ) => Promise<ProfileFileWriteResult>;
};

export type AppProfileSessions = {
  list: (profile: string | null) => Promise<ProfileSessionListResult>;
  get: (profile: string | null, id: string) => Promise<ProfileSessionGetResult>;
  create: (
    profile: string | null,
    input: ProfileSessionCreateInput,
  ) => Promise<ProfileSessionGetResult>;
  rename: (
    profile: string | null,
    id: string,
    input: ProfileSessionRenameInput,
  ) => Promise<ProfileSessionGetResult>;
  archive: (profile: string | null, id: string) => Promise<ProfileSessionGetResult>;
  restore: (profile: string | null, id: string) => Promise<ProfileSessionGetResult>;
  remove: (profile: string | null, id: string) => Promise<ProfileSessionDeleteResult>;
};

export type AppProfileResolver = {
  readLegacyActiveProfile: () => Promise<string | null>;
};

export type AppEnvStore = {
  read: (profile: string | null) => Promise<EnvReadResult>;
  upsert: (profile: string | null, key: string, value: string) => Promise<EnvReadResult>;
  remove: (profile: string | null, key: string) => Promise<EnvReadResult>;
  applyBatch: (
    profile: string | null,
    input: { set?: Record<string, string>; remove?: string[] },
  ) => Promise<EnvReadResult>;
};

export type AppServices = {
  env: AppEnv;
  gateways: AppGateways;
  logsRegistry: {
    get: (profile: string | null) => {
      tail: (limit: number) => Promise<LogTail>;
      subscribe: (listener: (line: string) => void) => () => void;
    };
  };
  config: AppConfig;
  envVars: AppEnvStore;
  profiles: AppProfiles;
  profileFiles: AppProfileFiles;
  profileSessions: AppProfileSessions;
  profileResolver: AppProfileResolver;
};

/** Reads a `:name` profile path param. Returns `null` for "default", a slug
 * for valid profile names, or `undefined` to signal a 400 to the caller. */
function parseProfileParam(value: string): string | null | undefined {
  if (value === "default") {
    return null;
  }
  if (!isValidProfileName(value)) {
    return undefined;
  }
  return value;
}

export function createApp(services: AppServices) {
  const app = new Hono();
  const basicAuth = basicAuthMiddleware(services.env.adminUsername, services.env.adminPassword);
  app.use("*", async (context, next) => {
    if (context.req.path === "/gateways/health") {
      await next();
      return;
    }

    return basicAuth(context, next);
  });

  return app
    .get("/assets/*", serveStatic({ root: "./dist" }))
    .get("/favicon.ico", (context) => context.body(null, 204))
    .get("/", async (context) => {
      const authHeader = context.req.header("authorization");
      const authToken = authHeader?.startsWith("Basic ") ? authHeader : undefined;
      const additionalProfiles = await safeListProfileNames(services);
      const summary = await services.gateways.list(additionalProfiles);
      const legacyActive = await services.profileResolver.readLegacyActiveProfile();
      return context.html(
        renderHtmlDocument(
          "Hermes Agent",
          encodeURIComponent(JSON.stringify({ ...summary, legacyActive })),
          authToken ? encodeURIComponent(authToken) : undefined,
        ),
      );
    })
    .get("/gateways", async (context) => {
      const additionalProfiles = await safeListProfileNames(services);
      return context.json(await services.gateways.list(additionalProfiles));
    })
    .get("/gateways/health", async (context) => {
      // Public liveness for the control plane itself.
      const additionalProfiles = await safeListProfileNames(services);
      return context.json(await services.gateways.list(additionalProfiles));
    })
    .get("/profiles/:name/gateway/status", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      return context.json(await services.gateways.get(profile).refreshHealth());
    })
    .get("/profiles/:name/gateway/health", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      return context.json(await services.gateways.get(profile).refreshHealth());
    })
    .post("/profiles/:name/gateway/start", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      const gateway = services.gateways.get(profile);
      return context.json(await runGatewayAction(gateway, () => gateway.start()));
    })
    .post("/profiles/:name/gateway/stop", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      const gateway = services.gateways.get(profile);
      return context.json(await runGatewayAction(gateway, () => gateway.stop()));
    })
    .post("/profiles/:name/gateway/restart", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      const gateway = services.gateways.get(profile);
      return context.json(await runGatewayAction(gateway, () => gateway.restart()));
    })
    .get("/profiles/:name/config", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      try {
        return context.json(await services.config.read(profile));
      } catch (cause: unknown) {
        return context.json({ error: `Failed to read config: ${getErrorMessage(cause)}` }, 500);
      }
    })
    .post("/profiles/:name/config", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      const content = await parseConfigContent(context.req.json());

      if (content === null) {
        return context.json({ error: "Config content must be a string." }, 400);
      }

      const gateway = services.gateways.get(profile);
      const wasRunning = gateway.status().state === "running";
      const config = await saveConfig(services.config, profile, content);

      if (!config.ok) {
        return context.json({ error: `Failed to save config: ${config.error}` }, 500);
      }

      if (!config.value.saved) {
        return context.json(
          {
            config: config.value,
            restart: { attempted: false, ok: true, error: null },
            gateway: gateway.status(),
          },
          422,
        );
      }

      if (!wasRunning) {
        return context.json({
          config: config.value,
          restart: { attempted: false, ok: true, error: null },
          gateway: gateway.status(),
        });
      }

      try {
        const status = await gateway.restart();

        return context.json({
          config: config.value,
          restart: { attempted: true, ok: true, error: null },
          gateway: status,
        });
      } catch (cause: unknown) {
        return context.json({
          config: config.value,
          restart: {
            attempted: true,
            ok: false,
            error: getErrorMessage(cause),
          },
          gateway: gateway.status(),
        });
      }
    })
    .get("/profiles/:name/env", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      try {
        return context.json(await services.envVars.read(profile));
      } catch (cause: unknown) {
        return context.json({ error: `Failed to read env: ${getErrorMessage(cause)}` }, 500);
      }
    })
    .post("/profiles/:name/env", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      const input = await parseEnvUpsertInput(context.req.json());
      if (input === null) {
        return context.json({ error: "Body must include string key and value." }, 400);
      }

      const gateway = services.gateways.get(profile);
      const envResult = await mutateEnv(() =>
        services.envVars.upsert(profile, input.key, input.value),
      );
      if (!envResult.ok) {
        return context.json({ error: `Failed to update env: ${envResult.error}` }, 500);
      }

      return context.json(await withGatewayRestart(gateway, envResult.value));
    })
    .post("/profiles/:name/env/batch", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
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

      const gateway = services.gateways.get(profile);
      const envResult = await mutateEnv(() => services.envVars.applyBatch(profile, input));
      if (!envResult.ok) {
        return context.json({ error: `Failed to update env: ${envResult.error}` }, 500);
      }

      return context.json(await withGatewayRestart(gateway, envResult.value));
    })
    .delete("/profiles/:name/env/:key", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      const key = context.req.param("key");
      const gateway = services.gateways.get(profile);
      const envResult = await mutateEnv(() => services.envVars.remove(profile, key));
      if (!envResult.ok) {
        return context.json({ error: `Failed to delete env: ${envResult.error}` }, 500);
      }

      return context.json(await withGatewayRestart(gateway, envResult.value));
    })
    .get("/profiles/:name/settings/workspace-hints", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      try {
        return context.json(await services.config.getWorkspaceConfigHints(profile));
      } catch (cause: unknown) {
        return context.json(
          { error: `Failed to read config hints: ${getErrorMessage(cause)}` },
          500,
        );
      }
    })
    .post("/profiles/:name/settings/model-providers", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
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

      const gateway = services.gateways.get(profile);

      let configResult: ConfigSaveResult;
      try {
        const baseline = await services.config.read(profile);
        configResult = { ...baseline, saved: false };

        if (input.model !== undefined && Object.keys(input.model).length > 0) {
          const patched = await saveConfigPatch(services.config, profile, input.model);
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
          const patched = await saveDiscordPatch(services.config, profile, input.discord);
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
        return context.json(
          {
            error: `Failed to read or patch config: ${getErrorMessage(cause)}`,
          },
          500,
        );
      }

      let envSnapshot: EnvReadResult;
      const discordEnvSync =
        input.discord === undefined
          ? undefined
          : typeof input.discord.allowed_users === "string" &&
              input.discord.allowed_users.trim().length > 0
            ? {
                set: {
                  DISCORD_ALLOWED_USERS: input.discord.allowed_users.trim(),
                },
              }
            : input.discord.allowed_users !== undefined
              ? { remove: ["DISCORD_ALLOWED_USERS"] }
              : undefined;
      const envMutation = mergeEnvBatchMutations(input.env, discordEnvSync);
      if (envMutation !== undefined) {
        const envResult = await mutateEnv(() => services.envVars.applyBatch(profile, envMutation));
        if (!envResult.ok) {
          return context.json({ error: `Failed to update env: ${envResult.error}` }, 500);
        }
        envSnapshot = envResult.value;
      } else {
        try {
          envSnapshot = await services.envVars.read(profile);
        } catch (cause: unknown) {
          return context.json({ error: `Failed to read env: ${getErrorMessage(cause)}` }, 500);
        }
      }

      const wasRunning = gateway.status().state === "running";
      let restart: ModelProvidersMutationResponse["restart"];
      let gatewayStatus: GatewayStatus;
      if (!wasRunning) {
        restart = { attempted: false, ok: true, error: null };
        gatewayStatus = gateway.status();
      } else {
        try {
          gatewayStatus = await gateway.restart();
          restart = { attempted: true, ok: true, error: null };
        } catch (cause: unknown) {
          restart = {
            attempted: true,
            ok: false,
            error: getErrorMessage(cause),
          };
          gatewayStatus = gateway.status();
        }
      }

      const payload: ModelProvidersMutationResponse = {
        env: envSnapshot,
        config: configResult,
        restart,
        gateway: gatewayStatus,
      };
      return context.json(payload);
    })
    .get("/profiles/:name/logs/tail", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      return context.json(await services.logsRegistry.get(profile).tail(200));
    })
    .get("/profiles/:name/logs/stream", (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      const { readable, writable } = new TransformStream<Uint8Array>();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      let closed = false;
      let unsubscribed = false;

      const closeStream = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (!unsubscribed) {
          unsubscribed = true;
          unsubscribe();
        }
        writer.close().catch(() => {
          // Ignore close races from already closed/errored streams.
        });
      };

      const writeLine = async (line: string): Promise<void> => {
        if (closed) {
          return;
        }
        try {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ line })}\n\n`));
        } catch {
          closeStream();
        }
      };

      const unsubscribe = services.logsRegistry.get(profile).subscribe((line) => {
        void writeLine(line);
      });

      context.req.raw.signal.addEventListener("abort", closeStream, {
        once: true,
      });

      return new Response(readable, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        },
      });
    })
    .get("/profiles", async (context) => {
      try {
        const list = await services.profiles.list();
        const legacyActive = await services.profileResolver.readLegacyActiveProfile();
        return context.json({ ...list, legacyActive });
      } catch (cause: unknown) {
        return context.json({ error: `Failed to list profiles: ${getErrorMessage(cause)}` }, 500);
      }
    })
    .post("/profiles", async (context) => {
      const input = await parseProfileCreateInput(context.req.json());
      if (input === null) {
        return context.json(
          {
            error:
              'Body must include { name: string, mode: "blank"|"clone"|"clone-all", cloneFrom?: string }.',
          },
          400,
        );
      }
      try {
        return context.json(await services.profiles.create(input));
      } catch (cause: unknown) {
        return context.json({ error: `Failed to create profile: ${getErrorMessage(cause)}` }, 400);
      }
    })
    .put("/profiles/:name", async (context) => {
      const from = context.req.param("name");
      if (!isValidProfileName(from)) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      const body = await parseProfileRenameInput(context.req.json());
      if (body === null) {
        return context.json({ error: "Body must include { to: string }." }, 400);
      }
      try {
        return context.json(await services.profiles.rename(from, body.to));
      } catch (cause: unknown) {
        return context.json({ error: `Failed to rename profile: ${getErrorMessage(cause)}` }, 400);
      }
    })
    .delete("/profiles/:name", async (context) => {
      const name = context.req.param("name");
      if (!isValidProfileName(name)) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      try {
        return context.json(await services.profiles.remove(name));
      } catch (cause: unknown) {
        return context.json({ error: `Failed to delete profile: ${getErrorMessage(cause)}` }, 400);
      }
    })
    .get("/profiles/:name/files/:kind", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      const kind = parseProfileFileKind(context.req.param("kind"));
      if (kind === null) {
        return context.json({ error: 'File kind must be one of: "soul", "memory", "user".' }, 400);
      }
      try {
        return context.json(await services.profileFiles.read(profile, kind));
      } catch (cause: unknown) {
        return context.json(
          { error: `Failed to read profile file: ${getErrorMessage(cause)}` },
          500,
        );
      }
    })
    .put("/profiles/:name/files/:kind", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      const kind = parseProfileFileKind(context.req.param("kind"));
      if (kind === null) {
        return context.json({ error: 'File kind must be one of: "soul", "memory", "user".' }, 400);
      }
      const content = await parseProfileFileContent(context.req.json());
      if (content === null) {
        return context.json({ error: "Body must include { content: string }." }, 400);
      }
      try {
        return context.json(await services.profileFiles.write(profile, kind, content));
      } catch (cause: unknown) {
        return context.json(
          { error: `Failed to write profile file: ${getErrorMessage(cause)}` },
          500,
        );
      }
    })
    .get("/profiles/:name/sessions", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      try {
        return context.json(await services.profileSessions.list(profile));
      } catch (cause: unknown) {
        return context.json(
          {
            error: `Failed to list profile sessions: ${getErrorMessage(cause)}`,
          },
          500,
        );
      }
    })
    .get("/profiles/:name/sessions/:id", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      try {
        return context.json(await services.profileSessions.get(profile, context.req.param("id")));
      } catch (cause: unknown) {
        return context.json(
          {
            error: `Failed to read profile session: ${getErrorMessage(cause)}`,
          },
          500,
        );
      }
    })
    .post("/profiles/:name/sessions", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      const input = await parseProfileSessionCreateInput(context.req.json());
      if (input === null) {
        return context.json({ error: "Body must include { name: string }." }, 400);
      }
      try {
        return context.json(await services.profileSessions.create(profile, input));
      } catch (cause: unknown) {
        return context.json(
          {
            error: `Failed to create profile session: ${getErrorMessage(cause)}`,
          },
          500,
        );
      }
    })
    .put("/profiles/:name/sessions/:id", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      const input = await parseProfileSessionRenameInput(context.req.json());
      if (input === null) {
        return context.json({ error: "Body must include { name: string }." }, 400);
      }
      try {
        return context.json(
          await services.profileSessions.rename(profile, context.req.param("id"), input),
        );
      } catch (cause: unknown) {
        return context.json(
          {
            error: `Failed to rename profile session: ${getErrorMessage(cause)}`,
          },
          500,
        );
      }
    })
    .delete("/profiles/:name/sessions/:id", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      try {
        return context.json(
          await services.profileSessions.remove(profile, context.req.param("id")),
        );
      } catch (cause: unknown) {
        return context.json(
          {
            error: `Failed to delete profile session: ${getErrorMessage(cause)}`,
          },
          500,
        );
      }
    })
    .post("/profiles/:name/sessions/:id/archive", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      try {
        return context.json(
          await services.profileSessions.archive(profile, context.req.param("id")),
        );
      } catch (cause: unknown) {
        return context.json(
          {
            error: `Failed to archive profile session: ${getErrorMessage(cause)}`,
          },
          500,
        );
      }
    })
    .post("/profiles/:name/sessions/:id/restore", async (context) => {
      const profile = parseProfileParam(context.req.param("name"));
      if (profile === undefined) {
        return context.json({ error: "Invalid profile name." }, 400);
      }
      try {
        return context.json(
          await services.profileSessions.restore(profile, context.req.param("id")),
        );
      } catch (cause: unknown) {
        return context.json(
          {
            error: `Failed to restore profile session: ${getErrorMessage(cause)}`,
          },
          500,
        );
      }
    });
}

export type AppType = ReturnType<typeof createApp>;

async function safeListProfileNames(services: AppServices): Promise<Array<string | null>> {
  try {
    return await services.profiles.listProfileNames();
  } catch {
    return [null];
  }
}

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
  profile: string | null,
  content: string,
): Promise<{ ok: true; value: ConfigSaveResult } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await config.save(profile, content) };
  } catch (cause: unknown) {
    return { ok: false, error: getErrorMessage(cause) };
  }
}

async function saveConfigPatch(
  config: AppConfig,
  profile: string | null,
  updates: ModelYamlPatch,
): Promise<{ ok: true; value: ConfigSaveResult } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await config.patchModel(profile, updates) };
  } catch (cause: unknown) {
    return { ok: false, error: getErrorMessage(cause) };
  }
}

async function saveDiscordPatch(
  config: AppConfig,
  profile: string | null,
  updates: DiscordSettingsPatch,
): Promise<{ ok: true; value: ConfigSaveResult } | { ok: false; error: string }> {
  try {
    return {
      ok: true,
      value: await config.patchDiscordSettings(profile, updates),
    };
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

function parseEnvBatchRecord(
  body: unknown,
): { set?: Record<string, string>; remove?: string[] } | null {
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

function mergeEnvBatchMutations(
  left: { set?: Record<string, string>; remove?: string[] } | undefined,
  right: { set?: Record<string, string>; remove?: string[] } | undefined,
): { set?: Record<string, string>; remove?: string[] } | undefined {
  if (left === undefined) {
    return right;
  }
  if (right === undefined) {
    return left;
  }

  const mergedSet = { ...left.set, ...right.set };
  const remove = [...new Set([...(left.remove ?? []), ...(right.remove ?? [])])].filter(
    (key) => !(key in mergedSet),
  );
  const result: { set?: Record<string, string>; remove?: string[] } = {};
  if (Object.keys(mergedSet).length > 0) {
    result.set = mergedSet;
  }
  if (remove.length > 0) {
    result.remove = remove;
  }
  return hasEnvBatchMutation(result) ? result : undefined;
}

async function parseModelProvidersInput(bodyPromise: Promise<unknown>): Promise<{
  model?: ModelYamlPatch;
  env?: { set?: Record<string, string>; remove?: string[] };
  discord?: DiscordSettingsPatch;
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

    let discord: DiscordSettingsPatch | undefined;
    if (body.discord !== undefined) {
      if (!isRecord(body.discord)) {
        return null;
      }
      const parsed: DiscordSettingsPatch = {};
      for (const key of [
        "allowed_users",
        "require_mention",
        "free_response_channels",
        "auto_thread",
        "reactions",
        "ignored_channels",
        "no_thread_channels",
        "channel_prompts",
        "allow_mentions_everyone",
        "allow_mentions_roles",
        "allow_mentions_users",
        "allow_mentions_replied_user",
        "group_sessions_per_user",
      ] as const) {
        const value = body.discord[key];
        if (value === undefined) {
          continue;
        }
        if (typeof value !== "string") {
          return null;
        }
        parsed[key] = value;
      }
      if (Object.keys(parsed).length === 0) {
        return null;
      }
      discord = parsed;
    }

    const hasModel = model !== undefined && Object.keys(model).length > 0;
    const hasDiscord = discord !== undefined;
    if (!hasModel && env === undefined && !hasDiscord) {
      return null;
    }

    const result: {
      model?: ModelYamlPatch;
      env?: { set?: Record<string, string>; remove?: string[] };
      discord?: DiscordSettingsPatch;
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

function parseProfileCreateMode(value: unknown): ProfileCreateMode | null {
  if (value === "blank" || value === "clone" || value === "clone-all") {
    return value;
  }
  return null;
}

async function parseProfileCreateInput(
  bodyPromise: Promise<unknown>,
): Promise<ProfileCreateInput | null> {
  try {
    const body = await bodyPromise;
    if (!isRecord(body) || typeof body.name !== "string") {
      return null;
    }
    const name = body.name.trim();
    if (name.length === 0 || !isValidProfileName(name)) {
      return null;
    }
    const mode = parseProfileCreateMode(body.mode);
    if (mode === null) {
      return null;
    }
    const result: ProfileCreateInput = { name, mode };
    if (typeof body.cloneFrom === "string" && body.cloneFrom.trim().length > 0) {
      const cloneFrom = body.cloneFrom.trim();
      if (!isValidProfileName(cloneFrom)) {
        return null;
      }
      result.cloneFrom = cloneFrom;
    }
    return result;
  } catch {
    return null;
  }
}

async function parseProfileRenameInput(
  bodyPromise: Promise<unknown>,
): Promise<{ to: string } | null> {
  try {
    const body = await bodyPromise;
    if (!isRecord(body) || typeof body.to !== "string") {
      return null;
    }
    const to = body.to.trim();
    if (to.length === 0 || !isValidProfileName(to)) {
      return null;
    }
    return { to };
  } catch {
    return null;
  }
}

async function parseProfileFileContent(bodyPromise: Promise<unknown>): Promise<string | null> {
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

function parseProfileFileKind(value: unknown): ProfileFileKind | null {
  if (value === "soul" || value === "memory" || value === "user") {
    return value;
  }
  return null;
}

async function parseProfileSessionCreateInput(
  bodyPromise: Promise<unknown>,
): Promise<ProfileSessionCreateInput | null> {
  try {
    const body = await bodyPromise;
    if (!isRecord(body) || typeof body.name !== "string") {
      return null;
    }
    const name = body.name.trim();
    if (name.length === 0) {
      return null;
    }
    return { name };
  } catch {
    return null;
  }
}

async function parseProfileSessionRenameInput(
  bodyPromise: Promise<unknown>,
): Promise<ProfileSessionRenameInput | null> {
  return parseProfileSessionCreateInput(bodyPromise);
}

export type _AppRouteSummary = GatewayProfileSummary;
