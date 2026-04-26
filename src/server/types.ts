export type GatewayProcessState = "stopped" | "starting" | "running" | "stopping" | "crashed";

export type GatewayHealthState = "healthy" | "unhealthy" | "unreachable" | "unknown";

export type AppLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

export type AppEnv = {
  adminUsername: string;
  adminPassword: string;
  logLevel: AppLogLevel;
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

export type ConfigValidationIssue = {
  message: string;
  path: string | null;
};

export type ConfigReadResult = {
  path: string;
  content: string;
  updatedAt: string | null;
  validation: {
    ok: boolean;
    issues: ConfigValidationIssue[];
  };
};

export type ConfigSaveResult = ConfigReadResult & {
  saved: boolean;
};

export type ConfigSaveResponse = {
  config: ConfigSaveResult;
  restart: {
    attempted: boolean;
    ok: boolean;
    error: string | null;
  };
  gateway: GatewayStatus;
};

export type EnvEntry = {
  key: string;
  maskedValue: string;
};

export type EnvReadResult = {
  path: string;
  updatedAt: string | null;
  entries: EnvEntry[];
};

export type EnvMutationResponse = {
  env: EnvReadResult;
  restart: {
    attempted: boolean;
    ok: boolean;
    error: string | null;
  };
  gateway: GatewayStatus;
};
