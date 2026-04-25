export type GatewayProcessState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'crashed';

export type GatewayHealthState =
  | 'healthy'
  | 'unhealthy'
  | 'unreachable'
  | 'unknown';

export type AppEnv = {
  adminUsername: string;
  adminPassword: string;
  port: number;
};

export type GatewayStatus = {
  state: GatewayProcessState;
  health: GatewayHealthState;
  pid: number | null;
  cwd: string;
  startedAt: string | null;
  uptimeMs: number | null;
  exitCode: number | null;
  lastError: string | null;
  logWarning: string | null;
};

export type LogTail = {
  lines: string[];
  warning: string | null;
};

export type JsonError = {
  error: string;
};
