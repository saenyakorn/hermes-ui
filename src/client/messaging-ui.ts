import type { EnvMutationResponse, EnvReadResult } from "../server/types";
import type { ModelProvidersSavePayload } from "./api-fetcher";
import { getErrorMessage } from "./lib/errors";
import { applyModelProvidersMutationResponse } from "./model-providers-ui";
import type { HermesWorkspaceDeps } from "./workspace-deps";
import {
  isConfiguredSecretPlaceholder,
  populateMessagingIntegrationFields,
} from "./workspace-field-sources";

/**
 * Discord keys stored in data/.env (Clear removes these).
 * Allowed user IDs live in config.yaml (`discord.allowed_users`), not .env.
 */
export const MESSAGING_DISCORD_ENV_KEYS: readonly string[] = [
  "DISCORD_BOT_TOKEN",
  "DISCORD_ALLOWED_ROLES",
  "DISCORD_ALLOWED_CHANNELS",
  "DISCORD_FREE_RESPONSE_CHANNELS",
  "DISCORD_HOME_CHANNEL",
  "DISCORD_HOME_CHANNEL_NAME",
  "DISCORD_PROXY",
  "DISCORD_COMMAND_SYNC_POLICY",
  "DISCORD_REQUIRE_MENTION",
  "DISCORD_AUTO_THREAD",
  "DISCORD_REACTIONS",
  "DISCORD_IGNORED_CHANNELS",
  "DISCORD_NO_THREAD_CHANNELS",
  "DISCORD_REPLY_TO_MODE",
  "DISCORD_ALLOW_MENTION_EVERYONE",
  "DISCORD_ALLOW_MENTION_ROLES",
  "DISCORD_ALLOW_MENTION_USERS",
  "DISCORD_ALLOW_MENTION_REPLIED_USER",
  "DISCORD_IGNORE_NO_MENTION",
] as const;

export const MESSAGING_SLACK_KEYS = ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"] as const;

let messagingBusy = false;

export function renderMessagingEnvHint(env: EnvReadResult): void {
  const hint = document.getElementById("messaging-env-hint");
  if (!hint) {
    return;
  }
  const discordN = env.entries.filter((e) => e.key.startsWith("DISCORD_")).length;
  const slackN = env.entries.filter((e) => e.key.startsWith("SLACK_")).length;
  const parts: string[] = [];
  if (discordN > 0) {
    parts.push(`Discord: ${String(discordN)} DISCORD_* key(s) in .env`);
  } else {
    parts.push("Discord: no DISCORD_* in .env");
  }
  if (slackN > 0) {
    parts.push(`Slack: ${String(slackN)} SLACK_* key(s) in .env`);
  } else {
    parts.push("Slack: no SLACK_* in .env");
  }
  hint.textContent = parts.join(" · ");
}

function setMessagingStatus(message: string): void {
  const el = document.getElementById("messaging-status");
  if (el) {
    el.textContent = message;
  }
}

function updateMessagingButtons(): void {
  for (const id of [
    "messaging-save-discord",
    "messaging-save-slack",
    "messaging-clear-discord",
    "messaging-clear-slack",
  ]) {
    const button = document.getElementById(id);
    if (button instanceof HTMLButtonElement) {
      button.disabled = messagingBusy;
    }
  }
}

function setMessagingBusy(busy: boolean): void {
  messagingBusy = busy;
  updateMessagingButtons();
}

function applyMessagingMutationResponse(
  deps: HermesWorkspaceDeps,
  response: EnvMutationResponse,
  doneMessage: string,
): void {
  deps.envConfigurator.reflectGatewayAndEnvSnapshot(response.env, response.gateway);
  if (response.restart.ok) {
    setMessagingStatus(`${doneMessage} Gateway restarted.`);
    return;
  }
  setMessagingStatus(
    `${doneMessage} Gateway restart failed: ${response.restart.error ?? "Unknown error"}`,
  );
}

function readDiscordFieldsFromAdvanced(set: Record<string, string>): void {
  const root = document.getElementById("messaging-discord-advanced");
  if (root === null) {
    return;
  }
  for (const el of Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-discord-key]"),
  )) {
    const key = el.getAttribute("data-discord-key");
    if (key === null) {
      continue;
    }
    const value = el.value.trim();
    if (
      value.length > 0 &&
      !(el instanceof HTMLInputElement && isConfiguredSecretPlaceholder(el.value))
    ) {
      set[key] = value;
    }
  }
}

function readDiscordEnvAndAdvanced(): Record<string, string> {
  const set: Record<string, string> = {};
  const discordToken = document.getElementById("messaging-discord-token");
  if (
    discordToken instanceof HTMLInputElement &&
    discordToken.value.trim().length > 0 &&
    !isConfiguredSecretPlaceholder(discordToken.value)
  ) {
    set.DISCORD_BOT_TOKEN = discordToken.value.trim();
  }
  readDiscordFieldsFromAdvanced(set);
  return set;
}

function readSlackForm(): Record<string, string> {
  const set: Record<string, string> = {};
  const slackBot = document.getElementById("messaging-slack-bot");
  const slackApp = document.getElementById("messaging-slack-app");
  if (
    slackBot instanceof HTMLInputElement &&
    slackBot.value.trim().length > 0 &&
    !isConfiguredSecretPlaceholder(slackBot.value)
  ) {
    set.SLACK_BOT_TOKEN = slackBot.value.trim();
  }
  if (
    slackApp instanceof HTMLInputElement &&
    slackApp.value.trim().length > 0 &&
    !isConfiguredSecretPlaceholder(slackApp.value)
  ) {
    set.SLACK_APP_TOKEN = slackApp.value.trim();
  }
  return set;
}

function clearMessagingInputs(platform: "discord" | "slack"): void {
  if (platform === "discord") {
    for (const id of ["messaging-discord-token", "messaging-discord-allowed"]) {
      const el = document.getElementById(id);
      if (el instanceof HTMLInputElement) {
        el.value = "";
      }
    }
    const adv = document.getElementById("messaging-discord-advanced");
    if (adv !== null) {
      for (const el of Array.from(
        adv.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-discord-key]"),
      )) {
        if (el instanceof HTMLInputElement) {
          el.value = "";
        } else {
          el.selectedIndex = 0;
        }
      }
    }
    return;
  }
  for (const id of ["messaging-slack-bot", "messaging-slack-app"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
      el.value = "";
    }
  }
}

type MessagingPlatform = "discord" | "slack";

async function saveDiscordMessagingSettings(deps: HermesWorkspaceDeps): Promise<void> {
  const set = readDiscordEnvAndAdvanced();
  const allowedEl = document.getElementById("messaging-discord-allowed");
  const allowedUsers = allowedEl instanceof HTMLInputElement ? allowedEl.value : "";

  if (Object.keys(set).length === 0) {
    try {
      const hints = await deps.api.getWorkspaceConfigHints();
      if (
        allowedUsers.trim() === "" &&
        (hints.discord.allowed_users === null || hints.discord.allowed_users.trim() === "")
      ) {
        setMessagingStatus(
          "Nothing to save for Discord — enter a bot token, advanced value, or allowlist change.",
        );
        return;
      }
    } catch (cause: unknown) {
      if (allowedUsers.trim() === "") {
        setMessagingStatus(`Could not read config hints: ${getErrorMessage(cause)}`);
        return;
      }
    }
  }

  setMessagingBusy(true);
  setMessagingStatus("Saving and restarting gateway…");
  const doneMessage =
    Object.keys(set).length > 0
      ? "Discord .env settings and config.yaml allowlist updated."
      : "Discord allowlist written to config.yaml.";
  try {
    const payload: ModelProvidersSavePayload = {
      discord: { allowed_users: allowedUsers },
    };
    if (Object.keys(set).length > 0) {
      payload.env = { set };
    }
    const response = await deps.api.postModelProvidersSettings(payload);
    applyModelProvidersMutationResponse(deps, response, doneMessage, { setStatus: setMessagingStatus });
    clearMessagingInputs("discord");
  } catch (cause: unknown) {
    setMessagingStatus(`Save failed: ${getErrorMessage(cause)}`);
  } finally {
    setMessagingBusy(false);
  }
}

async function saveMessagingSettings(deps: HermesWorkspaceDeps, platform: MessagingPlatform): Promise<void> {
  if (messagingBusy) {
    return;
  }
  if (platform === "discord") {
    await saveDiscordMessagingSettings(deps);
    return;
  }

  const set = readSlackForm();
  if (Object.keys(set).length === 0) {
    setMessagingStatus(
      "Nothing to save for Slack — enter at least one value or use Clear to remove keys.",
    );
    return;
  }
  setMessagingBusy(true);
  setMessagingStatus("Saving and restarting gateway…");
  try {
    const response = await deps.api.postEnvBatch({ set });
    applyMessagingMutationResponse(deps, response, "Slack settings written to .env.");
    clearMessagingInputs(platform);
  } catch (cause: unknown) {
    setMessagingStatus(`Save failed: ${getErrorMessage(cause)}`);
  } finally {
    setMessagingBusy(false);
  }
}

async function clearMessagingPlatformKeys(
  deps: HermesWorkspaceDeps,
  platform: MessagingPlatform,
  keys: readonly string[],
  label: string,
): Promise<void> {
  if (messagingBusy) {
    return;
  }
  if (platform === "discord") {
    if (
      !window.confirm(
        `Remove Discord keys from data/.env, clear discord.allowed_users in config.yaml, and restart the gateway if it is running?`,
      )
    ) {
      return;
    }
    setMessagingBusy(true);
    setMessagingStatus("Removing keys and restarting gateway…");
    try {
      const response = await deps.api.postModelProvidersSettings({
        env: { remove: [...keys] },
        discord: { allowed_users: "" },
      });
      applyModelProvidersMutationResponse(deps, response, `${label} .env keys removed; allowlist cleared in config.yaml.`, {
        setStatus: setMessagingStatus,
      });
      clearMessagingInputs(platform);
    } catch (cause: unknown) {
      setMessagingStatus(`Clear failed: ${getErrorMessage(cause)}`);
    } finally {
      setMessagingBusy(false);
    }
    return;
  }

  if (!window.confirm(`Remove ${label} keys from data/.env and restart the gateway?`)) {
    return;
  }
  setMessagingBusy(true);
  setMessagingStatus("Removing keys and restarting gateway…");
  try {
    const response = await deps.api.postEnvBatch({ remove: [...keys] });
    applyMessagingMutationResponse(deps, response, `${label} keys removed from .env.`);
    clearMessagingInputs(platform);
  } catch (cause: unknown) {
    setMessagingStatus(`Clear failed: ${getErrorMessage(cause)}`);
  } finally {
    setMessagingBusy(false);
  }
}

export async function refreshMessagingEnvHint(deps: HermesWorkspaceDeps): Promise<void> {
  const hint = document.getElementById("messaging-env-hint");
  if (!hint) {
    return;
  }
  hint.textContent = "Loading…";
  try {
    const env = await deps.api.getEnvRead();
    let hints: import("../server/types").WorkspaceConfigHints | null = null;
    try {
      hints = await deps.api.getWorkspaceConfigHints();
    } catch {
      //
    }
    renderMessagingEnvHint(env);
    populateMessagingIntegrationFields(env, hints);
    requestAnimationFrame(() => {
      populateMessagingIntegrationFields(env, hints);
    });
  } catch (cause: unknown) {
    hint.textContent = `Could not load .env: ${getErrorMessage(cause)}`;
  }
}

export function setupMessagingPlatform(deps: HermesWorkspaceDeps): void {
  void refreshMessagingEnvHint(deps);
  updateMessagingButtons();

  const saveDiscord = document.getElementById("messaging-save-discord");
  if (saveDiscord instanceof HTMLButtonElement) {
    saveDiscord.addEventListener("click", () => {
      void saveMessagingSettings(deps, "discord");
    });
  }
  const saveSlack = document.getElementById("messaging-save-slack");
  if (saveSlack instanceof HTMLButtonElement) {
    saveSlack.addEventListener("click", () => {
      void saveMessagingSettings(deps, "slack");
    });
  }
  const clearDiscord = document.getElementById("messaging-clear-discord");
  if (clearDiscord instanceof HTMLButtonElement) {
    clearDiscord.addEventListener("click", () => {
      void clearMessagingPlatformKeys(deps, "discord", MESSAGING_DISCORD_ENV_KEYS, "Discord");
    });
  }
  const clearSlack = document.getElementById("messaging-clear-slack");
  if (clearSlack instanceof HTMLButtonElement) {
    clearSlack.addEventListener("click", () => {
      void clearMessagingPlatformKeys(deps, "slack", MESSAGING_SLACK_KEYS, "Slack");
    });
  }
}
