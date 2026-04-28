/**
 * Single source of truth: which disk field backs each workspace UI control.
 * Env keys match Hermes docs / .env; config paths match data/config.yaml.
 *
 * Data flow: field map → resolve values from env (masked) + config hints → apply to DOM.
 */
import type { EnvReadResult, WorkspaceConfigHints } from "../server/types";

export const UI_CONFIGURED_SECRET_PLACEHOLDER = "*****";

export function isConfiguredSecretPlaceholder(value: string): boolean {
  return value.trim() === UI_CONFIGURED_SECRET_PLACEHOLDER;
}

type EnvFieldKind = "secret" | "maskedText" | "select" | "plainText";

type MessagingDiscordFieldSpec =
  | { source: "config"; configPath: string }
  | { source: "env"; envKey: string; kind: EnvFieldKind };

/**
 * Single spec or ordered list (Hermes: .env overrides config.yaml when both are set).
 * YAML mirrors: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord#config-file-configyaml
 */
export type MessagingDiscordFieldEntry =
  | MessagingDiscordFieldSpec
  | readonly MessagingDiscordFieldSpec[];

/** Discord card + advanced (ids match messaging-tab.tsx). */
export const MESSAGING_DISCORD_FIELD_SOURCES: Record<string, MessagingDiscordFieldEntry> = {
  /** Credential: .env only (no config.yaml mirror). */
  "messaging-discord-token": {
    source: "env",
    envKey: "DISCORD_BOT_TOKEN",
    kind: "secret",
  },
  /** DISCORD_ALLOWED_USERS (.env) wins over discord.allowed_users (config.yaml). */
  "messaging-discord-allowed": [
    { source: "config", configPath: "discord.allowed_users" },
    { source: "env", envKey: "DISCORD_ALLOWED_USERS", kind: "plainText" },
  ],
  /** Role allowlist: .env only. */
  "d-adv-roles": {
    source: "env",
    envKey: "DISCORD_ALLOWED_ROLES",
    kind: "maskedText",
  },
  "d-adv-allow-ch": [
    { source: "config", configPath: "discord.allowed_channels" },
    { source: "env", envKey: "DISCORD_ALLOWED_CHANNELS", kind: "maskedText" },
  ],
  "d-adv-free": [
    { source: "config", configPath: "discord.free_response_channels" },
    {
      source: "env",
      envKey: "DISCORD_FREE_RESPONSE_CHANNELS",
      kind: "maskedText",
    },
  ],
  /** Home channel: .env only. */
  "d-adv-home": {
    source: "env",
    envKey: "DISCORD_HOME_CHANNEL",
    kind: "maskedText",
  },
  "d-adv-homen": {
    source: "env",
    envKey: "DISCORD_HOME_CHANNEL_NAME",
    kind: "maskedText",
  },
  "d-adv-proxy": { source: "env", envKey: "DISCORD_PROXY", kind: "maskedText" },
  "d-adv-cmd": {
    source: "env",
    envKey: "DISCORD_COMMAND_SYNC_POLICY",
    kind: "select",
  },
  "d-adv-reply": {
    source: "env",
    envKey: "DISCORD_REPLY_TO_MODE",
    kind: "select",
  },
  "d-adv-reqm": [
    { source: "config", configPath: "discord.require_mention" },
    { source: "env", envKey: "DISCORD_REQUIRE_MENTION", kind: "select" },
  ],
  "d-adv-autoth": [
    { source: "config", configPath: "discord.auto_thread" },
    { source: "env", envKey: "DISCORD_AUTO_THREAD", kind: "select" },
  ],
  "d-adv-rxn": [
    { source: "config", configPath: "discord.reactions" },
    { source: "env", envKey: "DISCORD_REACTIONS", kind: "select" },
  ],
  "d-adv-ign": [
    { source: "config", configPath: "discord.ignored_channels" },
    { source: "env", envKey: "DISCORD_IGNORED_CHANNELS", kind: "maskedText" },
  ],
  "d-adv-nothr": [
    { source: "config", configPath: "discord.no_thread_channels" },
    { source: "env", envKey: "DISCORD_NO_THREAD_CHANNELS", kind: "maskedText" },
  ],
  "d-adv-alle": [
    { source: "config", configPath: "discord.allow_mentions.everyone" },
    { source: "env", envKey: "DISCORD_ALLOW_MENTION_EVERYONE", kind: "select" },
  ],
  "d-adv-alr": [
    { source: "config", configPath: "discord.allow_mentions.roles" },
    { source: "env", envKey: "DISCORD_ALLOW_MENTION_ROLES", kind: "select" },
  ],
  "d-adv-alu": [
    { source: "config", configPath: "discord.allow_mentions.users" },
    { source: "env", envKey: "DISCORD_ALLOW_MENTION_USERS", kind: "select" },
  ],
  "d-adv-alk": [
    { source: "config", configPath: "discord.allow_mentions.replied_user" },
    {
      source: "env",
      envKey: "DISCORD_ALLOW_MENTION_REPLIED_USER",
      kind: "select",
    },
  ],
  /** Documented as .env toggle; no discord.* mirror in Hermes config.yaml. */
  "d-adv-ignm": {
    source: "env",
    envKey: "DISCORD_IGNORE_NO_MENTION",
    kind: "select",
  },
};

export const MESSAGING_SLACK_FIELD_SOURCES: Record<
  string,
  { source: "env"; envKey: string; kind: "secret" }
> = {
  "messaging-slack-bot": {
    source: "env",
    envKey: "SLACK_BOT_TOKEN",
    kind: "secret",
  },
  "messaging-slack-app": {
    source: "env",
    envKey: "SLACK_APP_TOKEN",
    kind: "secret",
  },
};

/** One backing source; earlier entries in the field's array win over later ones. */
export type ModelProviderFieldSource =
  | { source: "config"; configPath: string }
  | { source: "env"; kind: "secret"; envKey: string }
  | { source: "env"; kind: "maskedText"; envKey: string };

export type ModelProviderName = "openrouter" | "anthropic" | "openai" | "gemini";

/** Model providers tab (ids match model-providers-tab.tsx). */
export const MODEL_PROVIDER_FIELD_SOURCES: Record<string, readonly ModelProviderFieldSource[]> = {
  "mp-yaml-default": [{ source: "config", configPath: "model.default" }],
  "mp-yaml-provider": [{ source: "config", configPath: "model.provider" }],
  "mp-yaml-base-url": [{ source: "config", configPath: "model.base_url" }],
  "mp-or-key": [{ source: "env", kind: "secret", envKey: "OPENROUTER_API_KEY" }],
  "mp-or-base": [{ source: "env", kind: "maskedText", envKey: "OPENROUTER_BASE_URL" }],
  "mp-anthropic-key": [{ source: "env", kind: "secret", envKey: "ANTHROPIC_API_KEY" }],
  "mp-openai-key": [{ source: "env", kind: "secret", envKey: "OPENAI_API_KEY" }],
  "mp-openai-base": [{ source: "env", kind: "maskedText", envKey: "OPENAI_BASE_URL" }],
  "mp-google-key": [
    { source: "env", kind: "secret", envKey: "GOOGLE_API_KEY" },
    { source: "env", kind: "secret", envKey: "GEMINI_API_KEY" },
  ],
  "mp-gemini-base": [{ source: "env", kind: "maskedText", envKey: "GEMINI_BASE_URL" }],
};

const MODEL_PROVIDER_ORDER: readonly ModelProviderName[] = [
  "openrouter",
  "anthropic",
  "openai",
  "gemini",
];

function modelProviderNameFromEnvKey(envKey: string): ModelProviderName | null {
  if (envKey.startsWith("OPENROUTER_")) {
    return "openrouter";
  }
  if (envKey.startsWith("ANTHROPIC_")) {
    return "anthropic";
  }
  if (envKey.startsWith("OPENAI_")) {
    return "openai";
  }
  if (envKey.startsWith("GOOGLE_") || envKey.startsWith("GEMINI_")) {
    return "gemini";
  }
  return null;
}

function buildModelProviderEnvKeysByProvider(): Readonly<Record<ModelProviderName, readonly string[]>> {
  const perProvider = new Map<ModelProviderName, string[]>(
    MODEL_PROVIDER_ORDER.map((provider) => [provider, []]),
  );
  for (const specs of Object.values(MODEL_PROVIDER_FIELD_SOURCES)) {
    for (const spec of specs) {
      if (spec.source !== "env") {
        continue;
      }
      const provider = modelProviderNameFromEnvKey(spec.envKey);
      if (provider === null) {
        continue;
      }
      const providerKeys = perProvider.get(provider);
      if (!providerKeys || providerKeys.includes(spec.envKey)) {
        continue;
      }
      providerKeys.push(spec.envKey);
    }
  }
  return Object.fromEntries(
    MODEL_PROVIDER_ORDER.map((provider) => [provider, Object.freeze([...(perProvider.get(provider) ?? [])])]),
  ) as Readonly<Record<ModelProviderName, readonly string[]>>;
}

/**
 * Provider-level env key groups derived from MODEL_PROVIDER_FIELD_SOURCES.
 * Used by model-providers UI flows (hints, clear actions) so field mapping stays canonical.
 */
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
  if (entry.publicValue !== undefined) {
    return entry.publicValue;
  }
  return "";
}

function isDiscordFieldSpecList(
  entry: MessagingDiscordFieldEntry,
): entry is readonly MessagingDiscordFieldSpec[] {
  return Array.isArray(entry);
}

function normalizeDiscordFieldEntry(
  entry: MessagingDiscordFieldEntry,
): readonly MessagingDiscordFieldSpec[] {
  if (isDiscordFieldSpecList(entry)) {
    return entry;
  }
  return [entry];
}

/**
 * Hermes precedence: env vars override config.yaml. Env-backed values are applied first.
 */
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
      if (envKeyHasNonEmptyValue(env, spec.envKey)) {
        return placeholderIfEnvKeySet(env, spec.envKey);
      }
    } else if (spec.kind === "plainText") {
      const v = selectValueFromEnv(env, spec.envKey);
      if (v !== "") {
        return v;
      }
    } else {
      const v = selectValueFromEnv(env, spec.envKey);
      if (v !== "") {
        return v;
      }
    }
  }

  for (const spec of configSpecs) {
    const v = resolveConfigBackedInput(hints, spec.configPath);
    if (v !== undefined) {
      return v;
    }
  }

  const loneEnvSpec = envSpecs.length === 1 ? envSpecs[0] : undefined;
  if (loneEnvSpec?.kind === "select") {
    return selectValueFromEnv(env, loneEnvSpec.envKey);
  }

  if (envSpecs.some((s) => s.kind === "maskedText" || s.kind === "secret")) {
    if (configSpecs.length === 0) {
      return "";
    }
    if (hints === null) {
      return undefined;
    }
    return "";
  }

  if (loneEnvSpec?.kind === "plainText") {
    if (configSpecs.length > 0 && hints === null) {
      return undefined;
    }
    return selectValueFromEnv(env, loneEnvSpec.envKey);
  }

  if (configSpecs.length > 0 && hints === null) {
    return undefined;
  }

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
  if (hints === null) {
    return undefined;
  }
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
      const v = resolveConfigBackedInput(hints, spec.configPath);
      if (v !== undefined) {
        return v;
      }
      continue;
    }
    sawEnvSource = true;
    if (envKeyHasNonEmptyValue(env, spec.envKey)) {
      return UI_CONFIGURED_SECRET_PLACEHOLDER;
    }
  }
  if (sawEnvSource) {
    return "";
  }
  if (sawConfigSource && hints === null) {
    return undefined;
  }
  return "";
}

/**
 * Pure: element id → value to show (undefined means leave the control unchanged).
 */
export function resolveMessagingIntegrationFieldValues(
  env: EnvReadResult,
  hints: WorkspaceConfigHints | null,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [elementId, entry] of Object.entries(MESSAGING_DISCORD_FIELD_SOURCES)) {
    const resolved = resolveDiscordWorkspaceFieldValue(
      env,
      hints,
      normalizeDiscordFieldEntry(entry),
    );
    if (resolved !== undefined) {
      out[elementId] = resolved;
    }
  }
  for (const [elementId, spec] of Object.entries(MESSAGING_SLACK_FIELD_SOURCES)) {
    out[elementId] = placeholderIfEnvKeySet(env, spec.envKey);
  }
  return out;
}

/**
 * Pure: element id → value to show (undefined means leave the control unchanged).
 */
export function resolveModelProviderIntegrationFieldValues(
  env: EnvReadResult,
  hints: WorkspaceConfigHints | null,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [elementId, specs] of Object.entries(MODEL_PROVIDER_FIELD_SOURCES)) {
    out[elementId] = resolveModelProviderFieldFromSources(env, hints, specs);
  }
  return out;
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

/**
 * Writes resolved values to the DOM. Skips undefined entries and missing elements.
 */
export function applyIntegrationFieldValues(values: IntegrationFieldValues): void {
  for (const [elementId, value] of Object.entries(values)) {
    if (value === undefined) {
      continue;
    }
    const el = document.getElementById(elementId);
    if (el instanceof HTMLSelectElement) {
      const allowed = new Set(Array.from(el.options, (o) => o.value));
      el.value = allowed.has(value) ? value : "";
      continue;
    }
    if (el instanceof HTMLInputElement) {
      el.value = value;
    }
  }
}

export function populateMessagingIntegrationFields(
  env: EnvReadResult,
  hints: WorkspaceConfigHints | null,
): void {
  applyIntegrationFieldValues(resolveMessagingIntegrationFieldValues(env, hints));
}

export function populateModelProvidersIntegrationFields(
  env: EnvReadResult,
  hints: WorkspaceConfigHints | null,
): void {
  applyIntegrationFieldValues(resolveModelProviderIntegrationFieldValues(env, hints));
}

/** Messaging + model providers in one resolve/apply (single DOM pass per call). */
export function populateAllWorkspaceIntegrationFields(
  env: EnvReadResult,
  hints: WorkspaceConfigHints | null,
): void {
  applyIntegrationFieldValues(resolveAllWorkspaceIntegrationFieldValues(env, hints));
}

/**
 * Password managers may inject values after first paint; a second pass matches prior behavior.
 */
export function runIntegrationPopulateWithSecondPass(populate: () => void): void {
  populate();
  requestAnimationFrame(populate);
}

export function populateMessagingIntegrationFieldsWithSecondPass(
  env: EnvReadResult,
  hints: WorkspaceConfigHints | null,
): void {
  runIntegrationPopulateWithSecondPass(() => populateMessagingIntegrationFields(env, hints));
}
