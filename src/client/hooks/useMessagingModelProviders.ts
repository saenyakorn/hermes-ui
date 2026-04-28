import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { ModelProvidersSavePayload } from "../api-fetcher";
import { ApiFetcher } from "../api-fetcher";
import { dispatchEnvReloadRequest, dispatchEnvSnapshot, dispatchGatewayStatus } from "../lib/event";
import {
  isConfiguredSecretPlaceholder,
  MODEL_PROVIDER_ENV_KEYS_BY_PROVIDER,
} from "./workspaceFieldSources";
import { useWorkspaceIntegrations } from "./useWorkspaceIntegrations";

type SaveFn = () => Promise<void>;

export function useMessagingModelProviders(): {
  fieldValues: Record<string, string | undefined>;
  setFieldValue: (id: string, value: string) => void;
  messagingHint: string;
  modelProvidersHint: string;
  messagingStatus: string;
  modelProvidersStatus: string;
  messagingBusy: boolean;
  modelProvidersBusy: boolean;
  saveDiscord: SaveFn;
  saveSlack: SaveFn;
  clearDiscord: SaveFn;
  clearSlack: SaveFn;
  saveYamlModel: SaveFn;
  saveOpenRouter: SaveFn;
  clearOpenRouter: SaveFn;
  saveAnthropic: SaveFn;
  clearAnthropic: SaveFn;
  saveOpenAi: SaveFn;
  clearOpenAi: SaveFn;
  saveGemini: SaveFn;
  clearGemini: SaveFn;
} {
  const api = useMemo(() => new ApiFetcher(), []);
  const { fieldValues, refresh, setFieldValue, setFieldValues } = useWorkspaceIntegrations();
  const [messagingHint, setMessagingHint] = useState("Loading…");
  const [modelProvidersHint, setModelProvidersHint] = useState("Loading…");
  const [messagingStatus, setMessagingStatus] = useState("Ready.");
  const [modelProvidersStatus, setModelProvidersStatus] = useState("Ready.");
  const [messagingBusy, setMessagingBusy] = useState(false);
  const [modelProvidersBusy, setModelProvidersBusy] = useState(false);

  const refreshHints = useCallback(async () => {
    const result = await refresh();
    if (!result) {
      setMessagingHint("Could not load .env");
      setModelProvidersHint("Could not load .env");
      return;
    }
    const discordN = result.env.entries.filter((entry) => entry.key.startsWith("DISCORD_")).length;
    const slackN = result.env.entries.filter((entry) => entry.key.startsWith("SLACK_")).length;
    setMessagingHint(
      `${discordN > 0 ? `Discord: ${String(discordN)} DISCORD_* key(s) in .env` : "Discord: no DISCORD_* in .env"} · ${
        slackN > 0 ? `Slack: ${String(slackN)} SLACK_* key(s) in .env` : "Slack: no SLACK_* in .env"
      }`,
    );
    const providerLine = (label: string, keys: readonly string[]) => {
      const count = keys.filter((key) =>
        result.env.entries.some((entry) => entry.key === key),
      ).length;
      return count > 0 ? `${label}: ${String(count)} key(s)` : `${label}: no tracked keys`;
    };
    setModelProvidersHint(
      [
        providerLine("OpenRouter", MODEL_PROVIDER_ENV_KEYS_BY_PROVIDER.openrouter),
        providerLine("Claude", MODEL_PROVIDER_ENV_KEYS_BY_PROVIDER.anthropic),
        providerLine("OpenAI", MODEL_PROVIDER_ENV_KEYS_BY_PROVIDER.openai),
        providerLine("Gemini", MODEL_PROVIDER_ENV_KEYS_BY_PROVIDER.gemini),
      ].join(" · "),
    );
  }, [refresh]);

  useSyncExternalStore(
    useCallback(
      (onStoreChange) => {
        void refreshHints().finally(onStoreChange);
        return () => undefined;
      },
      [refreshHints],
    ),
    () => 0,
    () => 0,
  );

  const applyMutation = useCallback(
    async (
      payload: ModelProvidersSavePayload,
      doneMessage: string,
      setStatus: (message: string) => void,
    ) => {
      const response = await api.postModelProvidersSettings(payload);
      dispatchGatewayStatus(response.gateway);
      dispatchEnvSnapshot({ env: response.env, gateway: response.gateway });
      dispatchEnvReloadRequest();
      await refreshHints();
      if (response.restart.ok) {
        setStatus(`${doneMessage} Gateway restarted.`);
        return;
      }
      if (!response.restart.attempted) {
        setStatus(`${doneMessage} Gateway was stopped; no restart performed.`);
        return;
      }
      setStatus(
        `${doneMessage} Gateway restart failed: ${response.restart.error ?? "Unknown error"}`,
      );
    },
    [api, refreshHints],
  );

  const saveDiscord = useCallback(async () => {
    if (messagingBusy) {
      return;
    }
    const set: Record<string, string> = {};
    const discordFields = [
      ["messaging-discord-token", "DISCORD_BOT_TOKEN"],
      ["d-adv-roles", "DISCORD_ALLOWED_ROLES"],
      ["d-adv-allow-ch", "DISCORD_ALLOWED_CHANNELS"],
      ["d-adv-free", "DISCORD_FREE_RESPONSE_CHANNELS"],
      ["d-adv-home", "DISCORD_HOME_CHANNEL"],
      ["d-adv-homen", "DISCORD_HOME_CHANNEL_NAME"],
      ["d-adv-proxy", "DISCORD_PROXY"],
      ["d-adv-cmd", "DISCORD_COMMAND_SYNC_POLICY"],
      ["d-adv-reply", "DISCORD_REPLY_TO_MODE"],
      ["d-adv-reqm", "DISCORD_REQUIRE_MENTION"],
      ["d-adv-autoth", "DISCORD_AUTO_THREAD"],
      ["d-adv-rxn", "DISCORD_REACTIONS"],
      ["d-adv-ign", "DISCORD_IGNORED_CHANNELS"],
      ["d-adv-nothr", "DISCORD_NO_THREAD_CHANNELS"],
      ["d-adv-alle", "DISCORD_ALLOW_MENTION_EVERYONE"],
      ["d-adv-alr", "DISCORD_ALLOW_MENTION_ROLES"],
      ["d-adv-alu", "DISCORD_ALLOW_MENTION_USERS"],
      ["d-adv-alk", "DISCORD_ALLOW_MENTION_REPLIED_USER"],
      ["d-adv-ignm", "DISCORD_IGNORE_NO_MENTION"],
    ] as const;
    for (const [fieldId, envKey] of discordFields) {
      const value = String(fieldValues[fieldId] ?? "").trim();
      if (value.length > 0 && !isConfiguredSecretPlaceholder(value)) {
        set[envKey] = value;
      }
    }
    const allowedUsers = String(fieldValues["messaging-discord-allowed"] ?? "");
    if (Object.keys(set).length === 0 && allowedUsers.trim().length === 0) {
      setMessagingStatus("Nothing to save for Discord.");
      return;
    }
    setMessagingBusy(true);
    setMessagingStatus("Saving and restarting gateway…");
    try {
      const payload: ModelProvidersSavePayload = { discord: { allowed_users: allowedUsers } };
      if (Object.keys(set).length > 0) {
        payload.env = { set };
      }
      await applyMutation(payload, "Discord settings updated.", setMessagingStatus);
    } catch (error) {
      setMessagingStatus(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setMessagingBusy(false);
    }
  }, [applyMutation, fieldValues, messagingBusy]);

  const saveSlack = useCallback(async () => {
    if (messagingBusy) {
      return;
    }
    const set: Record<string, string> = {};
    for (const [fieldId, envKey] of [
      ["messaging-slack-bot", "SLACK_BOT_TOKEN"],
      ["messaging-slack-app", "SLACK_APP_TOKEN"],
    ] as const) {
      const value = String(fieldValues[fieldId] ?? "").trim();
      if (value.length > 0 && !isConfiguredSecretPlaceholder(value)) {
        set[envKey] = value;
      }
    }
    if (Object.keys(set).length === 0) {
      setMessagingStatus("Nothing to save for Slack.");
      return;
    }
    setMessagingBusy(true);
    setMessagingStatus("Saving and restarting gateway…");
    try {
      const response = await api.postEnvBatch({ set });
      dispatchGatewayStatus(response.gateway);
      dispatchEnvSnapshot({ env: response.env, gateway: response.gateway });
      dispatchEnvReloadRequest();
      await refreshHints();
      setMessagingStatus(
        response.restart.ok
          ? "Slack settings written. Gateway restarted."
          : `Slack settings written. Gateway restart failed: ${response.restart.error ?? "Unknown error"}`,
      );
    } catch (error) {
      setMessagingStatus(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setMessagingBusy(false);
    }
  }, [api, fieldValues, messagingBusy, refreshHints]);

  const clearKeys = useCallback(
    async (label: string, keys: readonly string[], setStatus: (message: string) => void) => {
      if (!window.confirm(`Remove ${label} keys from data/.env and restart gateway?`)) {
        return;
      }
      const response = await api.postEnvBatch({ remove: [...keys] });
      dispatchGatewayStatus(response.gateway);
      dispatchEnvSnapshot({ env: response.env, gateway: response.gateway });
      dispatchEnvReloadRequest();
      await refreshHints();
      setStatus(
        response.restart.ok
          ? `${label} keys removed. Gateway restarted.`
          : `${label} keys removed. Gateway restart failed: ${response.restart.error ?? "Unknown error"}`,
      );
    },
    [api, refreshHints],
  );

  const clearDiscord = useCallback(async () => {
    if (messagingBusy) {
      return;
    }
    setMessagingBusy(true);
    setMessagingStatus("Removing keys and restarting gateway…");
    try {
      await applyMutation(
        {
          env: {
            remove: [
              "DISCORD_BOT_TOKEN",
              "DISCORD_ALLOWED_USERS",
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
            ],
          },
          discord: { allowed_users: "" },
        },
        "Discord keys removed.",
        setMessagingStatus,
      );
      setFieldValues({
        "messaging-discord-token": "",
        "messaging-discord-allowed": "",
      });
    } catch (error) {
      setMessagingStatus(`Clear failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setMessagingBusy(false);
    }
  }, [applyMutation, messagingBusy, setFieldValues]);

  const clearSlack = useCallback(async () => {
    if (messagingBusy) {
      return;
    }
    setMessagingBusy(true);
    setMessagingStatus("Removing keys and restarting gateway…");
    try {
      await clearKeys("Slack", ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"], setMessagingStatus);
      setFieldValues({ "messaging-slack-bot": "", "messaging-slack-app": "" });
    } catch (error) {
      setMessagingStatus(`Clear failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setMessagingBusy(false);
    }
  }, [clearKeys, messagingBusy, setFieldValues]);

  const saveProvider = useCallback(
    async (
      doneMessage: string,
      set: Record<string, string>,
      setStatus: (message: string) => void,
    ) => {
      if (Object.keys(set).length === 0) {
        setStatus("Nothing to save.");
        return;
      }
      await applyMutation({ env: { set } }, doneMessage, setStatus);
    },
    [applyMutation],
  );

  const saveYamlModel = useCallback(async () => {
    if (modelProvidersBusy) {
      return;
    }
    const model: Record<string, string> = {};
    const defaultModel = String(fieldValues["mp-yaml-default"] ?? "").trim();
    const provider = String(fieldValues["mp-yaml-provider"] ?? "").trim();
    const baseUrl = String(fieldValues["mp-yaml-base-url"] ?? "").trim();
    if (defaultModel) model.default = defaultModel;
    if (provider) model.provider = provider;
    if (baseUrl) model.base_url = baseUrl;
    if (Object.keys(model).length === 0) {
      setModelProvidersStatus("Nothing to save.");
      return;
    }
    setModelProvidersBusy(true);
    setModelProvidersStatus("Saving…");
    try {
      await applyMutation({ model }, "Default model written.", setModelProvidersStatus);
    } catch (error) {
      setModelProvidersStatus(
        `Save failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setModelProvidersBusy(false);
    }
  }, [applyMutation, fieldValues, modelProvidersBusy]);

  const saveOpenRouter = useCallback(async () => {
    if (modelProvidersBusy) return;
    setModelProvidersBusy(true);
    setModelProvidersStatus("Saving…");
    try {
      await saveProvider(
        "OpenRouter settings written.",
        {
          ...(String(fieldValues["mp-or-key"] ?? "").trim() &&
          !isConfiguredSecretPlaceholder(String(fieldValues["mp-or-key"] ?? "").trim())
            ? { OPENROUTER_API_KEY: String(fieldValues["mp-or-key"]).trim() }
            : {}),
          ...(String(fieldValues["mp-or-base"] ?? "").trim() &&
          !isConfiguredSecretPlaceholder(String(fieldValues["mp-or-base"] ?? "").trim())
            ? { OPENROUTER_BASE_URL: String(fieldValues["mp-or-base"]).trim() }
            : {}),
        },
        setModelProvidersStatus,
      );
    } catch (error) {
      setModelProvidersStatus(
        `Save failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setModelProvidersBusy(false);
    }
  }, [fieldValues, modelProvidersBusy, saveProvider]);

  const clearOpenRouter = useCallback(async () => {
    if (modelProvidersBusy) return;
    setModelProvidersBusy(true);
    setModelProvidersStatus("Removing keys…");
    try {
      await clearKeys(
        "OpenRouter",
        [...MODEL_PROVIDER_ENV_KEYS_BY_PROVIDER.openrouter],
        setModelProvidersStatus,
      );
    } catch (error) {
      setModelProvidersStatus(
        `Clear failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setModelProvidersBusy(false);
    }
  }, [clearKeys, modelProvidersBusy]);

  const saveAnthropic = useCallback(async () => {
    if (modelProvidersBusy) return;
    setModelProvidersBusy(true);
    setModelProvidersStatus("Saving…");
    try {
      await saveProvider(
        "Claude settings written.",
        {
          ...(String(fieldValues["mp-anthropic-key"] ?? "").trim() &&
          !isConfiguredSecretPlaceholder(String(fieldValues["mp-anthropic-key"] ?? "").trim())
            ? { ANTHROPIC_API_KEY: String(fieldValues["mp-anthropic-key"]).trim() }
            : {}),
        },
        setModelProvidersStatus,
      );
    } catch (error) {
      setModelProvidersStatus(
        `Save failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setModelProvidersBusy(false);
    }
  }, [fieldValues, modelProvidersBusy, saveProvider]);

  const clearAnthropic = useCallback(async () => {
    if (modelProvidersBusy) return;
    setModelProvidersBusy(true);
    setModelProvidersStatus("Removing keys…");
    try {
      await clearKeys(
        "Claude",
        [...MODEL_PROVIDER_ENV_KEYS_BY_PROVIDER.anthropic],
        setModelProvidersStatus,
      );
    } catch (error) {
      setModelProvidersStatus(
        `Clear failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setModelProvidersBusy(false);
    }
  }, [clearKeys, modelProvidersBusy]);

  const saveOpenAi = useCallback(async () => {
    if (modelProvidersBusy) return;
    setModelProvidersBusy(true);
    setModelProvidersStatus("Saving…");
    try {
      await saveProvider(
        "OpenAI settings written.",
        {
          ...(String(fieldValues["mp-openai-key"] ?? "").trim() &&
          !isConfiguredSecretPlaceholder(String(fieldValues["mp-openai-key"] ?? "").trim())
            ? { OPENAI_API_KEY: String(fieldValues["mp-openai-key"]).trim() }
            : {}),
          ...(String(fieldValues["mp-openai-base"] ?? "").trim() &&
          !isConfiguredSecretPlaceholder(String(fieldValues["mp-openai-base"] ?? "").trim())
            ? { OPENAI_BASE_URL: String(fieldValues["mp-openai-base"]).trim() }
            : {}),
        },
        setModelProvidersStatus,
      );
    } catch (error) {
      setModelProvidersStatus(
        `Save failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setModelProvidersBusy(false);
    }
  }, [fieldValues, modelProvidersBusy, saveProvider]);

  const clearOpenAi = useCallback(async () => {
    if (modelProvidersBusy) return;
    setModelProvidersBusy(true);
    setModelProvidersStatus("Removing keys…");
    try {
      await clearKeys(
        "OpenAI",
        [...MODEL_PROVIDER_ENV_KEYS_BY_PROVIDER.openai],
        setModelProvidersStatus,
      );
    } catch (error) {
      setModelProvidersStatus(
        `Clear failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setModelProvidersBusy(false);
    }
  }, [clearKeys, modelProvidersBusy]);

  const saveGemini = useCallback(async () => {
    if (modelProvidersBusy) return;
    setModelProvidersBusy(true);
    setModelProvidersStatus("Saving…");
    try {
      await saveProvider(
        "Gemini settings written.",
        {
          ...(String(fieldValues["mp-google-key"] ?? "").trim() &&
          !isConfiguredSecretPlaceholder(String(fieldValues["mp-google-key"] ?? "").trim())
            ? { GOOGLE_API_KEY: String(fieldValues["mp-google-key"]).trim() }
            : {}),
          ...(String(fieldValues["mp-gemini-base"] ?? "").trim() &&
          !isConfiguredSecretPlaceholder(String(fieldValues["mp-gemini-base"] ?? "").trim())
            ? { GEMINI_BASE_URL: String(fieldValues["mp-gemini-base"]).trim() }
            : {}),
        },
        setModelProvidersStatus,
      );
    } catch (error) {
      setModelProvidersStatus(
        `Save failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setModelProvidersBusy(false);
    }
  }, [fieldValues, modelProvidersBusy, saveProvider]);

  const clearGemini = useCallback(async () => {
    if (modelProvidersBusy) return;
    setModelProvidersBusy(true);
    setModelProvidersStatus("Removing keys…");
    try {
      await clearKeys(
        "Gemini",
        [...MODEL_PROVIDER_ENV_KEYS_BY_PROVIDER.gemini],
        setModelProvidersStatus,
      );
    } catch (error) {
      setModelProvidersStatus(
        `Clear failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setModelProvidersBusy(false);
    }
  }, [clearKeys, modelProvidersBusy]);

  return {
    fieldValues: fieldValues as Record<string, string | undefined>,
    setFieldValue,
    messagingHint,
    modelProvidersHint,
    messagingStatus,
    modelProvidersStatus,
    messagingBusy,
    modelProvidersBusy,
    saveDiscord,
    saveSlack,
    clearDiscord,
    clearSlack,
    saveYamlModel,
    saveOpenRouter,
    clearOpenRouter,
    saveAnthropic,
    clearAnthropic,
    saveOpenAi,
    clearOpenAi,
    saveGemini,
    clearGemini,
  };
}
