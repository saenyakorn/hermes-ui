import type { EnvReadResult, ModelProvidersMutationResponse } from "../server/types";
import type { HermesWorkspaceDeps } from "./workspace-deps";

export const MODEL_OPENROUTER_KEYS = ["OPENROUTER_API_KEY", "OPENROUTER_BASE_URL"] as const;
export const MODEL_ANTHROPIC_KEYS = ["ANTHROPIC_API_KEY"] as const;
export const MODEL_OPENAI_KEYS = ["OPENAI_API_KEY", "OPENAI_BASE_URL"] as const;
export const MODEL_GEMINI_KEYS = ["GOOGLE_API_KEY", "GEMINI_API_KEY", "GEMINI_BASE_URL"] as const;

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
  hint.textContent = [
    line("OpenRouter", MODEL_OPENROUTER_KEYS),
    line("Claude", MODEL_ANTHROPIC_KEYS),
    line("OpenAI", MODEL_OPENAI_KEYS),
    line("Gemini", MODEL_GEMINI_KEYS),
  ].join(" · ");
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
