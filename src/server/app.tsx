/** @jsxImportSource hono/jsx */
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { basicAuthMiddleware } from "./services/auth";
import type {
  AppEnv,
  ConfigReadResult,
  ConfigSaveResult,
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
          <section class="mx-auto flex h-full min-w-0 max-w-[1400px] flex-col gap-4 p-4 xl:grid xl:grid-cols-[420px_minmax(0,1fr)] xl:grid-rows-1">
            <aside
              id="gateway-panel"
              class="min-w-0 shrink-0 overflow-auto rounded-xl border border-accent-border bg-surface p-5 xl:min-h-0"
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
              <div class="mt-4 flex gap-2">
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
            </aside>
            <section
              id="workspace"
              class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-accent-border bg-surface p-3 xl:min-h-0"
            >
              <div class="mb-3 flex shrink-0 gap-2 overflow-x-auto border-b border-frosted pb-3">
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
              </div>
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
