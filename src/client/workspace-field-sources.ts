/**
 * Single source of truth: which disk field backs each workspace UI control.
 * Env keys match Hermes docs / .env; config paths match data/config.yaml.
 */
import type { EnvReadResult, WorkspaceConfigHints } from "../server/types";

export const UI_CONFIGURED_SECRET_PLACEHOLDER = "*****";

export function isConfiguredSecretPlaceholder(value: string): boolean {
  return value.trim() === UI_CONFIGURED_SECRET_PLACEHOLDER;
}

type EnvFieldKind = "secret" | "maskedText" | "select";

type MessagingDiscordFieldSpec =
  | { source: "config"; configPath: string }
  | { source: "env"; envKey: string; kind: EnvFieldKind };

/** Discord card + advanced (ids match messaging-tab.tsx). */
export const MESSAGING_DISCORD_FIELD_SOURCES: Record<string, MessagingDiscordFieldSpec> = {
  "messaging-discord-token": { source: "env", envKey: "DISCORD_BOT_TOKEN", kind: "secret" },
  "messaging-discord-allowed": { source: "config", configPath: "discord.allowed_users" },
  "d-adv-roles": { source: "env", envKey: "DISCORD_ALLOWED_ROLES", kind: "maskedText" },
  "d-adv-allow-ch": { source: "env", envKey: "DISCORD_ALLOWED_CHANNELS", kind: "maskedText" },
  "d-adv-free": { source: "env", envKey: "DISCORD_FREE_RESPONSE_CHANNELS", kind: "maskedText" },
  "d-adv-home": { source: "env", envKey: "DISCORD_HOME_CHANNEL", kind: "maskedText" },
  "d-adv-homen": { source: "env", envKey: "DISCORD_HOME_CHANNEL_NAME", kind: "maskedText" },
  "d-adv-proxy": { source: "env", envKey: "DISCORD_PROXY", kind: "maskedText" },
  "d-adv-cmd": { source: "env", envKey: "DISCORD_COMMAND_SYNC_POLICY", kind: "select" },
  "d-adv-reply": { source: "env", envKey: "DISCORD_REPLY_TO_MODE", kind: "select" },
  "d-adv-reqm": { source: "env", envKey: "DISCORD_REQUIRE_MENTION", kind: "select" },
  "d-adv-autoth": { source: "env", envKey: "DISCORD_AUTO_THREAD", kind: "select" },
  "d-adv-rxn": { source: "env", envKey: "DISCORD_REACTIONS", kind: "select" },
  "d-adv-ign": { source: "env", envKey: "DISCORD_IGNORED_CHANNELS", kind: "maskedText" },
  "d-adv-nothr": { source: "env", envKey: "DISCORD_NO_THREAD_CHANNELS", kind: "maskedText" },
  "d-adv-alle": { source: "env", envKey: "DISCORD_ALLOW_MENTION_EVERYONE", kind: "select" },
  "d-adv-alr": { source: "env", envKey: "DISCORD_ALLOW_MENTION_ROLES", kind: "select" },
  "d-adv-alu": { source: "env", envKey: "DISCORD_ALLOW_MENTION_USERS", kind: "select" },
  "d-adv-alk": { source: "env", envKey: "DISCORD_ALLOW_MENTION_REPLIED_USER", kind: "select" },
  "d-adv-ignm": { source: "env", envKey: "DISCORD_IGNORE_NO_MENTION", kind: "select" },
};

export const MESSAGING_SLACK_FIELD_SOURCES: Record<
  string,
  { source: "env"; envKey: string; kind: "secret" }
> = {
  "messaging-slack-bot": { source: "env", envKey: "SLACK_BOT_TOKEN", kind: "secret" },
  "messaging-slack-app": { source: "env", envKey: "SLACK_APP_TOKEN", kind: "secret" },
};

type ModelProviderFieldSpec =
  | { source: "config"; configPath: string }
  | { source: "env"; kind: "secret"; envKey: string }
  | { source: "env"; kind: "maskedText"; envKey: string }
  | { source: "env"; kind: "googleOrGeminiApiKey" };

/** Model providers tab (ids match model-providers-tab.tsx). */
export const MODEL_PROVIDER_FIELD_SOURCES: Record<string, ModelProviderFieldSpec> = {
  "mp-yaml-default": { source: "config", configPath: "model.default" },
  "mp-yaml-provider": { source: "config", configPath: "model.provider" },
  "mp-yaml-base-url": { source: "config", configPath: "model.base_url" },
  "mp-or-key": { source: "env", kind: "secret", envKey: "OPENROUTER_API_KEY" },
  "mp-or-base": { source: "env", kind: "maskedText", envKey: "OPENROUTER_BASE_URL" },
  "mp-anthropic-key": { source: "env", kind: "secret", envKey: "ANTHROPIC_API_KEY" },
  "mp-openai-key": { source: "env", kind: "secret", envKey: "OPENAI_API_KEY" },
  "mp-openai-base": { source: "env", kind: "maskedText", envKey: "OPENAI_BASE_URL" },
  "mp-google-key": { source: "env", kind: "googleOrGeminiApiKey" },
  "mp-gemini-base": { source: "env", kind: "maskedText", envKey: "GEMINI_BASE_URL" },
};

function envKeyHasNonEmptyValue(env: EnvReadResult, key: string): boolean {
  const entry = env.entries.find((e) => e.key === key);
  return entry !== undefined && entry.maskedValue !== "(empty)";
}

function syncSecretInput(elementId: string, env: EnvReadResult, key: string): void {
  const el = document.getElementById(elementId);
  if (!(el instanceof HTMLInputElement)) {
    return;
  }
  if (envKeyHasNonEmptyValue(env, key)) {
    el.value = UI_CONFIGURED_SECRET_PLACEHOLDER;
  } else {
    el.value = "";
  }
}

function syncMaskedTextInput(elementId: string, env: EnvReadResult, key: string): void {
  const el = document.getElementById(elementId);
  if (!(el instanceof HTMLInputElement)) {
    return;
  }
  if (envKeyHasNonEmptyValue(env, key)) {
    el.value = UI_CONFIGURED_SECRET_PLACEHOLDER;
  } else {
    el.value = "";
  }
}

function syncSelectFromEnv(elementId: string, env: EnvReadResult, key: string): void {
  const el = document.getElementById(elementId);
  if (!(el instanceof HTMLSelectElement)) {
    return;
  }
  const entry = env.entries.find((e) => e.key === key);
  if (!entry || entry.maskedValue === "(empty)") {
    el.value = "";
    return;
  }
  if (entry.publicValue !== undefined) {
    const v = entry.publicValue;
    const allowed = new Set(Array.from(el.options, (o) => o.value));
    el.value = allowed.has(v) ? v : "";
    return;
  }
  el.value = "";
}

function configScalarFromHints(hints: WorkspaceConfigHints, path: string): string | null {
  switch (path) {
    case "discord.allowed_users":
      return hints.discord.allowed_users;
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

function applyGoogleOrGeminiApiKeyField(env: EnvReadResult): void {
  const el = document.getElementById("mp-google-key");
  if (!(el instanceof HTMLInputElement)) {
    return;
  }
  const has =
    envKeyHasNonEmptyValue(env, "GOOGLE_API_KEY") || envKeyHasNonEmptyValue(env, "GEMINI_API_KEY");
  el.value = has ? UI_CONFIGURED_SECRET_PLACEHOLDER : "";
}

export function populateMessagingIntegrationFields(
  env: EnvReadResult,
  hints: WorkspaceConfigHints | null,
): void {
  for (const [elementId, spec] of Object.entries(MESSAGING_DISCORD_FIELD_SOURCES)) {
    if (spec.source === "config") {
      const el = document.getElementById(elementId);
      if (!(el instanceof HTMLInputElement) || hints === null) {
        continue;
      }
      el.value = configScalarFromHints(hints, spec.configPath) ?? "";
      continue;
    }
    if (spec.kind === "secret") {
      syncSecretInput(elementId, env, spec.envKey);
      continue;
    }
    if (spec.kind === "maskedText") {
      syncMaskedTextInput(elementId, env, spec.envKey);
      continue;
    }
    syncSelectFromEnv(elementId, env, spec.envKey);
  }

  for (const [elementId, spec] of Object.entries(MESSAGING_SLACK_FIELD_SOURCES)) {
    syncSecretInput(elementId, env, spec.envKey);
  }
}

export function populateModelProvidersIntegrationFields(
  env: EnvReadResult,
  hints: WorkspaceConfigHints | null,
): void {
  for (const [elementId, spec] of Object.entries(MODEL_PROVIDER_FIELD_SOURCES)) {
    if (spec.source === "config") {
      const el = document.getElementById(elementId);
      if (!(el instanceof HTMLInputElement) || hints === null) {
        continue;
      }
      el.value = configScalarFromHints(hints, spec.configPath) ?? "";
      continue;
    }
    if (spec.kind === "googleOrGeminiApiKey") {
      applyGoogleOrGeminiApiKeyField(env);
      continue;
    }
    if (spec.kind === "secret") {
      syncSecretInput(elementId, env, spec.envKey);
      continue;
    }
    syncMaskedTextInput(elementId, env, spec.envKey);
  }
}
