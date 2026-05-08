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
import { GatewayRegistry } from "./services/gateway-registry";
import { LogStoreRegistry } from "./services/log-store-registry";
import { createPaths, ProfileResolver } from "./services/paths";
import { ProfileFiles } from "./services/profile-files";
import { ProfileSessionsStore } from "./services/profile-sessions";
import { ProfileStore } from "./services/profile-store";
import { TerminalManager } from "./services/terminal-manager";
import { attachSocketServer } from "./socket";

export function createRuntime(source: NodeJS.ProcessEnv = process.env, rootDir = process.cwd()) {
  const env = loadEnv(source);
  const logger = createLogger(env.logLevel);
  const paths = createPaths(rootDir);
  const profileResolver = new ProfileResolver(rootDir);
  const logsRegistry = new LogStoreRegistry(profileResolver);
  const gateways = new GatewayRegistry(profileResolver, logsRegistry);
  const config = new ConfigStore(profileResolver, logsRegistry);
  const envVars = new EnvStore(profileResolver);
  const terminals = new TerminalManager(profileResolver);
  const profiles = new ProfileStore(
    rootDir,
    profileResolver,
    logsRegistry,
    undefined,
    undefined,
    (profile) => gateways.has(profile) && gateways.get(profile).status().state === "running",
  );
  const profileFiles = new ProfileFiles(profileResolver);
  const profileSessions = new ProfileSessionsStore(profileResolver);

  return {
    env,
    logger,
    paths,
    profileResolver,
    logsRegistry,
    gateways,
    config,
    envVars,
    terminals,
    profiles,
    profileFiles,
    profileSessions,
  };
}

type RuntimeServices = ReturnType<typeof createRuntime>;

export async function initializeRuntimeFilesystem(runtime: RuntimeServices): Promise<void> {
  await mkdir(runtime.paths.dataDir, { recursive: true });
  await mkdir(path.join(runtime.paths.dataDir, "profiles"), { recursive: true });
  await mkdir(runtime.profileResolver.resolveDataDir(null), { recursive: true });
  await mkdir(runtime.profileResolver.resolveLogsDir(null), { recursive: true });
  await runtime.config.initializeDefault();
}

export async function main(): Promise<void> {
  const runtime = createRuntime();

  await initializeRuntimeFilesystem(runtime);

  const app = createApp({
    env: runtime.env,
    gateways: runtime.gateways,
    logsRegistry: runtime.logsRegistry,
    config: runtime.config,
    envVars: runtime.envVars,
    profiles: runtime.profiles,
    profileFiles: runtime.profileFiles,
    profileSessions: runtime.profileSessions,
    profileResolver: runtime.profileResolver,
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
        await runtime.gateways.shutdownAll();
      } catch (cause: unknown) {
        runtime.logger.error({ cause }, "Failed to stop gateways during shutdown");
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
