import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { renderToString } from "react-dom/server";
import { Dashboard } from "../client/views/dashboard";
import { Layout } from "../client/views/layout";
import { basicAuthMiddleware } from "./services/auth";
import type { AppEnv, ConfigReadResult, ConfigSaveResult, GatewayStatus, LogTail } from "./types";

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
  app.use("*", basicAuthMiddleware(services.env.adminUsername, services.env.adminPassword));

  return app
    .get("/assets/*", serveStatic({ root: "./dist" }))
    .get("/favicon.ico", (context) => context.body(null, 204))
    .get("/", (context) => {
      const html = renderToString(
        <Layout title="Hermes Agent">
          <Dashboard status={services.gateway.status()} />
        </Layout>,
      );

      return context.html(`<!doctype html>${html}`);
    })
    .get("/gateway/status", (context) => context.json(services.gateway.status()))
    .get("/gateway/health", async (context) =>
      context.json(await services.gateway.refreshHealth()),
    )
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
          restart: { attempted: true, ok: false, error: getErrorMessage(cause) },
          gateway: services.gateway.status(),
        });
      }
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

function getErrorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause);
}
