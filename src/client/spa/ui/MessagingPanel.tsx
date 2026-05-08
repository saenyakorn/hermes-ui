import { useMemo } from "react";
import { Accordion } from "@base-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ApiFetcher, type ModelProvidersSavePayload } from "../../api-fetcher";
import { useWorkspaceProfileSubscribed } from "../workspace-profile";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { YamlEditor } from "../../components/YamlEditor";
import {
  Select,
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "../../components/Select";
import { useAppForm } from "../../components/tanstack-form";
import { resolveAllWorkspaceIntegrationFieldValues } from "../../hooks/useWorkspaceFieldSources";
import { cn } from "../../lib/cn";
import {
  dispatchEnvReloadRequest,
  dispatchEnvSnapshot,
  dispatchGatewayStatus,
} from "../../lib/event";
import { toast } from "../../lib/sonner";
import type { EnvReadResult } from "../../../server/types";
import { createEnvSet, createFormKey } from "./integrations/formHelpers";

type TextFieldConfig = {
  readonly id: string;
  readonly label: string;
  readonly className?: string;
  readonly type?: "text" | "password";
  readonly autoComplete?: string;
  readonly placeholder?: string;
  readonly dataDiscordKey?: string;
};

type SelectFieldConfig = {
  readonly id: string;
  readonly label: string;
  readonly className?: string;
  readonly dataDiscordKey?: string;
  readonly options: readonly string[];
};

const discordBaseFields: readonly TextFieldConfig[] = [
  {
    id: "discord-bot-token",
    label: "Discord bot token",
    type: "password",
    autoComplete: "new-password",
    placeholder: "Leave unchanged if already set",
    dataDiscordKey: "DISCORD_BOT_TOKEN",
  },
  {
    id: "discord-allowed-users",
    label: "Discord allowed users",
    type: "text",
    autoComplete: "off",
    placeholder: "Leave empty to keep current value",
  },
];

const discordAdvancedTextFields: readonly TextFieldConfig[] = [
  {
    id: "discord-advanced-allowed-roles",
    label: "Discord allowed roles",
    dataDiscordKey: "DISCORD_ALLOWED_ROLES",
  },
  {
    id: "discord-advanced-allowed-channels",
    label: "Discord allowed channels",
    dataDiscordKey: "DISCORD_ALLOWED_CHANNELS",
  },
  {
    id: "discord-advanced-free-response-channels",
    label: "Discord free response channels",
    className: "sm:col-span-2",
    dataDiscordKey: "DISCORD_FREE_RESPONSE_CHANNELS",
  },
  {
    id: "discord-advanced-home-channel",
    label: "Discord home channel",
    dataDiscordKey: "DISCORD_HOME_CHANNEL",
  },
  {
    id: "discord-advanced-home-channel-name",
    label: "Discord home channel name",
    dataDiscordKey: "DISCORD_HOME_CHANNEL_NAME",
  },
  {
    id: "discord-advanced-proxy",
    label: "Discord proxy",
    className: "sm:col-span-2",
    dataDiscordKey: "DISCORD_PROXY",
  },
  {
    id: "discord-advanced-ignored-channels",
    label: "Discord ignored channels",
    className: "sm:col-span-2",
    dataDiscordKey: "DISCORD_IGNORED_CHANNELS",
  },
  {
    id: "discord-advanced-no-thread-channels",
    label: "Discord no thread channels",
    className: "sm:col-span-2",
    dataDiscordKey: "DISCORD_NO_THREAD_CHANNELS",
  },
];

const discordChannelPromptsField = {
  id: "discord-advanced-channel-prompts",
  label: "Discord channel prompts",
  className: "sm:col-span-2",
  dataDiscordKey: "DISCORD_CHANNEL_PROMPTS",
} as const;

const discordAdvancedSelectFields: readonly SelectFieldConfig[] = [
  {
    id: "discord-advanced-command-sync-policy",
    label: "Discord command sync policy",
    dataDiscordKey: "DISCORD_COMMAND_SYNC_POLICY",
    options: ["safe", "bulk", "off"],
  },
  {
    id: "discord-advanced-reply-mode",
    label: "Discord reply mode",
    dataDiscordKey: "DISCORD_REPLY_TO_MODE",
    options: ["off", "first", "all"],
  },
  {
    id: "discord-advanced-require-mention",
    label: "Discord require mention",
    dataDiscordKey: "DISCORD_REQUIRE_MENTION",
    options: ["true", "false"],
  },
  {
    id: "discord-advanced-auto-thread",
    label: "Discord auto thread",
    dataDiscordKey: "DISCORD_AUTO_THREAD",
    options: ["true", "false"],
  },
  {
    id: "discord-advanced-reactions",
    label: "Discord reactions",
    dataDiscordKey: "DISCORD_REACTIONS",
    options: ["true", "false"],
  },
  {
    id: "discord-advanced-allow-mention-everyone",
    label: "Allow @everyone",
    dataDiscordKey: "DISCORD_ALLOW_MENTION_EVERYONE",
    options: ["true", "false"],
  },
  {
    id: "discord-advanced-allow-mention-roles",
    label: "Allow role mentions",
    dataDiscordKey: "DISCORD_ALLOW_MENTION_ROLES",
    options: ["true", "false"],
  },
  {
    id: "discord-advanced-allow-mention-users",
    label: "Allow user mentions",
    dataDiscordKey: "DISCORD_ALLOW_MENTION_USERS",
    options: ["true", "false"],
  },
  {
    id: "discord-advanced-allow-mention-replied-user",
    label: "Allow replied user mention",
    dataDiscordKey: "DISCORD_ALLOW_MENTION_REPLIED_USER",
    options: ["true", "false"],
  },
  {
    id: "discord-advanced-ignore-no-mention",
    label: "Ignore no mention",
    dataDiscordKey: "DISCORD_IGNORE_NO_MENTION",
    options: ["true", "false"],
  },
  {
    id: "discord-advanced-group-sessions-per-user",
    label: "Group sessions per user",
    dataDiscordKey: "GROUP_SESSIONS_PER_USER",
    options: ["true", "false"],
  },
];

const slackFields: readonly TextFieldConfig[] = [
  {
    id: "slack-bot-token",
    label: "Slack bot token",
    type: "password",
    autoComplete: "new-password",
    placeholder: "Leave unchanged if already set",
  },
  {
    id: "slack-app-token",
    label: "Slack app token",
    type: "password",
    autoComplete: "new-password",
    placeholder: "Leave unchanged if already set",
  },
];

const DISCORD_FIELD_IDS = [
  "discord-bot-token",
  "discord-allowed-users",
  "discord-advanced-allowed-roles",
  "discord-advanced-allowed-channels",
  "discord-advanced-free-response-channels",
  "discord-advanced-home-channel",
  "discord-advanced-home-channel-name",
  "discord-advanced-proxy",
  "discord-advanced-ignored-channels",
  "discord-advanced-no-thread-channels",
  "discord-advanced-channel-prompts",
  "discord-advanced-command-sync-policy",
  "discord-advanced-reply-mode",
  "discord-advanced-require-mention",
  "discord-advanced-auto-thread",
  "discord-advanced-reactions",
  "discord-advanced-allow-mention-everyone",
  "discord-advanced-allow-mention-roles",
  "discord-advanced-allow-mention-users",
  "discord-advanced-allow-mention-replied-user",
  "discord-advanced-ignore-no-mention",
  "discord-advanced-group-sessions-per-user",
] as const;

const SLACK_FIELD_IDS = ["slack-bot-token", "slack-app-token"] as const;

const DISCORD_ENV_REMOVE_KEYS = [
  "DISCORD_BOT_TOKEN",
  "DISCORD_ALLOWED_USERS",
  "DISCORD_ALLOWED_ROLES",
  "DISCORD_ALLOWED_CHANNELS",
  "DISCORD_HOME_CHANNEL",
  "DISCORD_HOME_CHANNEL_NAME",
  "DISCORD_PROXY",
  "DISCORD_COMMAND_SYNC_POLICY",
  "DISCORD_REPLY_TO_MODE",
  "DISCORD_IGNORE_NO_MENTION",
] as const;

const SLACK_ENV_REMOVE_KEYS = ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"] as const;

const discordFormSchema = z.object({
  "discord-bot-token": z.string(),
  "discord-allowed-users": z.string(),
  "discord-advanced-allowed-roles": z.string(),
  "discord-advanced-allowed-channels": z.string(),
  "discord-advanced-free-response-channels": z.string(),
  "discord-advanced-home-channel": z.string(),
  "discord-advanced-home-channel-name": z.string(),
  "discord-advanced-proxy": z.string(),
  "discord-advanced-ignored-channels": z.string(),
  "discord-advanced-no-thread-channels": z.string(),
  "discord-advanced-channel-prompts": z.string(),
  "discord-advanced-command-sync-policy": z.string(),
  "discord-advanced-reply-mode": z.string(),
  "discord-advanced-require-mention": z.string(),
  "discord-advanced-auto-thread": z.string(),
  "discord-advanced-reactions": z.string(),
  "discord-advanced-allow-mention-everyone": z.string(),
  "discord-advanced-allow-mention-roles": z.string(),
  "discord-advanced-allow-mention-users": z.string(),
  "discord-advanced-allow-mention-replied-user": z.string(),
  "discord-advanced-ignore-no-mention": z.string(),
  "discord-advanced-group-sessions-per-user": z.string(),
});

type DiscordFormValues = z.infer<typeof discordFormSchema>;

const slackFormSchema = z.object({
  "slack-bot-token": z.string(),
  "slack-app-token": z.string(),
});

type SlackFormValues = z.infer<typeof slackFormSchema>;

type OnMutate = (payload: ModelProvidersSavePayload) => Promise<unknown>;

type SectionProps = {
  defaultFieldValues: Record<string, string | undefined>;
  isDefaultsLoading: boolean;
  onMutate: OnMutate;
};

function buildDefaults<TKeys extends readonly string[]>(
  fieldIds: TKeys,
  defaultFieldValues: Record<string, string | undefined>,
): Record<TKeys[number], string> {
  const defaults = {} as Record<TKeys[number], string>;
  for (const fieldId of fieldIds) {
    defaults[fieldId as TKeys[number]] = String(defaultFieldValues[fieldId] ?? "");
  }
  return defaults;
}

function countEnvKeysWithPrefix(env: EnvReadResult | undefined, prefix: string): number {
  if (!env) return 0;
  return env.entries.filter((entry) => entry.key.startsWith(prefix)).length;
}

function buildMessagingHint(env: EnvReadResult | undefined): string {
  if (!env) return "Loading…";
  const discordCount = countEnvKeysWithPrefix(env, "DISCORD_");
  const slackCount = countEnvKeysWithPrefix(env, "SLACK_");
  const discordPart =
    discordCount > 0
      ? `Discord: ${String(discordCount)} DISCORD_* key(s) in .env`
      : "Discord: no DISCORD_* in .env";
  const slackPart =
    slackCount > 0
      ? `Slack: ${String(slackCount)} SLACK_* key(s) in .env`
      : "Slack: no SLACK_* in .env";
  return `${discordPart} · ${slackPart}`;
}

export function MessagingPanel() {
  const { profile } = useWorkspaceProfileSubscribed();
  const api = useMemo(() => new ApiFetcher(), []);
  const queryClient = useQueryClient();
  const defaultsQuery = useQuery({
    queryKey: ["messaging-default-values", profile ?? "default"],
    queryFn: async () => {
      const [env, hints] = await Promise.all([
        api.getEnvRead(profile),
        api.getWorkspaceConfigHints(profile),
      ]);
      return {
        env,
        fieldValues: resolveAllWorkspaceIntegrationFieldValues(env, hints),
      };
    },
  });

  const onMutate: OnMutate = async (payload) => {
    const response = await api.postModelProvidersSettings(profile, payload);
    dispatchGatewayStatus(response.gateway);
    dispatchEnvSnapshot({ env: response.env, gateway: response.gateway, profile });
    dispatchEnvReloadRequest();
    void queryClient.invalidateQueries({
      queryKey: ["messaging-default-values", profile ?? "default"],
    });
    return response;
  };

  const defaultFieldValues = defaultsQuery.data?.fieldValues ?? {};

  const hint = defaultsQuery.isLoading
    ? "Loading…"
    : defaultsQuery.isError
      ? "Could not load .env"
      : buildMessagingHint(defaultsQuery.data?.env);

  const status = defaultsQuery.isError ? "Failed to load messaging data." : "Ready.";

  return (
    <section
      data-tab-panel="messaging"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-2"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-text sm:text-base">
        Messaging Platform
      </p>
      <p id="messaging-env-hint" className="mt-2 text-xs text-muted" aria-live="polite">
        {hint}
      </p>
      <div className="mt-3 flex w-full min-w-0 flex-col gap-8">
        <DiscordForm
          key={createFormKey(defaultFieldValues, [...DISCORD_FIELD_IDS])}
          defaultFieldValues={defaultFieldValues}
          isDefaultsLoading={defaultsQuery.isLoading}
          onMutate={onMutate}
        />
        <SlackForm
          key={createFormKey(defaultFieldValues, [...SLACK_FIELD_IDS])}
          defaultFieldValues={defaultFieldValues}
          isDefaultsLoading={defaultsQuery.isLoading}
          onMutate={onMutate}
        />
      </div>
      <p
        id="messaging-status"
        className={cn("mt-3 shrink-0 text-xs text-muted")}
        role="status"
        aria-live="polite"
      >
        {status}
      </p>
    </section>
  );
}

function buildDiscordSavePayload(values: DiscordFormValues): ModelProvidersSavePayload {
  const set = createEnvSet([
    ["DISCORD_BOT_TOKEN", values["discord-bot-token"]],
    ["DISCORD_ALLOWED_ROLES", values["discord-advanced-allowed-roles"]],
    ["DISCORD_ALLOWED_CHANNELS", values["discord-advanced-allowed-channels"]],
    ["DISCORD_HOME_CHANNEL", values["discord-advanced-home-channel"]],
    ["DISCORD_HOME_CHANNEL_NAME", values["discord-advanced-home-channel-name"]],
    ["DISCORD_PROXY", values["discord-advanced-proxy"]],
    ["DISCORD_COMMAND_SYNC_POLICY", values["discord-advanced-command-sync-policy"]],
    ["DISCORD_REPLY_TO_MODE", values["discord-advanced-reply-mode"]],
    ["DISCORD_IGNORE_NO_MENTION", values["discord-advanced-ignore-no-mention"]],
  ]);
  const discord = {
    allowed_users: values["discord-allowed-users"],
    require_mention: values["discord-advanced-require-mention"],
    free_response_channels: values["discord-advanced-free-response-channels"],
    auto_thread: values["discord-advanced-auto-thread"],
    reactions: values["discord-advanced-reactions"],
    ignored_channels: values["discord-advanced-ignored-channels"],
    no_thread_channels: values["discord-advanced-no-thread-channels"],
    channel_prompts: values["discord-advanced-channel-prompts"],
    allow_mentions_everyone: values["discord-advanced-allow-mention-everyone"],
    allow_mentions_roles: values["discord-advanced-allow-mention-roles"],
    allow_mentions_users: values["discord-advanced-allow-mention-users"],
    allow_mentions_replied_user: values["discord-advanced-allow-mention-replied-user"],
    group_sessions_per_user: values["discord-advanced-group-sessions-per-user"],
  };
  const hasDiscordConfig = Object.values(discord).some((value) => value.trim().length > 0);
  const payload: ModelProvidersSavePayload = {};
  if (Object.keys(set).length > 0) payload.env = { set };
  if (hasDiscordConfig) payload.discord = discord;
  return payload;
}

function DiscordForm({ defaultFieldValues, isDefaultsLoading, onMutate }: SectionProps) {
  const saveMutation = useMutation({
    mutationFn: async (values: DiscordFormValues) => {
      const payload = buildDiscordSavePayload(values);
      if (payload.env === undefined && payload.discord === undefined) {
        throw new Error("Nothing to save for Discord.");
      }
      return onMutate(payload);
    },
  });
  const clearMutation = useMutation({
    mutationFn: async () =>
      onMutate({
        env: { remove: [...DISCORD_ENV_REMOVE_KEYS] },
        discord: {
          allowed_users: "",
          require_mention: "",
          free_response_channels: "",
          auto_thread: "",
          reactions: "",
          ignored_channels: "",
          no_thread_channels: "",
          channel_prompts: "",
          allow_mentions_everyone: "",
          allow_mentions_roles: "",
          allow_mentions_users: "",
          allow_mentions_replied_user: "",
          group_sessions_per_user: "",
        },
      }),
  });

  const form = useAppForm({
    defaultValues: buildDefaults(DISCORD_FIELD_IDS, defaultFieldValues),
    validators: { onSubmit: discordFormSchema },
    onSubmit: async ({ value }) => {
      console.log("WTF");
      const toastId = toast.loading("Saving Discord settings...");
      try {
        await saveMutation.mutateAsync(value);
        toast.success("Discord settings saved.", { id: toastId });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save Discord settings.", {
          id: toastId,
        });
        throw error;
      }
    },
  });

  const isBusy = isDefaultsLoading || saveMutation.isPending || clearMutation.isPending;

  return (
    <form.AppForm>
      <form.Form>
        <Card className="flex w-full min-w-0 flex-col p-5">
          <h3 className="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">
            Discord
          </h3>
          <div className="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            {discordBaseFields.map((config) => (
              <form.AppField key={config.id} name={config.id as keyof DiscordFormValues}>
                {(field) => (
                  <field.Field className={config.className}>
                    <field.FieldLabel className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted">
                      {config.label}
                    </field.FieldLabel>
                    <field.Input
                      data-discord-key={config.dataDiscordKey}
                      type={config.type ?? "text"}
                      autoComplete={config.autoComplete}
                      placeholder={config.placeholder ?? `Enter ${config.label.toLowerCase()}`}
                    />
                  </field.Field>
                )}
              </form.AppField>
            ))}
          </div>
          <Accordion.Root defaultValue={["advanced"]} className="mt-6">
            <Accordion.Item
              value="advanced"
              className="rounded-lg border border-frosted bg-surface/40 p-4"
            >
              <Accordion.Header>
                <Accordion.Trigger
                  id="messaging-discord-advanced"
                  className="flex w-full cursor-pointer items-center justify-between text-left text-sm font-normal normal-case text-text"
                >
                  Advanced options
                  <span aria-hidden>▾</span>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className="pt-4">
                <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                  {discordAdvancedTextFields.map((config) => (
                    <form.AppField key={config.id} name={config.id as keyof DiscordFormValues}>
                      {(field) => (
                        <field.Field className={config.className}>
                          <field.FieldLabel className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted">
                            {config.label}
                          </field.FieldLabel>
                          <field.Input
                            data-discord-key={config.dataDiscordKey}
                            type={config.type ?? "text"}
                            autoComplete={config.autoComplete}
                            placeholder={
                              config.placeholder ?? `Enter ${config.label.toLowerCase()}`
                            }
                            className="py-1.5"
                          />
                        </field.Field>
                      )}
                    </form.AppField>
                  ))}
                  <form.AppField name={discordChannelPromptsField.id as keyof DiscordFormValues}>
                    {(field) => (
                      <field.Field className={discordChannelPromptsField.className}>
                        <field.FieldLabel className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted">
                          {discordChannelPromptsField.label}
                        </field.FieldLabel>
                        <div
                          className="mt-1 min-h-[220px] w-full"
                          data-discord-key={discordChannelPromptsField.dataDiscordKey}
                        >
                          <YamlEditor
                            id="messaging-discord-channel-prompts-yaml"
                            height={220}
                            value={field.state.value}
                            onChange={(next) => field.handleChange(next)}
                          />
                        </div>
                      </field.Field>
                    )}
                  </form.AppField>
                  {discordAdvancedSelectFields.map((config) => (
                    <form.AppField key={config.id} name={config.id as keyof DiscordFormValues}>
                      {(field) => (
                        <field.Field className={config.className}>
                          <field.FieldLabel className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted">
                            {config.label}
                          </field.FieldLabel>
                          <Select
                            value={field.state.value}
                            onValueChange={(nextValue) =>
                              field.handleChange(String(nextValue ?? ""))
                            }
                          >
                            <SelectTrigger data-discord-key={config.dataDiscordKey}>
                              <SelectValue />
                              <SelectIcon aria-hidden>▾</SelectIcon>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">
                                <SelectItemText>Unchanged</SelectItemText>
                              </SelectItem>
                              {config.options.map((option) => (
                                <SelectItem key={option} value={option}>
                                  <SelectItemText>{option}</SelectItemText>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </field.Field>
                      )}
                    </form.AppField>
                  ))}
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
          <div className="mt-6 flex flex-wrap gap-2">
            <form.SubmitButton id="messaging-save-discord" variant="primary" disabled={isBusy}>
              Save Discord
            </form.SubmitButton>
            <Button
              id="messaging-clear-discord"
              type="button"
              variant="secondary"
              disabled={isBusy}
              onClick={() => {
                void (async () => {
                  const toastId = toast.loading("Clearing Discord keys...");
                  try {
                    await clearMutation.mutateAsync();
                    toast.success("Discord keys cleared.", { id: toastId });
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Failed to clear Discord keys.",
                      { id: toastId },
                    );
                  }
                })();
              }}
            >
              Clear Discord keys
            </Button>
          </div>
          {saveMutation.isError ? (
            <p className="mt-2 text-xs text-danger">{saveMutation.error.message}</p>
          ) : null}
          {clearMutation.isError ? (
            <p className="mt-2 text-xs text-danger">{clearMutation.error.message}</p>
          ) : null}
        </Card>
      </form.Form>
    </form.AppForm>
  );
}

function SlackForm({ defaultFieldValues, isDefaultsLoading, onMutate }: SectionProps) {
  const saveMutation = useMutation({
    mutationFn: async (values: SlackFormValues) => {
      const set = createEnvSet([
        ["SLACK_BOT_TOKEN", values["slack-bot-token"]],
        ["SLACK_APP_TOKEN", values["slack-app-token"]],
      ]);
      if (Object.keys(set).length === 0) {
        throw new Error("Nothing to save for Slack.");
      }
      return onMutate({ env: { set } });
    },
  });
  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!window.confirm("Remove Slack keys from data/.env and restart gateway?")) {
        return null;
      }
      return onMutate({ env: { remove: [...SLACK_ENV_REMOVE_KEYS] } });
    },
  });

  const form = useAppForm({
    defaultValues: buildDefaults(SLACK_FIELD_IDS, defaultFieldValues),
    validators: { onSubmit: slackFormSchema },
    onSubmit: async ({ value }) => {
      const toastId = toast.loading("Saving Slack settings...");
      try {
        await saveMutation.mutateAsync(value);
        toast.success("Slack settings saved.", { id: toastId });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save Slack settings.", {
          id: toastId,
        });
        throw error;
      }
    },
  });

  const isBusy = isDefaultsLoading || saveMutation.isPending || clearMutation.isPending;

  return (
    <form.AppForm>
      <form.Form>
        <Card className="flex w-full min-w-0 flex-col p-5">
          <h3 className="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">
            Slack (Socket Mode)
          </h3>
          <div className="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            {slackFields.map((config) => (
              <form.AppField key={config.id} name={config.id as keyof SlackFormValues}>
                {(field) => (
                  <field.Field className={config.className}>
                    <field.FieldLabel className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted">
                      {config.label}
                    </field.FieldLabel>
                    <field.Input
                      type={config.type ?? "text"}
                      autoComplete={config.autoComplete}
                      placeholder={config.placeholder ?? `Enter ${config.label.toLowerCase()}`}
                    />
                  </field.Field>
                )}
              </form.AppField>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <form.SubmitButton id="messaging-save-slack" variant="primary" disabled={isBusy}>
              Save Slack
            </form.SubmitButton>
            <Button
              id="messaging-clear-slack"
              type="button"
              variant="secondary"
              disabled={isBusy}
              onClick={() => {
                void (async () => {
                  const toastId = toast.loading("Clearing Slack keys...");
                  try {
                    await clearMutation.mutateAsync();
                    toast.success("Slack keys cleared.", { id: toastId });
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Failed to clear Slack keys.",
                      { id: toastId },
                    );
                  }
                })();
              }}
            >
              Clear Slack keys
            </Button>
          </div>
          {saveMutation.isError ? (
            <p className="mt-2 text-xs text-danger">{saveMutation.error.message}</p>
          ) : null}
          {clearMutation.isError ? (
            <p className="mt-2 text-xs text-danger">{clearMutation.error.message}</p>
          ) : null}
        </Card>
      </form.Form>
    </form.AppForm>
  );
}
