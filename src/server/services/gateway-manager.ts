import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { checkGatewayHealth } from './health';
import type { LogStore } from './log-store';
import type { GatewayHealthState, GatewayProcessState, GatewayStatus } from '../types';

const STOP_FORCE_TIMEOUT_MS = 5_000;

export type SpawnGateway = (
  command: string,
  args: string[],
  options: Pick<SpawnOptionsWithoutStdio, 'cwd'>,
) => ChildProcessWithoutNullStreams;

const defaultSpawnGateway: SpawnGateway = (command, args, options) => spawn(command, args, options);

export class GatewayManager {
  private state: GatewayProcessState = 'stopped';
  private child: ChildProcessWithoutNullStreams | null = null;
  private startedAt: string | null = null;
  private exitCode: number | null = null;
  private lastError: string | null = null;
  private stopTimer: NodeJS.Timeout | null = null;
  private controlledShutdownChild: ChildProcessWithoutNullStreams | null = null;

  constructor(
    private readonly cwd: string,
    private readonly logs: LogStore,
    private readonly spawnGateway: SpawnGateway = defaultSpawnGateway,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly forceKillTimeoutMs: number = STOP_FORCE_TIMEOUT_MS,
  ) {}

  async start(): Promise<GatewayStatus> {
    if (this.child !== null) {
      throw new Error('Gateway already running');
    }

    this.state = 'starting';
    this.startedAt = this.clock();
    this.exitCode = null;
    this.lastError = null;

    try {
      const child = this.spawnGateway('hermes', ['gateway'], { cwd: this.cwd });

      this.child = child;
      this.bindChild(child);
      this.state = 'running';
      await this.logs.append('gateway', `Started hermes gateway pid=${child.pid ?? 'unknown'}`);

      return this.status();
    } catch (cause: unknown) {
      this.state = 'crashed';
      this.child = null;
      this.lastError = this.formatCause(cause);
      await this.logs.append('gateway', `Failed to start hermes gateway: ${this.lastError}`);
      throw cause;
    }
  }

  async stop(): Promise<GatewayStatus> {
    if (this.child === null) {
      this.clearStopTimer();
      this.state = 'stopped';
      this.startedAt = null;
      return this.status();
    }

    const child = this.child;

    this.state = 'stopping';
    this.controlledShutdownChild = child;
    await this.logs.append('gateway', `Stopping hermes gateway pid=${child.pid ?? 'unknown'}`);
    child.kill('SIGTERM');

    this.clearStopTimer();
    this.stopTimer = setTimeout(() => {
      if (this.child === child) {
        void this.logs.append('gateway', `Force stopping hermes gateway pid=${child.pid ?? 'unknown'}`);
        child.kill('SIGKILL');
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

  async refreshHealth(): Promise<GatewayStatus> {
    const health = await checkGatewayHealth(this.state === 'running');

    if (health === 'unhealthy' || health === 'unreachable') {
      await this.logs.append('health', `Gateway health check failed: ${health}`);
    }

    return this.status(health);
  }

  status(health: GatewayHealthState = 'unknown'): GatewayStatus {
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
    child.stdout.on('data', (chunk: Buffer) => {
      void this.logs.append('stdout', chunk.toString('utf8'));
    });

    child.stderr.on('data', (chunk: Buffer) => {
      void this.logs.append('stderr', chunk.toString('utf8'));
    });

    child.on('error', (cause: Error) => {
      this.lastError = cause.message;
      void this.logs.append('gateway', `Gateway process error: ${cause.message}`);
    });

    child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      if (this.child !== child) {
        return;
      }

      this.clearStopTimer();
      const controlledShutdown = this.controlledShutdownChild === child;
      this.controlledShutdownChild = null;
      this.child = null;
      this.exitCode = code;
      this.state = controlledShutdown || code === 0 ? 'stopped' : 'crashed';

      if (this.state === 'crashed') {
        this.lastError = signal === null
          ? `Gateway exited with code ${code ?? 'unknown'}`
          : `Gateway exited with signal ${signal}`;
      } else {
        this.startedAt = null;
        this.lastError = null;
      }

      void this.logs.append('gateway', `Gateway exited code=${code ?? 'null'} signal=${signal ?? 'null'}`);
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
      child.once('exit', () => {
        resolve();
      });
    });
  }

  private formatCause(cause: unknown): string {
    if (cause instanceof Error) {
      return cause.message;
    }

    return String(cause);
  }
}
