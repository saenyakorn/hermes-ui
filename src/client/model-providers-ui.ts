import type { EnvReadResult, ModelProvidersMutationResponse, ModelYamlPatch } from "../server/types";
import { getErrorMessage } from "./lib/errors";
import type { ModelProvidersSavePayload } from "./api-fetcher";
import type { HermesWorkspaceDeps } from "./workspace-deps";
import { isConfiguredSecretPlaceholder } from "./workspace-field-sources";

const MODEL_OPENROUTER_KEYS = ["OPENROUTER_API_KEY", "OPENROUTER_BASE_URL"] as const;
const MODEL_ANTHROPIC_KEYS = ["ANTHROPIC_API_KEY"] as const;
const MODEL_OPENAI_KEYS = ["OPENAI_API_KEY", "OPENAI_BASE_URL"] as const;
const MODEL_GEMINI_KEYS = ["GOOGLE_API_KEY", "GEMINI_API_KEY", "GEMINI_BASE_URL"] as const;

const MODEL_PROVIDERS_BUTTON_IDS = [
  "mp-save-yaml",
  "mp-save-or",
  "mp-clear-or",
  "mp-save-anthropic",
  "mp-clear-anthropic",
  "mp-save-openai",
  "mp-clear-openai",
  "mp-save-gemini",
  "mp-clear-gemini",
] as const;

function countEnvKeysPresent(env: EnvReadResult, keys: readonly string[]): number {
  return keys.filter((key) => env.entries.some((e) => e.key === key)).length;
}

function setModelProvidersStatus(message: string): void {
  const el = document.getElementById("model-providers-status");
  if (el) {
    el.textContent = message;
  }
}

function renderModelProvidersEnvHint(env: EnvReadResult): void {
  const hint = document.getElementById("model-providers-env-hint");
  if (!hint) {
    return;
  }
  const line = (label: string, keys: readonly string[]) => {
    const n = countEnvKeysPresent(env, keys);
    return n > 0 ? `${label}: ${String(n)} key(s)` : `${label}: no tracked keys`;
  };
  hint.textContent = [
    line("OpenRouter", MODEL_OPENROUTER_KEYS),
    line("Claude", MODEL_ANTHROPIC_KEYS),
    line("OpenAI", MODEL_OPENAI_KEYS),
    line("Gemini", MODEL_GEMINI_KEYS),
  ].join(" · ");
}

export async function refreshModelProvidersEnvHint(deps: HermesWorkspaceDeps): Promise<void> {
  const hint = document.getElementById("model-providers-env-hint");
  if (!hint) {
    return;
  }
  hint.textContent = "Loading…";
  try {
    const env = await deps.api.getEnvRead();
    let workspaceHints: import("../server/types").WorkspaceConfigHints | null = null;
    try {
      workspaceHints = await deps.api.getWorkspaceConfigHints();
    } catch {
      //
    }
    renderModelProvidersEnvHint(env);
    deps.integrationSync.populateAllFromEnv(env, workspaceHints);
    requestAnimationFrame(() => {
      deps.integrationSync.populateAllFromEnv(env, workspaceHints);
    });
  } catch (cause: unknown) {
    hint.textContent = `Could not load .env: ${getErrorMessage(cause)}`;
  }
}

function updateModelProvidersButtons(modelProvidersBusy: boolean): void {
  for (const id of MODEL_PROVIDERS_BUTTON_IDS) {
    const button = document.getElementById(id);
    if (button instanceof HTMLButtonElement) {
      button.disabled = modelProvidersBusy;
    }
  }
}

let modelProvidersBusy = false;

function setModelProvidersBusy(busy: boolean): void {
  modelProvidersBusy = busy;
  updateModelProvidersButtons(modelProvidersBusy);
}

export function applyModelProvidersMutationResponse(
  deps: HermesWorkspaceDeps,
  response: ModelProvidersMutationResponse,
  doneMessage: string,
  options?: { setStatus?: (message: string) => void },
): void {
  const setStatusLine = options?.setStatus ?? setModelProvidersStatus;
  deps.envConfigurator.reflectGatewayAndEnvSnapshot(response.env, response.gateway);
  renderModelProvidersEnvHint(response.env);
  void deps.configConfigurator.syncFromServerIfClean();
  if (response.restart.ok) {
    setStatusLine(`${doneMessage} Gateway restarted.`);
    return;
  }
  if (!response.restart.attempted) {
    setStatusLine(`${doneMessage} Gateway was stopped; no restart performed.`);
    return;
  }
  setStatusLine(
    `${doneMessage} Gateway restart failed: ${response.restart.error ?? "Unknown error"}`,
  );
}

function readYamlModelForm(): ModelYamlPatch | undefined {
  const model: ModelYamlPatch = {};
  const defaultEl = document.getElementById("mp-yaml-default");
  const providerEl = document.getElementById("mp-yaml-provider");
  const baseUrlEl = document.getElementById("mp-yaml-base-url");
  if (defaultEl instanceof HTMLInputElement && defaultEl.value.trim().length > 0) {
    model.default = defaultEl.value.trim();
  }
  if (providerEl instanceof HTMLInputElement && providerEl.value.trim().length > 0) {
    model.provider = providerEl.value.trim();
  }
  if (baseUrlEl instanceof HTMLInputElement && baseUrlEl.value.trim().length > 0) {
    model.base_url = baseUrlEl.value.trim();
  }
  return Object.keys(model).length > 0 ? model : undefined;
}

function clearYamlModelInputs(): void {
  for (const id of ["mp-yaml-default", "mp-yaml-provider", "mp-yaml-base-url"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
      el.value = "";
    }
  }
}

function readOpenRouterForm(): Record<string, string> {
  const set: Record<string, string> = {};
  const keyEl = document.getElementById("mp-or-key");
  const baseEl = document.getElementById("mp-or-base");
  if (
    keyEl instanceof HTMLInputElement &&
    keyEl.value.trim().length > 0 &&
    !isConfiguredSecretPlaceholder(keyEl.value)
  ) {
    set.OPENROUTER_API_KEY = keyEl.value.trim();
  }
  if (
    baseEl instanceof HTMLInputElement &&
    baseEl.value.trim().length > 0 &&
    !isConfiguredSecretPlaceholder(baseEl.value)
  ) {
    set.OPENROUTER_BASE_URL = baseEl.value.trim();
  }
  return set;
}

function clearOpenRouterInputs(): void {
  for (const id of ["mp-or-key", "mp-or-base"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
      el.value = "";
    }
  }
}

function readAnthropicForm(): Record<string, string> {
  const set: Record<string, string> = {};
  const keyEl = document.getElementById("mp-anthropic-key");
  if (
    keyEl instanceof HTMLInputElement &&
    keyEl.value.trim().length > 0 &&
    !isConfiguredSecretPlaceholder(keyEl.value)
  ) {
    set.ANTHROPIC_API_KEY = keyEl.value.trim();
  }
  return set;
}

function clearAnthropicInputs(): void {
  const el = document.getElementById("mp-anthropic-key");
  if (el instanceof HTMLInputElement) {
    el.value = "";
  }
}

function readOpenAiForm(): Record<string, string> {
  const set: Record<string, string> = {};
  const keyEl = document.getElementById("mp-openai-key");
  const baseEl = document.getElementById("mp-openai-base");
  if (
    keyEl instanceof HTMLInputElement &&
    keyEl.value.trim().length > 0 &&
    !isConfiguredSecretPlaceholder(keyEl.value)
  ) {
    set.OPENAI_API_KEY = keyEl.value.trim();
  }
  if (
    baseEl instanceof HTMLInputElement &&
    baseEl.value.trim().length > 0 &&
    !isConfiguredSecretPlaceholder(baseEl.value)
  ) {
    set.OPENAI_BASE_URL = baseEl.value.trim();
  }
  return set;
}

function clearOpenAiInputs(): void {
  for (const id of ["mp-openai-key", "mp-openai-base"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
      el.value = "";
    }
  }
}

function readGeminiForm(): Record<string, string> {
  const set: Record<string, string> = {};
  const keyEl = document.getElementById("mp-google-key");
  const baseEl = document.getElementById("mp-gemini-base");
  if (
    keyEl instanceof HTMLInputElement &&
    keyEl.value.trim().length > 0 &&
    !isConfiguredSecretPlaceholder(keyEl.value)
  ) {
    set.GOOGLE_API_KEY = keyEl.value.trim();
  }
  if (
    baseEl instanceof HTMLInputElement &&
    baseEl.value.trim().length > 0 &&
    !isConfiguredSecretPlaceholder(baseEl.value)
  ) {
    set.GEMINI_BASE_URL = baseEl.value.trim();
  }
  return set;
}

function clearGeminiInputs(): void {
  for (const id of ["mp-google-key", "mp-gemini-base"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
      el.value = "";
    }
  }
}

function modelProvidersPayloadHasWork(payload: ModelProvidersSavePayload): boolean {
  const hasModel = payload.model !== undefined && Object.keys(payload.model).length > 0;
  const hasDiscord = payload.discord !== undefined;
  const hasEnvSet =
    payload.env?.set !== undefined && Object.keys(payload.env.set).length > 0;
  const hasEnvRemove =
    payload.env?.remove !== undefined && payload.env.remove.length > 0;
  return hasModel || hasDiscord || hasEnvSet || hasEnvRemove;
}

async function saveModelProvidersFromPayload(
  deps: HermesWorkspaceDeps,
  payload: ModelProvidersSavePayload,
  emptyHint: string,
  doneMessage: string,
  clear?: () => void,
): Promise<void> {
  if (modelProvidersBusy) {
    return;
  }
  if (!modelProvidersPayloadHasWork(payload)) {
    setModelProvidersStatus(emptyHint);
    return;
  }
  setModelProvidersBusy(true);
  setModelProvidersStatus("Saving…");
  try {
    const response = await deps.api.postModelProvidersSettings(payload);
    applyModelProvidersMutationResponse(deps, response, doneMessage);
    clear?.();
  } catch (cause: unknown) {
    setModelProvidersStatus(`Save failed: ${getErrorMessage(cause)}`);
  } finally {
    setModelProvidersBusy(false);
  }
}

async function clearModelProviderKeys(
  deps: HermesWorkspaceDeps,
  keys: readonly string[],
  label: string,
  afterClear?: () => void,
): Promise<void> {
  if (modelProvidersBusy) {
    return;
  }
  if (
    !window.confirm(
      `Remove ${label} keys from data/.env and restart the gateway if it is running?`,
    )
  ) {
    return;
  }
  setModelProvidersBusy(true);
  setModelProvidersStatus("Removing keys…");
  try {
    const response = await deps.api.postModelProvidersSettings({ env: { remove: [...keys] } });
    applyModelProvidersMutationResponse(deps, response, `${label} keys removed from .env.`);
    afterClear?.();
  } catch (cause: unknown) {
    setModelProvidersStatus(`Clear failed: ${getErrorMessage(cause)}`);
  } finally {
    setModelProvidersBusy(false);
  }
}

export function setupModelProviders(deps: HermesWorkspaceDeps): void {
  void refreshModelProvidersEnvHint(deps);
  updateModelProvidersButtons(modelProvidersBusy);

  const saveYaml = document.getElementById("mp-save-yaml");
  if (saveYaml instanceof HTMLButtonElement) {
    saveYaml.addEventListener("click", () => {
      const model = readYamlModelForm();
      void saveModelProvidersFromPayload(
        deps,
        model ? { model } : {},
        "Nothing to save — enter at least one default model field.",
        "Default model written to config.yaml.",
        model ? clearYamlModelInputs : undefined,
      );
    });
  }

  const saveOr = document.getElementById("mp-save-or");
  if (saveOr instanceof HTMLButtonElement) {
    saveOr.addEventListener("click", () => {
      const set = readOpenRouterForm();
      void saveModelProvidersFromPayload(
        deps,
        { env: { set } },
        "Nothing to save for OpenRouter — enter at least one value.",
        "OpenRouter settings written to .env.",
        Object.keys(set).length > 0 ? clearOpenRouterInputs : undefined,
      );
    });
  }
  const clearOr = document.getElementById("mp-clear-or");
  if (clearOr instanceof HTMLButtonElement) {
    clearOr.addEventListener("click", () => {
      void clearModelProviderKeys(deps, [...MODEL_OPENROUTER_KEYS], "OpenRouter", clearOpenRouterInputs);
    });
  }

  const saveAnthropic = document.getElementById("mp-save-anthropic");
  if (saveAnthropic instanceof HTMLButtonElement) {
    saveAnthropic.addEventListener("click", () => {
      const set = readAnthropicForm();
      void saveModelProvidersFromPayload(
        deps,
        { env: { set } },
        "Nothing to save for Claude — enter the API key.",
        "Claude (Anthropic) settings written to .env.",
        Object.keys(set).length > 0 ? clearAnthropicInputs : undefined,
      );
    });
  }
  const clearAnthropic = document.getElementById("mp-clear-anthropic");
  if (clearAnthropic instanceof HTMLButtonElement) {
    clearAnthropic.addEventListener("click", () => {
      void clearModelProviderKeys(deps, [...MODEL_ANTHROPIC_KEYS], "Claude", clearAnthropicInputs);
    });
  }

  const saveOpenai = document.getElementById("mp-save-openai");
  if (saveOpenai instanceof HTMLButtonElement) {
    saveOpenai.addEventListener("click", () => {
      const set = readOpenAiForm();
      void saveModelProvidersFromPayload(
        deps,
        { env: { set } },
        "Nothing to save for OpenAI — enter at least one value.",
        "OpenAI settings written to .env.",
        Object.keys(set).length > 0 ? clearOpenAiInputs : undefined,
      );
    });
  }
  const clearOpenai = document.getElementById("mp-clear-openai");
  if (clearOpenai instanceof HTMLButtonElement) {
    clearOpenai.addEventListener("click", () => {
      void clearModelProviderKeys(deps, [...MODEL_OPENAI_KEYS], "OpenAI", clearOpenAiInputs);
    });
  }

  const saveGemini = document.getElementById("mp-save-gemini");
  if (saveGemini instanceof HTMLButtonElement) {
    saveGemini.addEventListener("click", () => {
      const set = readGeminiForm();
      void saveModelProvidersFromPayload(
        deps,
        { env: { set } },
        "Nothing to save for Gemini — enter at least one value.",
        "Gemini settings written to .env.",
        Object.keys(set).length > 0 ? clearGeminiInputs : undefined,
      );
    });
  }
  const clearGemini = document.getElementById("mp-clear-gemini");
  if (clearGemini instanceof HTMLButtonElement) {
    clearGemini.addEventListener("click", () => {
      void clearModelProviderKeys(deps, [...MODEL_GEMINI_KEYS], "Gemini", clearGeminiInputs);
    });
  }
}
