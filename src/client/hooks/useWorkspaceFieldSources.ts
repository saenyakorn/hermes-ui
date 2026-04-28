import type { EnvReadResult, WorkspaceConfigHints } from "../../server/types";

export const UI_CONFIGURED_SECRET_PLACEHOLDER = "*****";

export function isConfiguredSecretPlaceholder(value: string): boolean {
  return value.trim() === UI_CONFIGURED_SECRET_PLACEHOLDER;
}

type EnvFieldKind = "secret" | "maskedText" | "select" | "plainText";

type MessagingDiscordFieldSpec =
  | { source: "config"; configPath: string }
  | { source: "env"; envKey: string; kind: EnvFieldKind };

export type MessagingDiscordFieldEntry =
  | MessagingDiscordFieldSpec
  | readonly MessagingDiscordFieldSpec[];

export const MESSAGING_DISCORD_FIELD_SOURCES: Record<string, MessagingDiscordFieldEntry> = {
  "discord-bot-token": {
    source: "env",
    envKey: "DISCORD_BOT_TOKEN",
    kind: "secret",
  },
  "discord-allowed-users": [
    { source: "config", configPath: "discord.allowed_users" },
    { source: "env", envKey: "DISCORD_ALLOWED_USERS", kind: "plainText" },
  ],
  "discord-advanced-allowed-roles": {
    source: "env",
    envKey: "DISCORD_ALLOWED_ROLES",
    kind: "maskedText",
  },
  "discord-advanced-allowed-channels": [
    { source: "config", configPath: "discord.allowed_channels" },
    { source: "env", envKey: "DISCORD_ALLOWED_CHANNELS", kind: "maskedText" },
  ],
  "discord-advanced-free-response-channels": [
    { source: "config", configPath: "discord.free_response_channels" },
    { source: "env", envKey: "DISCORD_FREE_RESPONSE_CHANNELS", kind: "maskedText" },
  ],
  "discord-advanced-home-channel": {
    source: "env",
    envKey: "DISCORD_HOME_CHANNEL",
    kind: "maskedText",
  },
  "discord-advanced-home-channel-name": {
    source: "env",
    envKey: "DISCORD_HOME_CHANNEL_NAME",
    kind: "maskedText",
  },
  "discord-advanced-proxy": { source: "env", envKey: "DISCORD_PROXY", kind: "maskedText" },
  "discord-advanced-command-sync-policy": {
    source: "env",
    envKey: "DISCORD_COMMAND_SYNC_POLICY",
    kind: "select",
  },
  "discord-advanced-reply-mode": { source: "env", envKey: "DISCORD_REPLY_TO_MODE", kind: "select" },
  "discord-advanced-require-mention": [
    { source: "config", configPath: "discord.require_mention" },
    { source: "env", envKey: "DISCORD_REQUIRE_MENTION", kind: "select" },
  ],
  "discord-advanced-auto-thread": [
    { source: "config", configPath: "discord.auto_thread" },
    { source: "env", envKey: "DISCORD_AUTO_THREAD", kind: "select" },
  ],
  "discord-advanced-reactions": [
    { source: "config", configPath: "discord.reactions" },
    { source: "env", envKey: "DISCORD_REACTIONS", kind: "select" },
  ],
  "discord-advanced-ignored-channels": [
    { source: "config", configPath: "discord.ignored_channels" },
    { source: "env", envKey: "DISCORD_IGNORED_CHANNELS", kind: "maskedText" },
  ],
  "discord-advanced-no-thread-channels": [
    { source: "config", configPath: "discord.no_thread_channels" },
    { source: "env", envKey: "DISCORD_NO_THREAD_CHANNELS", kind: "maskedText" },
  ],
  "discord-advanced-allow-mention-everyone": [
    { source: "config", configPath: "discord.allow_mentions.everyone" },
    { source: "env", envKey: "DISCORD_ALLOW_MENTION_EVERYONE", kind: "select" },
  ],
  "discord-advanced-allow-mention-roles": [
    { source: "config", configPath: "discord.allow_mentions.roles" },
    { source: "env", envKey: "DISCORD_ALLOW_MENTION_ROLES", kind: "select" },
  ],
  "discord-advanced-allow-mention-users": [
    { source: "config", configPath: "discord.allow_mentions.users" },
    { source: "env", envKey: "DISCORD_ALLOW_MENTION_USERS", kind: "select" },
  ],
  "discord-advanced-allow-mention-replied-user": [
    { source: "config", configPath: "discord.allow_mentions.replied_user" },
    { source: "env", envKey: "DISCORD_ALLOW_MENTION_REPLIED_USER", kind: "select" },
  ],
  "discord-advanced-ignore-no-mention": {
    source: "env",
    envKey: "DISCORD_IGNORE_NO_MENTION",
    kind: "select",
  },
};

export const MESSAGING_SLACK_FIELD_SOURCES: Record<
  string,
  { source: "env"; envKey: string; kind: "secret" }
> = {
  "slack-bot-token": { source: "env", envKey: "SLACK_BOT_TOKEN", kind: "secret" },
  "slack-app-token": { source: "env", envKey: "SLACK_APP_TOKEN", kind: "secret" },
};

export type ModelProviderFieldSource =
  | { source: "config"; configPath: string }
  | { source: "env"; kind: "secret"; envKey: string }
  | { source: "env"; kind: "maskedText"; envKey: string };

export type ModelProviderName = "openrouter" | "anthropic" | "openai" | "gemini";

export const MODEL_PROVIDER_FIELD_SOURCES: Record<string, readonly ModelProviderFieldSource[]> = {
  "model-provider-default-model-id": [{ source: "config", configPath: "model.default" }],
  "model-provider-default-model-provider": [{ source: "config", configPath: "model.provider" }],
  "model-provider-default-model-base-url": [{ source: "config", configPath: "model.base_url" }],
  "model-provider-openrouter-api-key": [
    { source: "env", kind: "secret", envKey: "OPENROUTER_API_KEY" },
  ],
  "model-provider-openrouter-base-url": [
    { source: "env", kind: "maskedText", envKey: "OPENROUTER_BASE_URL" },
  ],
  "model-provider-anthropic-api-key": [
    { source: "env", kind: "secret", envKey: "ANTHROPIC_API_KEY" },
  ],
  "model-provider-openai-api-key": [{ source: "env", kind: "secret", envKey: "OPENAI_API_KEY" }],
  "model-provider-openai-base-url": [
    { source: "env", kind: "maskedText", envKey: "OPENAI_BASE_URL" },
  ],
  "model-provider-google-api-key": [
    { source: "env", kind: "secret", envKey: "GOOGLE_API_KEY" },
    { source: "env", kind: "secret", envKey: "GEMINI_API_KEY" },
  ],
  "model-provider-gemini-base-url": [
    { source: "env", kind: "maskedText", envKey: "GEMINI_BASE_URL" },
  ],
};

const MODEL_PROVIDER_ORDER: readonly ModelProviderName[] = [
  "openrouter",
  "anthropic",
  "openai",
  "gemini",
];

function modelProviderNameFromEnvKey(envKey: string): ModelProviderName | null {
  if (envKey.startsWith("OPENROUTER_")) return "openrouter";
  if (envKey.startsWith("ANTHROPIC_")) return "anthropic";
  if (envKey.startsWith("OPENAI_")) return "openai";
  if (envKey.startsWith("GOOGLE_") || envKey.startsWith("GEMINI_")) return "gemini";
  return null;
}

function buildModelProviderEnvKeysByProvider(): Readonly<
  Record<ModelProviderName, readonly string[]>
> {
  const perProvider = new Map<ModelProviderName, string[]>(
    MODEL_PROVIDER_ORDER.map((provider) => [provider, []]),
  );
  for (const specs of Object.values(MODEL_PROVIDER_FIELD_SOURCES)) {
    for (const spec of specs) {
      if (spec.source !== "env") continue;
      const provider = modelProviderNameFromEnvKey(spec.envKey);
      if (provider === null) continue;
      const providerKeys = perProvider.get(provider);
      if (!providerKeys || providerKeys.includes(spec.envKey)) continue;
      providerKeys.push(spec.envKey);
    }
  }
  return Object.fromEntries(
    MODEL_PROVIDER_ORDER.map((provider) => [
      provider,
      Object.freeze([...(perProvider.get(provider) ?? [])]),
    ]),
  ) as Readonly<Record<ModelProviderName, readonly string[]>>;
}

export const MODEL_PROVIDER_ENV_KEYS_BY_PROVIDER = buildModelProviderEnvKeysByProvider();

export type IntegrationFieldValues = Readonly<Record<string, string | undefined>>;

function envKeyHasNonEmptyValue(env: EnvReadResult, key: string): boolean {
  const entry = env.entries.find((e) => e.key === key);
  return entry !== undefined && entry.maskedValue !== "(empty)";
}

function placeholderIfEnvKeySet(env: EnvReadResult, key: string): string {
  return envKeyHasNonEmptyValue(env, key) ? UI_CONFIGURED_SECRET_PLACEHOLDER : "";
}

function selectValueFromEnv(env: EnvReadResult, key: string): string {
  const entry = env.entries.find((e) => e.key === key);
  if (!entry || entry.maskedValue === "(empty)") {
    return "";
  }
  return entry.publicValue ?? "";
}

function isDiscordFieldSpecList(
  entry: MessagingDiscordFieldEntry,
): entry is readonly MessagingDiscordFieldSpec[] {
  return Array.isArray(entry);
}

function normalizeDiscordFieldEntry(
  entry: MessagingDiscordFieldEntry,
): readonly MessagingDiscordFieldSpec[] {
  return isDiscordFieldSpecList(entry) ? entry : [entry];
}

function resolveDiscordWorkspaceFieldValue(
  env: EnvReadResult,
  hints: WorkspaceConfigHints | null,
  specs: readonly MessagingDiscordFieldSpec[],
): string | undefined {
  const envSpecs = specs.filter(
    (s): s is Extract<MessagingDiscordFieldSpec, { source: "env" }> => s.source === "env",
  );
  const configSpecs = specs.filter(
    (s): s is Extract<MessagingDiscordFieldSpec, { source: "config" }> => s.source === "config",
  );

  for (const spec of envSpecs) {
    if (spec.kind === "secret" || spec.kind === "maskedText") {
      if (envKeyHasNonEmptyValue(env, spec.envKey)) return placeholderIfEnvKeySet(env, spec.envKey);
    } else {
      const value = selectValueFromEnv(env, spec.envKey);
      if (value !== "") return value;
    }
  }

  for (const spec of configSpecs) {
    const value = resolveConfigBackedInput(hints, spec.configPath);
    if (value !== undefined) return value;
  }

  const loneEnvSpec = envSpecs.length === 1 ? envSpecs[0] : undefined;
  if (loneEnvSpec?.kind === "select") return selectValueFromEnv(env, loneEnvSpec.envKey);

  if (envSpecs.some((s) => s.kind === "maskedText" || s.kind === "secret")) {
    if (configSpecs.length === 0) return "";
    if (hints === null) return undefined;
    return "";
  }

  if (loneEnvSpec?.kind === "plainText") {
    if (configSpecs.length > 0 && hints === null) return undefined;
    return selectValueFromEnv(env, loneEnvSpec.envKey);
  }

  if (configSpecs.length > 0 && hints === null) return undefined;
  return undefined;
}

function configScalarFromHints(hints: WorkspaceConfigHints, path: string): string | null {
  switch (path) {
    case "discord.allowed_users":
      return hints.discord.allowed_users;
    case "discord.allowed_channels":
      return hints.discord.allowed_channels;
    case "discord.require_mention":
      return hints.discord.require_mention;
    case "discord.free_response_channels":
      return hints.discord.free_response_channels;
    case "discord.auto_thread":
      return hints.discord.auto_thread;
    case "discord.reactions":
      return hints.discord.reactions;
    case "discord.ignored_channels":
      return hints.discord.ignored_channels;
    case "discord.no_thread_channels":
      return hints.discord.no_thread_channels;
    case "discord.allow_mentions.everyone":
      return hints.discord.allow_mentions_everyone;
    case "discord.allow_mentions.roles":
      return hints.discord.allow_mentions_roles;
    case "discord.allow_mentions.users":
      return hints.discord.allow_mentions_users;
    case "discord.allow_mentions.replied_user":
      return hints.discord.allow_mentions_replied_user;
    case "model.default":
      return hints.model.default;
    case "model.provider":
      return hints.model.provider;
    case "model.base_url":
      return hints.model.base_url;
    default:
      return null;
  }
}

function resolveConfigBackedInput(
  hints: WorkspaceConfigHints | null,
  configPath: string,
): string | undefined {
  if (hints === null) return undefined;
  return configScalarFromHints(hints, configPath) ?? "";
}

function resolveModelProviderFieldFromSources(
  env: EnvReadResult,
  hints: WorkspaceConfigHints | null,
  specs: readonly ModelProviderFieldSource[],
): string | undefined {
  let sawConfigSource = false;
  let sawEnvSource = false;
  for (const spec of specs) {
    if (spec.source === "config") {
      sawConfigSource = true;
      const value = resolveConfigBackedInput(hints, spec.configPath);
      if (value !== undefined) return value;
      continue;
    }
    sawEnvSource = true;
    if (envKeyHasNonEmptyValue(env, spec.envKey)) {
      return UI_CONFIGURED_SECRET_PLACEHOLDER;
    }
  }
  if (sawEnvSource) return "";
  if (sawConfigSource && hints === null) return undefined;
  return "";
}

export function resolveMessagingIntegrationFieldValues(
  env: EnvReadResult,
  hints: WorkspaceConfigHints | null,
): Record<string, string | undefined> {
  const output: Record<string, string | undefined> = {};
  for (const [elementId, entry] of Object.entries(MESSAGING_DISCORD_FIELD_SOURCES)) {
    const resolved = resolveDiscordWorkspaceFieldValue(
      env,
      hints,
      normalizeDiscordFieldEntry(entry),
    );
    if (resolved !== undefined) output[elementId] = resolved;
  }
  for (const [elementId, spec] of Object.entries(MESSAGING_SLACK_FIELD_SOURCES)) {
    output[elementId] = placeholderIfEnvKeySet(env, spec.envKey);
  }
  return output;
}

export function resolveModelProviderIntegrationFieldValues(
  env: EnvReadResult,
  hints: WorkspaceConfigHints | null,
): Record<string, string | undefined> {
  const output: Record<string, string | undefined> = {};
  for (const [elementId, specs] of Object.entries(MODEL_PROVIDER_FIELD_SOURCES)) {
    output[elementId] = resolveModelProviderFieldFromSources(env, hints, specs);
  }
  return output;
}

export function resolveAllWorkspaceIntegrationFieldValues(
  env: EnvReadResult,
  hints: WorkspaceConfigHints | null,
): Record<string, string | undefined> {
  return {
    ...resolveMessagingIntegrationFieldValues(env, hints),
    ...resolveModelProviderIntegrationFieldValues(env, hints),
  };
}
