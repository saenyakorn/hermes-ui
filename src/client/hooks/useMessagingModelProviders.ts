import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { ModelProvidersSavePayload } from "../api-fetcher";
import { ApiFetcher } from "../api-fetcher";
import { dispatchEnvReloadRequest, dispatchEnvSnapshot, dispatchGatewayStatus } from "../lib/event";
import {
  isConfiguredSecretPlaceholder,
  MODEL_PROVIDER_ENV_KEYS_BY_PROVIDER,
} from "./useWorkspaceFieldSources";
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
      ["discord-bot-token", "DISCORD_BOT_TOKEN"],
      ["discord-advanced-allowed-roles", "DISCORD_ALLOWED_ROLES"],
      ["discord-advanced-allowed-channels", "DISCORD_ALLOWED_CHANNELS"],
      ["discord-advanced-free-response-channels", "DISCORD_FREE_RESPONSE_CHANNELS"],
      ["discord-advanced-home-channel", "DISCORD_HOME_CHANNEL"],
      ["discord-advanced-home-channel-name", "DISCORD_HOME_CHANNEL_NAME"],
      ["discord-advanced-proxy", "DISCORD_PROXY"],
      ["discord-advanced-command-sync-policy", "DISCORD_COMMAND_SYNC_POLICY"],
      ["discord-advanced-reply-mode", "DISCORD_REPLY_TO_MODE"],
      ["discord-advanced-require-mention", "DISCORD_REQUIRE_MENTION"],
      ["discord-advanced-auto-thread", "DISCORD_AUTO_THREAD"],
      ["discord-advanced-reactions", "DISCORD_REACTIONS"],
      ["discord-advanced-ignored-channels", "DISCORD_IGNORED_CHANNELS"],
      ["discord-advanced-no-thread-channels", "DISCORD_NO_THREAD_CHANNELS"],
      ["discord-advanced-allow-mention-everyone", "DISCORD_ALLOW_MENTION_EVERYONE"],
      ["discord-advanced-allow-mention-roles", "DISCORD_ALLOW_MENTION_ROLES"],
      ["discord-advanced-allow-mention-users", "DISCORD_ALLOW_MENTION_USERS"],
      ["discord-advanced-allow-mention-replied-user", "DISCORD_ALLOW_MENTION_REPLIED_USER"],
      ["discord-advanced-ignore-no-mention", "DISCORD_IGNORE_NO_MENTION"],
    ] as const;
    for (const [fieldId, envKey] of discordFields) {
      const value = String(fieldValues[fieldId] ?? "").trim();
      if (value.length > 0 && !isConfiguredSecretPlaceholder(value)) {
        set[envKey] = value;
      }
    }
    const allowedUsers = String(fieldValues["discord-allowed-users"] ?? "");
    if (Object.keys(set).length === 0 && allowedUsers.trim().length === 0) {
      setMessagingStatus("Nothing to save for Discord.");
      return;
    }
    setMessagingBusy(true);
    setMessagingStatus("Saving and restarting gateway…");
    try {
      const payload: ModelProvidersSavePayload = {
        discord: { allowed_users: allowedUsers },
      };
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
      ["slack-bot-token", "SLACK_BOT_TOKEN"],
      ["slack-app-token", "SLACK_APP_TOKEN"],
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
        "discord-bot-token": "",
        "discord-allowed-users": "",
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
      setFieldValues({ "slack-bot-token": "", "slack-app-token": "" });
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
    const defaultModel = String(fieldValues["model-provider-default-model-id"] ?? "").trim();
    const provider = String(fieldValues["model-provider-default-model-provider"] ?? "").trim();
    const baseUrl = String(fieldValues["model-provider-default-model-base-url"] ?? "").trim();
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
          ...(String(fieldValues["model-provider-openrouter-api-key"] ?? "").trim() &&
          !isConfiguredSecretPlaceholder(
            String(fieldValues["model-provider-openrouter-api-key"] ?? "").trim(),
          )
            ? {
                OPENROUTER_API_KEY: String(fieldValues["model-provider-openrouter-api-key"]).trim(),
              }
            : {}),
          ...(String(fieldValues["model-provider-openrouter-base-url"] ?? "").trim() &&
          !isConfiguredSecretPlaceholder(
            String(fieldValues["model-provider-openrouter-base-url"] ?? "").trim(),
          )
            ? {
                OPENROUTER_BASE_URL: String(
                  fieldValues["model-provider-openrouter-base-url"],
                ).trim(),
              }
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
          ...(String(fieldValues["model-provider-anthropic-api-key"] ?? "").trim() &&
          !isConfiguredSecretPlaceholder(
            String(fieldValues["model-provider-anthropic-api-key"] ?? "").trim(),
          )
            ? {
                ANTHROPIC_API_KEY: String(fieldValues["model-provider-anthropic-api-key"]).trim(),
              }
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
          ...(String(fieldValues["model-provider-openai-api-key"] ?? "").trim() &&
          !isConfiguredSecretPlaceholder(
            String(fieldValues["model-provider-openai-api-key"] ?? "").trim(),
          )
            ? { OPENAI_API_KEY: String(fieldValues["model-provider-openai-api-key"]).trim() }
            : {}),
          ...(String(fieldValues["model-provider-openai-base-url"] ?? "").trim() &&
          !isConfiguredSecretPlaceholder(
            String(fieldValues["model-provider-openai-base-url"] ?? "").trim(),
          )
            ? { OPENAI_BASE_URL: String(fieldValues["model-provider-openai-base-url"]).trim() }
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
      const googleKey = String(fieldValues["model-provider-google-api-key"] ?? "").trim();
      const geminiBase = String(fieldValues["model-provider-gemini-base-url"] ?? "").trim();
      await saveProvider(
        "Gemini settings written.",
        {
          ...(googleKey.length > 0 && !isConfiguredSecretPlaceholder(googleKey)
            ? { GOOGLE_API_KEY: googleKey }
            : {}),
          ...(geminiBase.length > 0 && !isConfiguredSecretPlaceholder(geminiBase)
            ? { GEMINI_BASE_URL: geminiBase }
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
