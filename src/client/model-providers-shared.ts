import type { EnvReadResult, ModelProvidersMutationResponse } from "../server/types";
import type { HermesWorkspaceDeps } from "./workspace-deps";
import {
  MODEL_PROVIDER_ENV_KEYS_BY_PROVIDER,
  type ModelProviderName,
} from "./workspace-field-sources";

function countEnvKeysPresent(env: EnvReadResult, keys: readonly string[]): number {
  return keys.filter((key) => env.entries.some((e) => e.key === key)).length;
}

export function setModelProvidersStatus(message: string): void {
  const el = document.getElementById("model-providers-status");
  if (el) {
    el.textContent = message;
  }
}

export function renderModelProvidersEnvHint(env: EnvReadResult): void {
  const hint = document.getElementById("model-providers-env-hint");
  if (!hint) {
    return;
  }
  const line = (label: string, keys: readonly string[]) => {
    const n = countEnvKeysPresent(env, keys);
    return n > 0 ? `${label}: ${String(n)} key(s)` : `${label}: no tracked keys`;
  };
  const labelsByProvider: Readonly<Record<ModelProviderName, string>> = {
    openrouter: "OpenRouter",
    anthropic: "Claude",
    openai: "OpenAI",
    gemini: "Gemini",
  };
  hint.textContent = (Object.keys(labelsByProvider) as ModelProviderName[])
    .map((provider) =>
      line(labelsByProvider[provider], MODEL_PROVIDER_ENV_KEYS_BY_PROVIDER[provider]),
    )
    .join(" · ");
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
