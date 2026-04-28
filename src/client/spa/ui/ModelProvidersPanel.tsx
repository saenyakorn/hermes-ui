import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
      const [env, hints] = await Promise.all([
        api.getEnvRead(),
        api.getWorkspaceConfigHints(),
      ]);
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

  return (
    <section
      data-tab-panel="model-providers"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-2"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-text sm:text-base">
        Model providers
      </p>
      <p
        id="model-providers-env-hint"
        className="mt-2 text-xs text-muted"
        aria-live="polite"
      >
        {defaultsQuery.isLoading
          ? "Loading provider settings..."
          : defaultsQuery.isError
            ? "Could not load provider defaults."
            : "Loaded provider settings."}
      </p>
      <div className="mt-3 flex w-full min-w-0 flex-col gap-3">
        <DefaultModelForm
          defaultFieldValues={defaultsQuery.data ?? {}}
          isDefaultsLoading={defaultsQuery.isLoading}
          onMutate={onMutate}
        />
        <OpenRouterForm
          defaultFieldValues={defaultsQuery.data ?? {}}
          isDefaultsLoading={defaultsQuery.isLoading}
          onMutate={onMutate}
        />
        <ClaudeForm
          defaultFieldValues={defaultsQuery.data ?? {}}
          isDefaultsLoading={defaultsQuery.isLoading}
          onMutate={onMutate}
        />
        <OpenAiForm
          defaultFieldValues={defaultsQuery.data ?? {}}
          isDefaultsLoading={defaultsQuery.isLoading}
          onMutate={onMutate}
        />
        <GeminiForm
          defaultFieldValues={defaultsQuery.data ?? {}}
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
      await saveMutation.mutateAsync(
        value as z.infer<typeof DefaultModelFormSchema>,
      );
    },
  });

  return (
    <form.AppForm>
      <Card className="p-4">
        <section className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
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
                      providerField.placeholder ??
                      `Enter ${providerField.label.toLowerCase()}`
                    }
                  />
                </field.Field>
              )}
            />
          ))}
          <div className="flex gap-2">
            <form.SubmitButton
              variant="primary"
              disabled={isDefaultsLoading || saveMutation.isPending}
            >
              Save default model
            </form.SubmitButton>
          </div>
          {saveMutation.isError ? (
            <p className="text-xs text-danger">{saveMutation.error.message}</p>
          ) : null}
        </section>
      </Card>
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
          set: {
            ...(values["model-provider-openrouter-api-key"]
              ? {
                  OPENROUTER_API_KEY:
                    values["model-provider-openrouter-api-key"],
                }
              : {}),
            ...(values["model-provider-openrouter-base-url"]
              ? {
                  OPENROUTER_BASE_URL:
                    values["model-provider-openrouter-base-url"],
                }
              : {}),
          },
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
      await saveMutation.mutateAsync(
        value as z.infer<typeof OpenRouterFormSchema>,
      );
    },
  });
  return (
    <form.AppForm>
      <Card className="p-4">
        <section className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
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
                      providerField.placeholder ??
                      `Enter ${providerField.label.toLowerCase()}`
                    }
                  />
                </field.Field>
              )}
            </form.AppField>
          ))}
          <div className="flex gap-2">
            <form.SubmitButton
              variant="primary"
              disabled={
                props.isDefaultsLoading ||
                saveMutation.isPending ||
                clearMutation.isPending
              }
            >
              Save OpenRouter
            </form.SubmitButton>
            <Button
              type="button"
              variant="secondary"
              disabled={
                props.isDefaultsLoading ||
                saveMutation.isPending ||
                clearMutation.isPending
              }
              onClick={() => void clearMutation.mutateAsync()}
            >
              Clear OpenRouter keys
            </Button>
          </div>
          {saveMutation.isError ? (
            <p className="text-xs text-danger">{saveMutation.error.message}</p>
          ) : null}
          {clearMutation.isError ? (
            <p className="text-xs text-danger">{clearMutation.error.message}</p>
          ) : null}
        </section>
      </Card>
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
        env: { set: anthropicKey ? { ANTHROPIC_API_KEY: anthropicKey } : {} },
      });
    },
  });
  const clearMutation = useMutation({
    mutationFn: async () =>
      props.onMutate({ env: { remove: ["ANTHROPIC_API_KEY"] } }),
  });
  const fieldIds = ClaudeFields.map((field) => field.name);
  const form = useAppForm({
    defaultValues: Object.fromEntries(
      fieldIds.map((id) => [id, String(props.defaultFieldValues[id] ?? "")]),
    ) as Record<string, string>,
    validators: { onSubmit: ClaudeFormSchema },
    onSubmit: async ({ value }) => {
      await saveMutation.mutateAsync(value as z.infer<typeof ClaudeFormSchema>);
    },
  });
  return (
    <form.AppForm>
      <Card className="p-4">
        <section className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
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
                      providerField.placeholder ??
                      `Enter ${providerField.label.toLowerCase()}`
                    }
                  />
                </field.Field>
              )}
            </form.AppField>
          ))}
          <div className="flex gap-2">
            <form.SubmitButton
              variant="primary"
              disabled={
                props.isDefaultsLoading ||
                saveMutation.isPending ||
                clearMutation.isPending
              }
            >
              Save Claude
            </form.SubmitButton>
            <Button
              type="button"
              variant="secondary"
              disabled={
                props.isDefaultsLoading ||
                saveMutation.isPending ||
                clearMutation.isPending
              }
              onClick={() => void clearMutation.mutateAsync()}
            >
              Clear Claude keys
            </Button>
          </div>
          {saveMutation.isError ? (
            <p className="text-xs text-danger">{saveMutation.error.message}</p>
          ) : null}
          {clearMutation.isError ? (
            <p className="text-xs text-danger">{clearMutation.error.message}</p>
          ) : null}
        </section>
      </Card>
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
          set: {
            ...(values["model-provider-openai-api-key"]
              ? { OPENAI_API_KEY: values["model-provider-openai-api-key"] }
              : {}),
            ...(values["model-provider-openai-base-url"]
              ? { OPENAI_BASE_URL: values["model-provider-openai-base-url"] }
              : {}),
          },
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
      await saveMutation.mutateAsync(value as z.infer<typeof OpenAiFormSchema>);
    },
  });
  return (
    <form.AppForm>
      <Card className="p-4">
        <section className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
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
                      providerField.placeholder ??
                      `Enter ${providerField.label.toLowerCase()}`
                    }
                  />
                </field.Field>
              )}
            </form.AppField>
          ))}
          <div className="flex gap-2">
            <form.SubmitButton
              variant="primary"
              disabled={
                props.isDefaultsLoading ||
                saveMutation.isPending ||
                clearMutation.isPending
              }
            >
              Save OpenAI
            </form.SubmitButton>
            <Button
              type="button"
              variant="secondary"
              disabled={
                props.isDefaultsLoading ||
                saveMutation.isPending ||
                clearMutation.isPending
              }
              onClick={() => void clearMutation.mutateAsync()}
            >
              Clear OpenAI keys
            </Button>
          </div>
          {saveMutation.isError ? (
            <p className="text-xs text-danger">{saveMutation.error.message}</p>
          ) : null}
          {clearMutation.isError ? (
            <p className="text-xs text-danger">{clearMutation.error.message}</p>
          ) : null}
        </section>
      </Card>
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
          set: {
            ...(values["model-provider-google-api-key"]
              ? { GOOGLE_API_KEY: values["model-provider-google-api-key"] }
              : {}),
            ...(values["model-provider-gemini-base-url"]
              ? { GEMINI_BASE_URL: values["model-provider-gemini-base-url"] }
              : {}),
          },
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
      await saveMutation.mutateAsync(value as z.infer<typeof GeminiFormSchema>);
    },
  });
  return (
    <form.AppForm>
      <Card className="p-4">
        <section className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
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
                      providerField.placeholder ??
                      `Enter ${providerField.label.toLowerCase()}`
                    }
                  />
                </field.Field>
              )}
            </form.AppField>
          ))}
          <div className="flex gap-2">
            <form.SubmitButton
              variant="primary"
              disabled={
                props.isDefaultsLoading ||
                saveMutation.isPending ||
                clearMutation.isPending
              }
            >
              Save Gemini
            </form.SubmitButton>
            <Button
              type="button"
              variant="secondary"
              disabled={
                props.isDefaultsLoading ||
                saveMutation.isPending ||
                clearMutation.isPending
              }
              onClick={() => void clearMutation.mutateAsync()}
            >
              Clear Gemini keys
            </Button>
          </div>
          {saveMutation.isError ? (
            <p className="text-xs text-danger">{saveMutation.error.message}</p>
          ) : null}
          {clearMutation.isError ? (
            <p className="text-xs text-danger">{clearMutation.error.message}</p>
          ) : null}
        </section>
      </Card>
    </form.AppForm>
  );
}
