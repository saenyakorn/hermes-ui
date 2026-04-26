/** @jsxImportSource hono/jsx */
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { basicAuthMiddleware } from "./services/auth";
import type {
  AppEnv,
  ConfigReadResult,
  ConfigSaveResult,
  EnvReadResult,
  GatewayStatus,
  LogTail,
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
  };
};

export function createApp(services: AppServices) {
  const app = new Hono();
  app.use(
    "*",
    basicAuthMiddleware(services.env.adminUsername, services.env.adminPassword),
  );

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
    .get("/gateway/status", (context) =>
      context.json(services.gateway.status()),
    )
    .get("/gateway/health", async (context) =>
      context.json(await services.gateway.refreshHealth()),
    )
    .post("/gateway/start", async (context) =>
      context.json(
        await runGatewayAction(services.gateway, () =>
          services.gateway.start(),
        ),
      ),
    )
    .post("/gateway/stop", async (context) =>
      context.json(
        await runGatewayAction(services.gateway, () => services.gateway.stop()),
      ),
    )
    .post("/gateway/restart", async (context) =>
      context.json(
        await runGatewayAction(services.gateway, () =>
          services.gateway.restart(),
        ),
      ),
    )
    .get("/config", async (context) => {
      try {
        return context.json(await services.config.read());
      } catch (cause: unknown) {
        return context.json(
          { error: `Failed to read config: ${getErrorMessage(cause)}` },
          500,
        );
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
        return context.json(
          { error: `Failed to save config: ${config.error}` },
          500,
        );
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
        return context.json(
          { error: `Failed to read env: ${getErrorMessage(cause)}` },
          500,
        );
      }
    })
    .post("/env", async (context) => {
      const input = await parseEnvUpsertInput(context.req.json());
      if (input === null) {
        return context.json(
          { error: "Body must include string key and value." },
          400,
        );
      }

      const envResult = await mutateEnv(
        () => services.envVars.upsert(input.key, input.value),
      );
      if (!envResult.ok) {
        return context.json(
          { error: `Failed to update env: ${envResult.error}` },
          500,
        );
      }

      return context.json(
        await withGatewayRestart(services.gateway, envResult.value),
      );
    })
    .delete("/env/:key", async (context) => {
      const key = context.req.param("key");
      const envResult = await mutateEnv(() => services.envVars.remove(key));
      if (!envResult.ok) {
        return context.json(
          { error: `Failed to delete env: ${envResult.error}` },
          500,
        );
      }

      return context.json(
        await withGatewayRestart(services.gateway, envResult.value),
      );
    })
    .get("/logs/tail", async (context) =>
      context.json(await services.logs.tail(200)),
    )
    .get("/logs/stream", (context) => {
      const { readable, writable } = new TransformStream<Uint8Array>();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const unsubscribe = services.logs.subscribe((line) => {
        void writer.write(
          encoder.encode(`data: ${JSON.stringify({ line })}\n\n`),
        );
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

async function parseConfigContent(
  bodyPromise: Promise<unknown>,
): Promise<string | null> {
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
): Promise<
  { ok: true; value: ConfigSaveResult } | { ok: false; error: string }
> {
  try {
    return { ok: true, value: await config.save(content) };
  } catch (cause: unknown) {
    return { ok: false, error: getErrorMessage(cause) };
  }
}

async function parseEnvUpsertInput(
  bodyPromise: Promise<unknown>,
): Promise<{ key: string; value: string } | null> {
  try {
    const body = await bodyPromise;
    if (
      !isRecord(body) ||
      typeof body.key !== "string" ||
      typeof body.value !== "string"
    ) {
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

function renderHtmlDocument(title: string, initialStatus: string): string {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href="/assets/app.css" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/xterm/css/xterm.css"
        />
        <script src="/assets/vendor/htmx.min.js" />
      </head>
      <body>
        <main class="h-screen overflow-x-hidden overflow-y-hidden bg-background text-text">
          <section class="mx-auto flex h-full min-w-0 max-w-[1400px] flex-col gap-4 p-4">
            <section
              id="workspace"
              class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-accent-border bg-surface p-3"
            >
              <div class="mb-3 flex shrink-0 gap-2 overflow-x-auto border-b border-frosted pb-3">
                <button
                  type="button"
                  data-tab-trigger="control"
                  class="rounded-full px-4 py-2 text-sm text-muted"
                >
                  Control
                </button>
                <button
                  type="button"
                  data-tab-trigger="logs"
                  class="rounded-full bg-frosted px-4 py-2 text-sm text-text"
                >
                  Live log
                </button>
                <button
                  type="button"
                  data-tab-trigger="shell"
                  class="rounded-full px-4 py-2 text-sm text-muted"
                >
                  Interactive shell
                </button>
                <button
                  type="button"
                  data-tab-trigger="config"
                  class="rounded-full px-4 py-2 text-sm text-muted"
                >
                  Hermes config
                </button>
                <button
                  type="button"
                  data-tab-trigger="env"
                  class="rounded-full px-4 py-2 text-sm text-muted"
                >
                  Env vars
                </button>
              </div>
              <section
                id="gateway-panel"
                data-tab-panel="control"
                class="hidden min-h-0 min-w-0 flex-1 flex-col overflow-auto p-2"
              >
                <p class="text-xs uppercase text-muted">Gateway</p>
                <h1 class="mt-2 text-4xl font-medium tracking-[-0.08em]">
                  Hermes Agent
                </h1>
                <div
                  class="mt-6 text-sm text-muted"
                  id="gateway-status"
                  data-state="stopped"
                />
                <p id="gateway-error" class="mt-2 text-xs text-danger hidden" />
                <div class="mt-4 flex flex-wrap gap-2">
                  <button
                    id="start-button"
                    class="rounded-full bg-text px-4 py-2 text-sm text-background"
                    hx-post="/gateway/start"
                    hx-trigger="click"
                    hx-swap="none"
                  >
                    Start
                  </button>
                  <button
                    id="stop-button"
                    class="rounded-full bg-frosted px-4 py-2 text-sm text-text"
                    hx-post="/gateway/stop"
                    hx-trigger="click"
                    hx-swap="none"
                  >
                    Stop
                  </button>
                  <button
                    id="restart-button"
                    class="rounded-full bg-frosted px-4 py-2 text-sm text-text"
                    hx-post="/gateway/restart"
                    hx-trigger="click"
                    hx-swap="none"
                  >
                    Restart
                  </button>
                </div>
              </section>
              <section
                data-tab-panel="logs"
                class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              >
                <p class="mb-2 shrink-0 text-xs uppercase text-muted">
                  Gateway log
                </p>
                <pre
                  id="log-lines"
                  class="min-h-0 flex-1 overflow-auto rounded-lg bg-background p-3 text-xs text-muted"
                />
                <p
                  id="log-error"
                  class="mt-2 shrink-0 text-xs text-danger hidden"
                />
              </section>
              <section
                data-tab-panel="shell"
                class="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              >
                <div class="mb-3 flex shrink-0 items-center justify-between">
                  <p class="text-sm text-muted">Interactive shell</p>
                  <button
                    id="shell-clear"
                    type="button"
                    class="rounded-full bg-frosted px-3 py-1 text-xs text-text"
                  >
                    Clear
                  </button>
                </div>
                <div
                  id="terminal"
                  class="min-h-[320px] flex-1 rounded-lg bg-background"
                />
              </section>
              <section
                data-tab-panel="config"
                class="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              >
                <div class="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
                  <div>
                    <p class="text-xs uppercase text-muted">Hermes Config</p>
                    <p id="config-path" class="mt-1 text-sm text-text">
                      data/config.yaml
                    </p>
                    <p id="config-updated-at" class="mt-1 text-xs text-muted">
                      Loading config...
                    </p>
                  </div>
                  <div class="flex gap-2">
                    <button
                      id="config-reload"
                      type="button"
                      class="rounded-full bg-frosted px-3 py-1 text-xs text-text"
                    >
                      Reload from disk
                    </button>
                    <button
                      id="config-save"
                      type="button"
                      class="rounded-full bg-text px-3 py-1 text-xs text-background disabled:opacity-50"
                      disabled
                    >
                      Save config
                    </button>
                  </div>
                </div>
                <div
                  id="config-editor"
                  class="min-h-[280px] flex-1 overflow-hidden rounded-lg border border-frosted bg-background"
                />
                <div
                  id="config-status"
                  class="mt-3 shrink-0 text-xs text-muted"
                  role="status"
                  aria-live="polite"
                >
                  Waiting for editor...
                </div>
                <ul
                  id="config-issues"
                  class="mt-2 shrink-0 space-y-1 text-xs text-danger"
                />
              </section>
              <section
                data-tab-panel="env"
                class="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              >
                <div class="mb-3 flex shrink-0 items-center justify-between gap-3">
                  <div>
                    <p class="text-xs uppercase text-muted">Environment Variables</p>
                    <p id="env-path" class="mt-1 text-sm text-text">
                      data/.env
                    </p>
                    <p id="env-updated-at" class="mt-1 text-xs text-muted">
                      Loading env...
                    </p>
                  </div>
                  <button
                    id="env-reload"
                    type="button"
                    class="rounded-full bg-frosted px-3 py-1 text-xs text-text"
                  >
                    Reload
                  </button>
                </div>
                <div class="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
                  <select
                    id="env-list"
                    size={12}
                    class="min-h-[280px] w-full rounded-lg border border-frosted bg-background p-2 text-xs text-text"
                  />
                  <div class="flex min-h-0 flex-col gap-2 rounded-lg border border-frosted bg-background p-3">
                    <label class="text-xs text-muted" for="env-key-input">
                      Key
                    </label>
                    <input
                      id="env-key-input"
                      type="text"
                      placeholder="OPENAI_API_KEY"
                      class="rounded-md border border-frosted bg-surface px-2 py-1 text-xs text-text outline-none"
                    />
                    <label class="mt-2 text-xs text-muted" for="env-value-input">
                      Value
                    </label>
                    <input
                      id="env-value-input"
                      type="password"
                      placeholder="Enter value"
                      class="rounded-md border border-frosted bg-surface px-2 py-1 text-xs text-text outline-none"
                    />
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button
                        id="env-save"
                        type="button"
                        class="rounded-full bg-text px-3 py-1 text-xs text-background"
                      >
                        Add / Update
                      </button>
                      <button
                        id="env-remove"
                        type="button"
                        class="rounded-full bg-frosted px-3 py-1 text-xs text-text"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
                <p
                  id="env-status"
                  class="mt-3 shrink-0 text-xs text-muted"
                  role="status"
                  aria-live="polite"
                >
                  Waiting for env editor...
                </p>
              </section>
            </section>
          </section>
        </main>
        <script
          type="module"
          src="/assets/main.js"
          data-initial-status={initialStatus}
        />
      </body>
    </html>
  ).toString();
}
