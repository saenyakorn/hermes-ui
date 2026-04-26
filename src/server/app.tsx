import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { renderToString } from "react-dom/server";
import { basicAuthMiddleware } from "./services/auth";
import type { AppEnv, GatewayStatus, LogTail } from "./types";
import { Dashboard } from "./ui/dashboard";
import { Layout } from "./ui/layout";

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

export type AppServices = {
  env: AppEnv;
  gateway: AppGateway;
  logs: AppLogs;
};

export function createApp(services: AppServices): Hono {
  const app = new Hono();
  app.use("*", basicAuthMiddleware(services.env.adminUsername, services.env.adminPassword));

  app.get("/assets/*", serveStatic({ root: "./dist" }));
  app.get("/favicon.ico", (context) => context.body(null, 204));

  app.get("/", (context) => {
    const html = renderToString(
      <Layout title="Hermes Agent">
        <Dashboard status={services.gateway.status()} />
      </Layout>,
    );

    return context.html(`<!doctype html>${html}`);
  });

  app.get("/gateway/status", (context) => context.json(services.gateway.status()));
  app.get("/gateway/health", async (context) =>
    context.json(await services.gateway.refreshHealth()),
  );
  app.post("/gateway/start", async (context) =>
    context.json(await runGatewayAction(services.gateway, () => services.gateway.start())),
  );
  app.post("/gateway/stop", async (context) =>
    context.json(await runGatewayAction(services.gateway, () => services.gateway.stop())),
  );
  app.post("/gateway/restart", async (context) =>
    context.json(await runGatewayAction(services.gateway, () => services.gateway.restart())),
  );
  app.get("/logs/tail", async (context) => context.json(await services.logs.tail(200)));

  app.get("/logs/stream", (context) => {
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

  return app;
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
