import { mkdir } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getRequestListener } from "@hono/node-server";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { createLogger } from "./config/logger";
import { ConfigStore } from "./services/config-store";
import { EnvStore } from "./services/env-store";
import { GatewayManager } from "./services/gateway-manager";
import { LogStore } from "./services/log-store";
import { createPaths, ProfileResolver } from "./services/paths";
import { ProfileFiles } from "./services/profile-files";
import { ProfileStore } from "./services/profile-store";
import { TerminalManager } from "./services/terminal-manager";
import { attachSocketServer } from "./socket";

export function createRuntime(source: NodeJS.ProcessEnv = process.env, rootDir = process.cwd()) {
  const env = loadEnv(source);
  const logger = createLogger(env.logLevel);
  const paths = createPaths(rootDir);
  const profileResolver = new ProfileResolver(rootDir);
  const logs = new LogStore(() => profileResolver.getLogsDir());
  const gateway = new GatewayManager(() => profileResolver.getDataDir(), logs);
  const config = new ConfigStore(() => profileResolver.getDataDir(), logs);
  const envVars = new EnvStore(() => profileResolver.getDataDir());
  const terminals = new TerminalManager(() => profileResolver.getDataDir());
  const profiles = new ProfileStore(rootDir, profileResolver, logs);
  const profileFiles = new ProfileFiles(profileResolver);

  return {
    env,
    logger,
    paths,
    profileResolver,
    logs,
    gateway,
    config,
    envVars,
    terminals,
    profiles,
    profileFiles,
  };
}

type RuntimeServices = ReturnType<typeof createRuntime>;

export async function initializeRuntimeFilesystem(runtime: RuntimeServices): Promise<void> {
  await mkdir(runtime.paths.dataDir, { recursive: true });
  await mkdir(path.join(runtime.paths.dataDir, "profiles"), { recursive: true });
  await runtime.profileResolver.initialize();
  await mkdir(runtime.profileResolver.getDataDir(), { recursive: true });
  await mkdir(runtime.profileResolver.getLogsDir(), { recursive: true });
  await runtime.config.initialize();
}

export async function main(): Promise<void> {
  const runtime = createRuntime();

  await initializeRuntimeFilesystem(runtime);

  const app = createApp({
    env: runtime.env,
    gateway: runtime.gateway,
    logs: runtime.logs,
    config: runtime.config,
    envVars: runtime.envVars,
    profiles: runtime.profiles,
    profileFiles: runtime.profileFiles,
  });
  const server = createServer(getRequestListener(app.fetch));

  attachSocketServer(server, runtime.env, runtime.terminals);
  await listen(server, runtime.env.port);

  let shuttingDown = false;
  const gracefulShutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    void (async () => {
      runtime.logger.info({ signal }, "Shutting down");
      try {
        await runtime.gateway.shutdown();
      } catch (cause: unknown) {
        runtime.logger.error({ cause }, "Failed to stop gateway during shutdown");
      }
      process.exit(0);
    })();
  };

  process.once("SIGTERM", () => {
    gracefulShutdown("SIGTERM");
  });
  process.once("SIGINT", () => {
    gracefulShutdown("SIGINT");
  });

  runtime.logger.info({ port: runtime.env.port }, "Hermes control plane listening");
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((cause: unknown) => {
    const logger = createLogger("error");
    logger.error({ cause }, "Failed to start Hermes control plane");
    process.exit(1);
  });
}
