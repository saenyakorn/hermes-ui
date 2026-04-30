import {
  spawn,
  type ChildProcessWithoutNullStreams,
  type SpawnOptionsWithoutStdio,
} from "node:child_process";
import { checkGatewayHealth } from "./health";
import type { LogStore } from "./log-store";
import { asDirProvider, type DirProvider } from "./paths";
import type { GatewayHealthState, GatewayProcessState, GatewayStatus } from "../types";

const STOP_FORCE_TIMEOUT_MS = 5_000;
const GATEWAY_ARGS = ["gateway"] as const;

export type SpawnGateway = (
  command: string,
  args: string[],
  options: Pick<SpawnOptionsWithoutStdio, "cwd" | "env" | "detached" | "stdio">,
) => ChildProcessWithoutNullStreams;

const defaultSpawnGateway: SpawnGateway = (command, args, options) => spawn(command, args, options);

export class GatewayManager {
  private state: GatewayProcessState = "stopped";
  private child: ChildProcessWithoutNullStreams | null = null;
  private startedAt: string | null = null;
  private exitCode: number | null = null;
  private lastError: string | null = null;
  private stopTimer: NodeJS.Timeout | null = null;
  private controlledShutdownChild: ChildProcessWithoutNullStreams | null = null;
  private readonly getCwd: DirProvider;

  constructor(
    cwd: string | DirProvider,
    private readonly logs: LogStore,
    private readonly spawnGateway: SpawnGateway = defaultSpawnGateway,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly forceKillTimeoutMs: number = STOP_FORCE_TIMEOUT_MS,
  ) {
    this.getCwd = asDirProvider(cwd);
  }

  /** Resolved spawn cwd for the active profile. */
  get cwd(): string {
    return this.getCwd();
  }

  async start(): Promise<GatewayStatus> {
    if (this.child !== null) {
      throw new Error("Gateway already running");
    }

    this.state = "starting";
    this.startedAt = this.clock();
    this.exitCode = null;
    this.lastError = null;

    try {
      const cwd = this.getCwd();
      // Detach from the control plane session and do not wire stdin to a pipe.
      // Otherwise some gateway CLIs exit on stdin EOF / session signals when the
      // web client or dev server lifecycle changes, even though Node keeps running.
      const child = this.spawnGateway("hermes", [...GATEWAY_ARGS], {
        cwd,
        env: { ...process.env, HERMES_HOME: cwd },
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      this.child = child;
      this.bindChild(child);
      if (child.pid === undefined) {
        await this.waitForSpawn(child);
      }
      this.state = "running";
      await this.logs.append("gateway", `Started hermes gateway pid=${child.pid ?? "unknown"}`);

      return this.status();
    } catch (cause: unknown) {
      this.state = "crashed";
      this.child = null;
      this.lastError = this.formatCause(cause);
      await this.logs.append("gateway", `Failed to start hermes gateway: ${this.lastError}`);
      throw cause;
    }
  }

  async stop(): Promise<GatewayStatus> {
    if (this.child === null) {
      this.clearStopTimer();
      this.state = "stopped";
      this.startedAt = null;
      return this.status();
    }

    const child = this.child;

    this.state = "stopping";
    this.controlledShutdownChild = child;
    await this.logs.append("gateway", `Stopping hermes gateway pid=${child.pid ?? "unknown"}`);
    child.kill("SIGTERM");

    this.clearStopTimer();
    this.stopTimer = setTimeout(() => {
      if (this.child === child) {
        void this.logs.append(
          "gateway",
          `Force stopping hermes gateway pid=${child.pid ?? "unknown"}`,
        );
        child.kill("SIGKILL");
      }
    }, this.forceKillTimeoutMs);
    this.stopTimer.unref();

    return this.status();
  }

  async restart(): Promise<GatewayStatus> {
    const stoppingChild = this.child;

    await this.stop();
    await this.waitForChildExit(stoppingChild);

    return this.start();
  }

  /**
   * Stops the gateway and waits until the child process has exited.
   * Used on control-plane shutdown (e.g. tsx watch reload) so the gateway
   * port is not left held by an orphaned process.
   */
  async shutdown(): Promise<void> {
    const stoppingChild = this.child;
    if (stoppingChild === null) {
      return;
    }

    await this.stop();
    await this.waitForChildExit(stoppingChild);
  }

  async refreshHealth(): Promise<GatewayStatus> {
    const health = await checkGatewayHealth(this.state === "running");

    if (health === "unhealthy" || health === "unreachable") {
      await this.logs.append("health", `Gateway health check failed: ${health}`);
    }

    return this.status(health);
  }

  status(health: GatewayHealthState = "unknown"): GatewayStatus {
    return {
      state: this.state,
      health,
      pid: this.child?.pid ?? null,
      cwd: this.cwd,
      startedAt: this.startedAt,
      uptimeMs: this.getUptimeMs(),
      exitCode: this.exitCode,
      lastError: this.lastError,
      logWarning: this.logs.getWarning(),
    };
  }

  private bindChild(child: ChildProcessWithoutNullStreams): void {
    child.stdout.on("data", (chunk: Buffer) => {
      void this.logs.append("stdout", chunk.toString("utf8"));
    });

    child.stderr.on("data", (chunk: Buffer) => {
      void this.logs.append("stderr", chunk.toString("utf8"));
    });

    child.on("error", (cause: Error) => {
      this.lastError = this.formatCause(cause);
      if (this.child === child) {
        this.clearStopTimer();
        this.controlledShutdownChild = null;
        this.child = null;
        this.startedAt = null;
        this.state = "crashed";
      }
      void this.logs.append("gateway", `Gateway process error: ${this.lastError}`);
    });

    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      if (this.child !== child) {
        return;
      }

      this.clearStopTimer();
      const controlledShutdown = this.controlledShutdownChild === child;
      this.controlledShutdownChild = null;
      this.child = null;
      this.exitCode = code;
      this.state = controlledShutdown || code === 0 ? "stopped" : "crashed";

      if (this.state === "crashed") {
        this.lastError =
          signal === null
            ? `Gateway exited with code ${code ?? "unknown"}`
            : `Gateway exited with signal ${signal}`;
      } else {
        this.startedAt = null;
        this.lastError = null;
      }

      void this.logs.append(
        "gateway",
        `Gateway exited code=${code ?? "null"} signal=${signal ?? "null"}`,
      );
    });
  }

  private getUptimeMs(): number | null {
    if (this.startedAt === null) {
      return null;
    }

    return Math.max(0, Date.parse(this.clock()) - Date.parse(this.startedAt));
  }

  private clearStopTimer(): void {
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  private waitForChildExit(child: ChildProcessWithoutNullStreams | null): Promise<void> {
    if (child === null || this.child !== child) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      child.once("exit", () => {
        resolve();
      });
    });
  }

  private waitForSpawn(child: ChildProcessWithoutNullStreams): Promise<void> {
    return new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
  }

  private formatCause(cause: unknown): string {
    if (cause instanceof Error) {
      if (this.isMissingGatewayCommand(cause)) {
        return 'Hermes CLI not found: unable to execute "hermes". Install Hermes Agent in this environment so the hermes command is available on PATH.';
      }

      return cause.message;
    }

    return String(cause);
  }

  private isMissingGatewayCommand(cause: Error): boolean {
    const error = cause as NodeJS.ErrnoException;

    return error.code === "ENOENT" || cause.message.includes("spawn hermes ENOENT");
  }
}
