import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "../../lib/sonner";
import { z } from "zod";
import { ApiFetcher, type ModelProvidersSavePayload } from "../../api-fetcher";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { useAppForm } from "../../components/tanstack-form";
import { resolveAllWorkspaceIntegrationFieldValues } from "../../hooks/useWorkspaceFieldSources";
import {
  dispatchEnvReloadRequest,
  dispatchEnvSnapshot,
  dispatchGatewayStatus,
} from "../../lib/event";
import { createEnvSet, createFormKey } from "./integrations/formHelpers";

export { createEnvSet, createFormKey, normalizeEnvSetValue } from "./integrations/formHelpers";

/** Keep aligned with each section `*Fields` array names below. */
const MODEL_PROVIDER_SECTION_FIELD_IDS = {
  defaultModel: [
    "model-provider-default-model-id",
    "model-provider-default-model-provider",
    "model-provider-default-model-base-url",
  ],
  openRouter: ["model-provider-openrouter-api-key", "model-provider-openrouter-base-url"],
  claude: ["model-provider-anthropic-api-key"],
  openAi: ["model-provider-openai-api-key", "model-provider-openai-base-url"],
  gemini: ["model-provider-google-api-key", "model-provider-gemini-base-url"],
} as const satisfies Record<string, readonly string[]>;

type ProviderFieldSpec = {
  name: string;
  label: string;
  type?: "text" | "password";
  autoComplete?: string;
  placeholder?: string;
};

export function ModelProvidersPanel() {
  const api = useMemo(() => new ApiFetcher(), []);
  const queryClient = useQueryClient();
  const defaultsQuery = useQuery({
    queryKey: ["model-providers-default-values"],
    queryFn: async () => {
      const [env, hints] = await Promise.all([api.getEnvRead(), api.getWorkspaceConfigHints()]);
      return resolveAllWorkspaceIntegrationFieldValues(env, hints);
    },
  });

  const onMutate = async (payload: ModelProvidersSavePayload) => {
    const response = await api.postModelProvidersSettings(payload);
    dispatchGatewayStatus(response.gateway);
    dispatchEnvSnapshot({ env: response.env, gateway: response.gateway });
    dispatchEnvReloadRequest();
    void queryClient.invalidateQueries({
      queryKey: ["model-providers-default-values"],
    });
    return response;
  };

  const defaultFieldValues = defaultsQuery.data ?? {};

  return (
    <section
      data-tab-panel="model-providers"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-2"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-text sm:text-base">
        Model providers
      </p>
      <p id="model-providers-env-hint" className="mt-2 text-xs text-muted" aria-live="polite">
        {defaultsQuery.isLoading
          ? "Loading provider settings..."
          : defaultsQuery.isError
            ? "Could not load provider defaults."
            : "Loaded provider settings."}
      </p>
      <div className="mt-3 flex w-full min-w-0 flex-col gap-3">
        <DefaultModelForm
          key={createFormKey(defaultFieldValues, [
            ...MODEL_PROVIDER_SECTION_FIELD_IDS.defaultModel,
          ])}
          defaultFieldValues={defaultFieldValues}
          isDefaultsLoading={defaultsQuery.isLoading}
          onMutate={onMutate}
        />
        <OpenRouterForm
          key={createFormKey(defaultFieldValues, [...MODEL_PROVIDER_SECTION_FIELD_IDS.openRouter])}
          defaultFieldValues={defaultFieldValues}
          isDefaultsLoading={defaultsQuery.isLoading}
          onMutate={onMutate}
        />
        <ClaudeForm
          key={createFormKey(defaultFieldValues, [...MODEL_PROVIDER_SECTION_FIELD_IDS.claude])}
          defaultFieldValues={defaultFieldValues}
          isDefaultsLoading={defaultsQuery.isLoading}
          onMutate={onMutate}
        />
        <OpenAiForm
          key={createFormKey(defaultFieldValues, [...MODEL_PROVIDER_SECTION_FIELD_IDS.openAi])}
          defaultFieldValues={defaultFieldValues}
          isDefaultsLoading={defaultsQuery.isLoading}
          onMutate={onMutate}
        />
        <GeminiForm
          key={createFormKey(defaultFieldValues, [...MODEL_PROVIDER_SECTION_FIELD_IDS.gemini])}
          defaultFieldValues={defaultFieldValues}
          isDefaultsLoading={defaultsQuery.isLoading}
          onMutate={onMutate}
        />
      </div>
      <p
        id="model-providers-status"
        className="mt-3 shrink-0 text-xs text-muted"
        role="status"
        aria-live="polite"
      >
        {defaultsQuery.isError ? "Failed to load provider data." : "Ready."}
      </p>
    </section>
  );
}

const DefaultModelFields: readonly ProviderFieldSpec[] = [
  { name: "model-provider-default-model-id", label: "Default model id" },
  {
    name: "model-provider-default-model-provider",
    label: "Default model provider",
  },
  {
    name: "model-provider-default-model-base-url",
    label: "Default model base url",
  },
];

const DefaultModelFormSchema = z.object({
  "model-provider-default-model-id": z.string().trim(),
  "model-provider-default-model-provider": z.string().trim(),
  "model-provider-default-model-base-url": z.string().trim(),
});

function DefaultModelForm({
  defaultFieldValues,
  isDefaultsLoading,
  onMutate,
}: {
  defaultFieldValues: Record<string, string | undefined>;
  isDefaultsLoading: boolean;
  onMutate: (payload: ModelProvidersSavePayload) => Promise<unknown>;
}) {
  const saveMutation = useMutation({
    mutationFn: async (values: z.infer<typeof DefaultModelFormSchema>) => {
      const model: NonNullable<ModelProvidersSavePayload["model"]> = {};
      const modelDefault = values["model-provider-default-model-id"];
      const modelProvider = values["model-provider-default-model-provider"];
      const baseUrl = values["model-provider-default-model-base-url"];
      if (modelDefault) model.default = modelDefault;
      if (modelProvider) model.provider = modelProvider;
      if (baseUrl) model.base_url = baseUrl;
      return onMutate({ model });
    },
  });
  const fieldIds = DefaultModelFields.map((field) => field.name);
  const form = useAppForm({
    defaultValues: Object.fromEntries(
      fieldIds.map((id) => [id, String(defaultFieldValues[id] ?? "")]),
    ) as Record<string, string>,
    validators: { onSubmit: DefaultModelFormSchema },
    onSubmit: async ({ value }) => {
      const toastId = toast.loading("Submitting default model...");
      try {
        await saveMutation.mutateAsync(value as z.infer<typeof DefaultModelFormSchema>);
        toast.success("Default model saved.", { id: toastId });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save default model.", {
          id: toastId,
        });
        throw error;
      }
    },
  });

  return (
    <form.AppForm>
      <form.Form>
        <Card className="p-4">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <p className="col-span-full text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Default model
            </p>
            {DefaultModelFields.map((providerField) => (
              <form.AppField
                key={providerField.name}
                name={providerField.name}
                children={(field) => (
                  <field.Field>
                    <field.FieldLabel>{providerField.label}</field.FieldLabel>
                    <field.Input
                      type={providerField.type ?? "text"}
                      autoComplete={providerField.autoComplete}
                      placeholder={
                        providerField.placeholder ?? `Enter ${providerField.label.toLowerCase()}`
                      }
                    />
                  </field.Field>
                )}
              />
            ))}
            <div className="col-span-full flex gap-2">
              <form.SubmitButton
                variant="primary"
                disabled={isDefaultsLoading || saveMutation.isPending}
              >
                Save default model
              </form.SubmitButton>
            </div>
            {saveMutation.isError ? (
              <p className="col-span-full text-xs text-danger">{saveMutation.error.message}</p>
            ) : null}
          </section>
        </Card>
      </form.Form>
    </form.AppForm>
  );
}

const OpenRouterFields: readonly ProviderFieldSpec[] = [
  {
    name: "model-provider-openrouter-api-key",
    label: "OpenRouter API key",
    type: "password",
  },
  { name: "model-provider-openrouter-base-url", label: "OpenRouter base url" },
];

const OpenRouterFormSchema = z.object({
  "model-provider-openrouter-api-key": z.string().trim(),
  "model-provider-openrouter-base-url": z.string().trim(),
});

function OpenRouterForm(props: {
  defaultFieldValues: Record<string, string | undefined>;
  isDefaultsLoading: boolean;
  onMutate: (payload: ModelProvidersSavePayload) => Promise<unknown>;
}) {
  const saveMutation = useMutation({
    mutationFn: async (values: z.infer<typeof OpenRouterFormSchema>) =>
      props.onMutate({
        env: {
          set: createEnvSet([
            ["OPENROUTER_API_KEY", values["model-provider-openrouter-api-key"]],
            ["OPENROUTER_BASE_URL", values["model-provider-openrouter-base-url"]],
          ]),
        },
      }),
  });
  const clearMutation = useMutation({
    mutationFn: async () =>
      props.onMutate({
        env: { remove: ["OPENROUTER_API_KEY", "OPENROUTER_BASE_URL"] },
      }),
  });
  const fieldIds = OpenRouterFields.map((field) => field.name);
  const form = useAppForm({
    defaultValues: Object.fromEntries(
      fieldIds.map((id) => [id, String(props.defaultFieldValues[id] ?? "")]),
    ) as Record<string, string>,
    validators: { onSubmit: OpenRouterFormSchema },
    onSubmit: async ({ value }) => {
      const toastId = toast.loading("Submitting OpenRouter settings...");
      try {
        await saveMutation.mutateAsync(value as z.infer<typeof OpenRouterFormSchema>);
        toast.success("OpenRouter settings saved.", { id: toastId });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save OpenRouter settings.",
          {
            id: toastId,
          },
        );
        throw error;
      }
    },
  });
  return (
    <form.AppForm>
      <form.Form>
        <Card className="p-4">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <p className="col-span-full text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              OpenRouter
            </p>
            {OpenRouterFields.map((providerField) => (
              <form.AppField key={providerField.name} name={providerField.name}>
                {(field) => (
                  <field.Field>
                    <field.FieldLabel>{providerField.label}</field.FieldLabel>
                    <field.Input
                      type={providerField.type ?? "text"}
                      autoComplete={providerField.autoComplete}
                      placeholder={
                        providerField.placeholder ?? `Enter ${providerField.label.toLowerCase()}`
                      }
                    />
                  </field.Field>
                )}
              </form.AppField>
            ))}
            <div className="col-span-full flex gap-2">
              <form.SubmitButton
                variant="primary"
                disabled={
                  props.isDefaultsLoading || saveMutation.isPending || clearMutation.isPending
                }
              >
                Save OpenRouter
              </form.SubmitButton>
              <Button
                type="button"
                variant="secondary"
                disabled={
                  props.isDefaultsLoading || saveMutation.isPending || clearMutation.isPending
                }
                onClick={() => void clearMutation.mutateAsync()}
              >
                Clear OpenRouter keys
              </Button>
            </div>
            {saveMutation.isError ? (
              <p className="col-span-full text-xs text-danger">{saveMutation.error.message}</p>
            ) : null}
            {clearMutation.isError ? (
              <p className="col-span-full text-xs text-danger">{clearMutation.error.message}</p>
            ) : null}
          </section>
        </Card>
      </form.Form>
    </form.AppForm>
  );
}

const ClaudeFields: readonly ProviderFieldSpec[] = [
  {
    name: "model-provider-anthropic-api-key",
    label: "Anthropic API key",
    type: "password",
  },
];

const ClaudeFormSchema = z.object({
  "model-provider-anthropic-api-key": z.string().trim(),
});

function ClaudeForm(props: {
  defaultFieldValues: Record<string, string | undefined>;
  isDefaultsLoading: boolean;
  onMutate: (payload: ModelProvidersSavePayload) => Promise<unknown>;
}) {
  const saveMutation = useMutation({
    mutationFn: async (values: z.infer<typeof ClaudeFormSchema>) => {
      const anthropicKey = values["model-provider-anthropic-api-key"];
      return props.onMutate({
        env: {
          set: createEnvSet([["ANTHROPIC_API_KEY", anthropicKey]]),
        },
      });
    },
  });
  const clearMutation = useMutation({
    mutationFn: async () => props.onMutate({ env: { remove: ["ANTHROPIC_API_KEY"] } }),
  });
  const fieldIds = ClaudeFields.map((field) => field.name);
  const form = useAppForm({
    defaultValues: Object.fromEntries(
      fieldIds.map((id) => [id, String(props.defaultFieldValues[id] ?? "")]),
    ) as Record<string, string>,
    validators: { onSubmit: ClaudeFormSchema },
    onSubmit: async ({ value }) => {
      const toastId = toast.loading("Submitting Claude settings...");
      try {
        await saveMutation.mutateAsync(value as z.infer<typeof ClaudeFormSchema>);
        toast.success("Claude settings saved.", { id: toastId });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save Claude settings.", {
          id: toastId,
        });
        throw error;
      }
    },
  });
  return (
    <form.AppForm>
      <form.Form>
        <Card className="p-4">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <p className="col-span-full text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Claude
            </p>
            {ClaudeFields.map((providerField) => (
              <form.AppField key={providerField.name} name={providerField.name}>
                {(field) => (
                  <field.Field>
                    <field.FieldLabel>{providerField.label}</field.FieldLabel>
                    <field.Input
                      type={providerField.type ?? "text"}
                      autoComplete={providerField.autoComplete}
                      placeholder={
                        providerField.placeholder ?? `Enter ${providerField.label.toLowerCase()}`
                      }
                    />
                  </field.Field>
                )}
              </form.AppField>
            ))}
            <div className="col-span-full flex gap-2">
              <form.SubmitButton
                variant="primary"
                disabled={
                  props.isDefaultsLoading || saveMutation.isPending || clearMutation.isPending
                }
              >
                Save Claude
              </form.SubmitButton>
              <Button
                type="button"
                variant="secondary"
                disabled={
                  props.isDefaultsLoading || saveMutation.isPending || clearMutation.isPending
                }
                onClick={() => void clearMutation.mutateAsync()}
              >
                Clear Claude keys
              </Button>
            </div>
            {saveMutation.isError ? (
              <p className="col-span-full text-xs text-danger">{saveMutation.error.message}</p>
            ) : null}
            {clearMutation.isError ? (
              <p className="col-span-full text-xs text-danger">{clearMutation.error.message}</p>
            ) : null}
          </section>
        </Card>
      </form.Form>
    </form.AppForm>
  );
}

const OpenAiFields: readonly ProviderFieldSpec[] = [
  {
    name: "model-provider-openai-api-key",
    label: "OpenAI API key",
    type: "password",
  },
  { name: "model-provider-openai-base-url", label: "OpenAI base url" },
];

const OpenAiFormSchema = z.object({
  "model-provider-openai-api-key": z.string().trim(),
  "model-provider-openai-base-url": z.string().trim(),
});

function OpenAiForm(props: {
  defaultFieldValues: Record<string, string | undefined>;
  isDefaultsLoading: boolean;
  onMutate: (payload: ModelProvidersSavePayload) => Promise<unknown>;
}) {
  const saveMutation = useMutation({
    mutationFn: async (values: z.infer<typeof OpenAiFormSchema>) =>
      props.onMutate({
        env: {
          set: createEnvSet([
            ["OPENAI_API_KEY", values["model-provider-openai-api-key"]],
            ["OPENAI_BASE_URL", values["model-provider-openai-base-url"]],
          ]),
        },
      }),
  });
  const clearMutation = useMutation({
    mutationFn: async () =>
      props.onMutate({
        env: { remove: ["OPENAI_API_KEY", "OPENAI_BASE_URL"] },
      }),
  });
  const fieldIds = OpenAiFields.map((field) => field.name);
  const form = useAppForm({
    defaultValues: Object.fromEntries(
      fieldIds.map((id) => [id, String(props.defaultFieldValues[id] ?? "")]),
    ) as Record<string, string>,
    validators: { onSubmit: OpenAiFormSchema },
    onSubmit: async ({ value }) => {
      const toastId = toast.loading("Submitting OpenAI settings...");
      try {
        await saveMutation.mutateAsync(value as z.infer<typeof OpenAiFormSchema>);
        toast.success("OpenAI settings saved.", { id: toastId });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save OpenAI settings.", {
          id: toastId,
        });
        throw error;
      }
    },
  });
  return (
    <form.AppForm>
      <form.Form>
        <Card className="p-4">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <p className="col-span-full text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              OpenAI
            </p>
            {OpenAiFields.map((providerField) => (
              <form.AppField key={providerField.name} name={providerField.name}>
                {(field) => (
                  <field.Field>
                    <field.FieldLabel>{providerField.label}</field.FieldLabel>
                    <field.Input
                      type={providerField.type ?? "text"}
                      autoComplete={providerField.autoComplete}
                      placeholder={
                        providerField.placeholder ?? `Enter ${providerField.label.toLowerCase()}`
                      }
                    />
                  </field.Field>
                )}
              </form.AppField>
            ))}
            <div className="col-span-full flex gap-2">
              <form.SubmitButton
                variant="primary"
                disabled={
                  props.isDefaultsLoading || saveMutation.isPending || clearMutation.isPending
                }
              >
                Save OpenAI
              </form.SubmitButton>
              <Button
                type="button"
                variant="secondary"
                disabled={
                  props.isDefaultsLoading || saveMutation.isPending || clearMutation.isPending
                }
                onClick={() => void clearMutation.mutateAsync()}
              >
                Clear OpenAI keys
              </Button>
            </div>
            {saveMutation.isError ? (
              <p className="col-span-full text-xs text-danger">{saveMutation.error.message}</p>
            ) : null}
            {clearMutation.isError ? (
              <p className="col-span-full text-xs text-danger">{clearMutation.error.message}</p>
            ) : null}
          </section>
        </Card>
      </form.Form>
    </form.AppForm>
  );
}

const GeminiFields: readonly ProviderFieldSpec[] = [
  {
    name: "model-provider-google-api-key",
    label: "Google API key",
    type: "password",
  },
  { name: "model-provider-gemini-base-url", label: "Gemini base url" },
];

const GeminiFormSchema = z.object({
  "model-provider-google-api-key": z.string().trim(),
  "model-provider-gemini-base-url": z.string().trim(),
});

function GeminiForm(props: {
  defaultFieldValues: Record<string, string | undefined>;
  isDefaultsLoading: boolean;
  onMutate: (payload: ModelProvidersSavePayload) => Promise<unknown>;
}) {
  const saveMutation = useMutation({
    mutationFn: async (values: z.infer<typeof GeminiFormSchema>) =>
      props.onMutate({
        env: {
          set: createEnvSet([
            ["GOOGLE_API_KEY", values["model-provider-google-api-key"]],
            ["GEMINI_BASE_URL", values["model-provider-gemini-base-url"]],
          ]),
        },
      }),
  });
  const clearMutation = useMutation({
    mutationFn: async () =>
      props.onMutate({
        env: { remove: ["GOOGLE_API_KEY", "GEMINI_BASE_URL"] },
      }),
  });
  const fieldIds = GeminiFields.map((field) => field.name);
  const form = useAppForm({
    defaultValues: Object.fromEntries(
      fieldIds.map((id) => [id, String(props.defaultFieldValues[id] ?? "")]),
    ) as Record<string, string>,
    validators: { onSubmit: GeminiFormSchema },
    onSubmit: async ({ value }) => {
      const toastId = toast.loading("Submitting Gemini settings...");
      try {
        await saveMutation.mutateAsync(value as z.infer<typeof GeminiFormSchema>);
        toast.success("Gemini settings saved.", { id: toastId });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save Gemini settings.", {
          id: toastId,
        });
        throw error;
      }
    },
  });
  return (
    <form.AppForm>
      <form.Form>
        <Card className="p-4">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <p className="col-span-full text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Gemini
            </p>
            {GeminiFields.map((providerField) => (
              <form.AppField key={providerField.name} name={providerField.name}>
                {(field) => (
                  <field.Field>
                    <field.FieldLabel>{providerField.label}</field.FieldLabel>
                    <field.Input
                      type={providerField.type ?? "text"}
                      autoComplete={providerField.autoComplete}
                      placeholder={
                        providerField.placeholder ?? `Enter ${providerField.label.toLowerCase()}`
                      }
                    />
                  </field.Field>
                )}
              </form.AppField>
            ))}
            <div className="col-span-full flex gap-2">
              <form.SubmitButton
                variant="primary"
                disabled={
                  props.isDefaultsLoading || saveMutation.isPending || clearMutation.isPending
                }
              >
                Save Gemini
              </form.SubmitButton>
              <Button
                type="button"
                variant="secondary"
                disabled={
                  props.isDefaultsLoading || saveMutation.isPending || clearMutation.isPending
                }
                onClick={() => void clearMutation.mutateAsync()}
              >
                Clear Gemini keys
              </Button>
            </div>
            {saveMutation.isError ? (
              <p className="col-span-full text-xs text-danger">{saveMutation.error.message}</p>
            ) : null}
            {clearMutation.isError ? (
              <p className="col-span-full text-xs text-danger">{clearMutation.error.message}</p>
            ) : null}
          </section>
        </Card>
      </form.Form>
    </form.AppForm>
  );
}
