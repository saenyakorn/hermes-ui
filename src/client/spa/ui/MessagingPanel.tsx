import { Accordion } from "@base-ui/react";
import { z } from "zod";
import { Card } from "../../components/Card";
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
import { useMessagingModelProviders } from "../../hooks/useMessagingModelProviders";
import { cn } from "../../lib/cn";
import {
  ActionButton,
  type ActionConfig,
  type SelectFieldConfig,
  type TextFieldConfig,
} from "./integrations/IntegrationFormControls";

type MessagingAction = "saveDiscord" | "clearDiscord" | "saveSlack" | "clearSlack";

const discordBaseFields: readonly TextFieldConfig[] = [
  {
    id: "discord-bot-token",
    label: "Discord bot token",
    type: "password",
    autoComplete: "new-password",
    placeholder: "Leave unchanged if already set",
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

const actions: readonly ActionConfig<MessagingAction>[] = [
  {
    actionId: "messaging-save-discord",
    label: "Save Discord",
    kind: "primary",
    action: "saveDiscord",
  },
  {
    actionId: "messaging-clear-discord",
    label: "Clear Discord keys",
    kind: "secondary",
    action: "clearDiscord",
  },
  { actionId: "messaging-save-slack", label: "Save Slack", kind: "primary", action: "saveSlack" },
  {
    actionId: "messaging-clear-slack",
    label: "Clear Slack keys",
    kind: "secondary",
    action: "clearSlack",
  },
] as const;

export function MessagingPanel() {
  const integrations = useMessagingModelProviders();
  const messagingFormSchema = z.object({
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
    "slack-bot-token": z.string(),
    "slack-app-token": z.string(),
  });
  type MessagingFieldId = keyof z.infer<typeof messagingFormSchema>;
  const messagingFieldIds: readonly MessagingFieldId[] = [
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
    "slack-bot-token",
    "slack-app-token",
  ] as const;
  const form = useAppForm({
    defaultValues: {
      "discord-bot-token": String(integrations.fieldValues["discord-bot-token"] ?? ""),
      "discord-allowed-users": String(integrations.fieldValues["discord-allowed-users"] ?? ""),
      "discord-advanced-allowed-roles": String(
        integrations.fieldValues["discord-advanced-allowed-roles"] ?? "",
      ),
      "discord-advanced-allowed-channels": String(
        integrations.fieldValues["discord-advanced-allowed-channels"] ?? "",
      ),
      "discord-advanced-free-response-channels": String(
        integrations.fieldValues["discord-advanced-free-response-channels"] ?? "",
      ),
      "discord-advanced-home-channel": String(
        integrations.fieldValues["discord-advanced-home-channel"] ?? "",
      ),
      "discord-advanced-home-channel-name": String(
        integrations.fieldValues["discord-advanced-home-channel-name"] ?? "",
      ),
      "discord-advanced-proxy": String(integrations.fieldValues["discord-advanced-proxy"] ?? ""),
      "discord-advanced-ignored-channels": String(
        integrations.fieldValues["discord-advanced-ignored-channels"] ?? "",
      ),
      "discord-advanced-no-thread-channels": String(
        integrations.fieldValues["discord-advanced-no-thread-channels"] ?? "",
      ),
      "discord-advanced-command-sync-policy": String(
        integrations.fieldValues["discord-advanced-command-sync-policy"] ?? "",
      ),
      "discord-advanced-reply-mode": String(
        integrations.fieldValues["discord-advanced-reply-mode"] ?? "",
      ),
      "discord-advanced-require-mention": String(
        integrations.fieldValues["discord-advanced-require-mention"] ?? "",
      ),
      "discord-advanced-auto-thread": String(
        integrations.fieldValues["discord-advanced-auto-thread"] ?? "",
      ),
      "discord-advanced-reactions": String(
        integrations.fieldValues["discord-advanced-reactions"] ?? "",
      ),
      "discord-advanced-allow-mention-everyone": String(
        integrations.fieldValues["discord-advanced-allow-mention-everyone"] ?? "",
      ),
      "discord-advanced-allow-mention-roles": String(
        integrations.fieldValues["discord-advanced-allow-mention-roles"] ?? "",
      ),
      "discord-advanced-allow-mention-users": String(
        integrations.fieldValues["discord-advanced-allow-mention-users"] ?? "",
      ),
      "discord-advanced-allow-mention-replied-user": String(
        integrations.fieldValues["discord-advanced-allow-mention-replied-user"] ?? "",
      ),
      "discord-advanced-ignore-no-mention": String(
        integrations.fieldValues["discord-advanced-ignore-no-mention"] ?? "",
      ),
      "slack-bot-token": String(integrations.fieldValues["slack-bot-token"] ?? ""),
      "slack-app-token": String(integrations.fieldValues["slack-app-token"] ?? ""),
    },
    validators: {
      onSubmit: messagingFormSchema,
    },
    onSubmit: async () => {},
  });
  const messagingFormKey = messagingFieldIds
    .map((id) => `${id}:${String(integrations.fieldValues[id] ?? "")}`)
    .join("\u0001");
  const handlers: Record<MessagingAction, () => Promise<void>> = {
    saveDiscord: integrations.saveDiscord,
    clearDiscord: integrations.clearDiscord,
    saveSlack: integrations.saveSlack,
    clearSlack: integrations.clearSlack,
  };

  return (
    <section
      data-tab-panel="messaging"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-2"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-text sm:text-base">
        Messaging Platform
      </p>
      <p id="messaging-env-hint" className="mt-2 text-xs text-muted" aria-live="polite">
        {integrations.messagingHint}
      </p>
      <form.AppForm key={messagingFormKey}>
        <div className="mt-3 flex w-full min-w-0 flex-col gap-8">
          <Card className="flex w-full min-w-0 flex-col p-5">
            <h3 className="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">
              Discord
            </h3>
            <div className="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
              {discordBaseFields.map((config) => (
                <form.AppField
                  key={config.id}
                  name={config.id as MessagingFieldId}
                  children={(field) => (
                    <field.Field className={config.className}>
                      <field.FieldLabel className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted">
                        {config.label}
                      </field.FieldLabel>
                      <field.Input
                        id={config.id}
                        data-discord-key={config.dataDiscordKey}
                        type={config.type ?? "text"}
                        autoComplete={config.autoComplete}
                        placeholder={config.placeholder ?? `Enter ${config.label.toLowerCase()}`}
                        value={field.state.value}
                        onChange={(event) => {
                          const next = event.target.value;
                          field.handleChange(next);
                          integrations.setFieldValue(config.id, next);
                        }}
                      />
                    </field.Field>
                  )}
                />
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
                      <form.AppField
                        key={config.id}
                        name={config.id as MessagingFieldId}
                        children={(field) => (
                          <field.Field className={config.className}>
                            <field.FieldLabel className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted">
                              {config.label}
                            </field.FieldLabel>
                            <field.Input
                              id={config.id}
                              data-discord-key={config.dataDiscordKey}
                              type={config.type ?? "text"}
                              autoComplete={config.autoComplete}
                              placeholder={
                                config.placeholder ?? `Enter ${config.label.toLowerCase()}`
                              }
                              className="py-1.5"
                              value={field.state.value}
                              onChange={(event) => {
                                const next = event.target.value;
                                field.handleChange(next);
                                integrations.setFieldValue(config.id, next);
                              }}
                            />
                          </field.Field>
                        )}
                      />
                    ))}
                    {discordAdvancedSelectFields.map((config) => (
                      <form.AppField
                        key={config.id}
                        name={config.id as MessagingFieldId}
                        children={(field) => (
                          <field.Field className={config.className}>
                            <field.FieldLabel className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted">
                              {config.label}
                            </field.FieldLabel>
                            <Select
                              value={field.state.value}
                              onValueChange={(nextValue) => {
                                const next = String(nextValue ?? "");
                                field.handleChange(next);
                                integrations.setFieldValue(config.id, next);
                              }}
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
                      />
                    ))}
                  </div>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion.Root>
            <div className="mt-6 flex flex-wrap gap-2">
              {actions.slice(0, 2).map((config) => (
                <ActionButton
                  key={config.actionId}
                  actionId={config.actionId}
                  kind={config.kind}
                  disabled={integrations.messagingBusy}
                  onClick={() => {
                    void handlers[config.action]();
                  }}
                >
                  {config.label}
                </ActionButton>
              ))}
            </div>
          </Card>

          <Card className="flex w-full min-w-0 flex-col p-5">
            <h3 className="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">
              Slack (Socket Mode)
            </h3>
            <div className="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
              {slackFields.map((config) => (
                <form.AppField
                  key={config.id}
                  name={config.id as MessagingFieldId}
                  children={(field) => (
                    <field.Field className={config.className}>
                      <field.FieldLabel className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted">
                        {config.label}
                      </field.FieldLabel>
                      <field.Input
                        id={config.id}
                        data-discord-key={config.dataDiscordKey}
                        type={config.type ?? "text"}
                        autoComplete={config.autoComplete}
                        placeholder={config.placeholder ?? `Enter ${config.label.toLowerCase()}`}
                        value={field.state.value}
                        onChange={(event) => {
                          const next = event.target.value;
                          field.handleChange(next);
                          integrations.setFieldValue(config.id, next);
                        }}
                      />
                    </field.Field>
                  )}
                />
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {actions.slice(2).map((config) => (
                <ActionButton
                  key={config.actionId}
                  actionId={config.actionId}
                  kind={config.kind}
                  disabled={integrations.messagingBusy}
                  onClick={() => {
                    void handlers[config.action]();
                  }}
                >
                  {config.label}
                </ActionButton>
              ))}
            </div>
          </Card>
        </div>
      </form.AppForm>
      <p
        id="messaging-status"
        className={cn("mt-3 shrink-0 text-xs text-muted")}
        role="status"
        aria-live="polite"
      >
        {integrations.messagingStatus}
      </p>
    </section>
  );
}
