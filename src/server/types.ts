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
  /**
   * Unmasked value for non-secret Hermes flags (e.g. Discord boolean/enum .env keys).
   * Used by workspace UI selects only; list view still uses maskedValue.
   */
  publicValue?: string;
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

/** Non-secret `model:` keys written by the model-providers settings route. */
export type ModelYamlPatch = {
  default?: string;
  provider?: string;
  base_url?: string;
};

/** Values read from `config.yaml` for workspace UI fields (no secrets). */
export type WorkspaceConfigHints = {
  model: {
    default: string | null;
    provider: string | null;
    base_url: string | null;
  };
  discord: {
    allowed_users: string | null;
    /** Comma-separated IDs; mirrors `DISCORD_ALLOWED_CHANNELS`. */
    allowed_channels: string | null;
    /** `"true"` | `"false"`; mirrors `DISCORD_REQUIRE_MENTION`. */
    require_mention: string | null;
    free_response_channels: string | null;
    /** `"true"` | `"false"`; mirrors `DISCORD_AUTO_THREAD`. */
    auto_thread: string | null;
    /** `"true"` | `"false"`; mirrors `DISCORD_REACTIONS`. */
    reactions: string | null;
    ignored_channels: string | null;
    no_thread_channels: string | null;
    allow_mentions_everyone: string | null;
    allow_mentions_roles: string | null;
    allow_mentions_users: string | null;
    allow_mentions_replied_user: string | null;
  };
};

export type ModelProvidersMutationResponse = {
  env: EnvReadResult;
  config: ConfigSaveResult;
  restart: {
    attempted: boolean;
    ok: boolean;
    error: string | null;
  };
  gateway: GatewayStatus;
};

/** Mode passed to `hermes profile create`. */
export type ProfileCreateMode = "blank" | "clone" | "clone-all";

export type ProfileCreateInput = {
  name: string;
  mode: ProfileCreateMode;
  cloneFrom?: string;
};

export type ProfileSummary = {
  /** Profile slug (`null` represents the default profile rooted at `data/`). */
  name: string | null;
  /** Display label suitable for UI. */
  label: string;
  /** Absolute filesystem path of the profile's data directory. */
  dataDir: string;
  /** ISO timestamp of the profile directory's mtime, or `null` for the default. */
  updatedAt: string | null;
  /** True iff this profile is currently active. */
  active: boolean;
};

export type ProfileListResult = {
  active: string | null;
  profiles: ProfileSummary[];
  /** Warning surfaced when the hermes CLI is unavailable for richer metadata. */
  warning: string | null;
};

export type ProfileMutationResult = {
  list: ProfileListResult;
};

export type ProfileActivateResult = {
  active: string | null;
  list: ProfileListResult;
  restart: {
    attempted: boolean;
    ok: boolean;
    error: string | null;
  };
  gateway: GatewayStatus;
};

export type ProfileFileKind = "soul" | "memory" | "user";

export type ProfileFileReadResult = {
  profile: string | null;
  kind: ProfileFileKind;
  path: string;
  content: string;
  updatedAt: string | null;
};

export type ProfileFileWriteResult = ProfileFileReadResult & {
  saved: true;
};

export type ProfileSession = {
  profile: string | null;
  id: string;
  name: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProfileSessionListResult = {
  profile: string | null;
  sessions: ProfileSession[];
};

export type ProfileSessionGetResult = {
  profile: string | null;
  session: ProfileSession & {
    chat: string;
  };
};

export type ProfileSessionCreateInput = {
  name: string;
};

export type ProfileSessionRenameInput = {
  name: string;
};

export type ProfileSessionDeleteResult = {
  profile: string | null;
  id: string;
  deleted: true;
};
