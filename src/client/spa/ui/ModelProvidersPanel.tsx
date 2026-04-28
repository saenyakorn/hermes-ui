import { useMessagingModelProviders } from "../../hooks/useMessagingModelProviders";
import {
  ActionButton,
  type ActionConfig,
  FormInput,
  type TextFieldConfig,
} from "./integrations/IntegrationFormControls";

type ModelProviderAction =
  | "saveYamlModel"
  | "saveOpenRouter"
  | "clearOpenRouter"
  | "saveAnthropic"
  | "clearAnthropic"
  | "saveOpenAi"
  | "clearOpenAi"
  | "saveGemini"
  | "clearGemini";

const modelProviderFields: readonly TextFieldConfig[] = [
  { id: "mp-yaml-default", label: "Default model id" },
  { id: "mp-yaml-provider", label: "Default model provider" },
  { id: "mp-yaml-base-url", label: "Default model base url" },
  { id: "mp-or-key", label: "OpenRouter API key", type: "password" },
  { id: "mp-or-base", label: "OpenRouter base url" },
  { id: "mp-anthropic-key", label: "Anthropic API key", type: "password" },
  { id: "mp-openai-key", label: "OpenAI API key", type: "password" },
  { id: "mp-openai-base", label: "OpenAI base url" },
  { id: "mp-google-key", label: "Google API key", type: "password" },
  { id: "mp-gemini-base", label: "Gemini base url" },
] as const;

const actions: readonly ActionConfig<ModelProviderAction>[] = [
  {
    actionId: "mp-save-yaml",
    label: "Save default model",
    kind: "primary",
    action: "saveYamlModel",
  },
  { actionId: "mp-save-or", label: "Save OpenRouter", kind: "primary", action: "saveOpenRouter" },
  {
    actionId: "mp-clear-or",
    label: "Clear OpenRouter keys",
    kind: "secondary",
    action: "clearOpenRouter",
  },
  { actionId: "mp-save-anthropic", label: "Save Claude", kind: "primary", action: "saveAnthropic" },
  {
    actionId: "mp-clear-anthropic",
    label: "Clear Claude keys",
    kind: "secondary",
    action: "clearAnthropic",
  },
  { actionId: "mp-save-openai", label: "Save OpenAI", kind: "primary", action: "saveOpenAi" },
  {
    actionId: "mp-clear-openai",
    label: "Clear OpenAI keys",
    kind: "secondary",
    action: "clearOpenAi",
  },
  { actionId: "mp-save-gemini", label: "Save Gemini", kind: "primary", action: "saveGemini" },
  {
    actionId: "mp-clear-gemini",
    label: "Clear Gemini keys",
    kind: "secondary",
    action: "clearGemini",
  },
] as const;

export function ModelProvidersPanel() {
  const integrations = useMessagingModelProviders();
  const field = (id: string): string => String(integrations.fieldValues[id] ?? "");

  const handlers: Record<ModelProviderAction, () => Promise<void>> = {
    saveYamlModel: integrations.saveYamlModel,
    saveOpenRouter: integrations.saveOpenRouter,
    clearOpenRouter: integrations.clearOpenRouter,
    saveAnthropic: integrations.saveAnthropic,
    clearAnthropic: integrations.clearAnthropic,
    saveOpenAi: integrations.saveOpenAi,
    clearOpenAi: integrations.clearOpenAi,
    saveGemini: integrations.saveGemini,
    clearGemini: integrations.clearGemini,
  };

  return (
    <section
      data-tab-panel="model-providers"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-2"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-text sm:text-base">
        Model providers
      </p>
      <p id="model-providers-env-hint" className="mt-2 text-xs text-muted" aria-live="polite">
        {integrations.modelProvidersHint}
      </p>
      <div className="mt-3 flex w-full min-w-0 flex-col gap-3">
        {modelProviderFields.map((config) => (
          <FormInput
            key={config.id}
            config={config}
            value={field(config.id)}
            onChange={integrations.setFieldValue}
          />
        ))}
        {actions.map((config) => (
          <ActionButton
            key={config.actionId}
            actionId={config.actionId}
            kind={config.kind}
            disabled={integrations.modelProvidersBusy}
            onClick={() => {
              void handlers[config.action]();
            }}
          >
            {config.label}
          </ActionButton>
        ))}
      </div>
      <p
        id="model-providers-status"
        className="mt-3 shrink-0 text-xs text-muted"
        role="status"
        aria-live="polite"
      >
        {integrations.modelProvidersStatus}
      </p>
    </section>
  );
}
