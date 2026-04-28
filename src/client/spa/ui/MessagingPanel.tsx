import { Accordion } from "@base-ui/react";
import { useMessagingModelProviders } from "../../hooks/useMessagingModelProviders";
import { cn } from "../../lib/cn";
import {
  ActionButton,
  type ActionConfig,
  FormInput,
  FormSelect,
  type SelectFieldConfig,
  type TextFieldConfig,
} from "./integrations/IntegrationFormControls";

type MessagingAction = "saveDiscord" | "clearDiscord" | "saveSlack" | "clearSlack";

const discordBaseFields: readonly TextFieldConfig[] = [
  {
    id: "messaging-discord-token",
    label: "Discord bot token",
    type: "password",
    autoComplete: "new-password",
    placeholder: "Leave unchanged if already set",
  },
  {
    id: "messaging-discord-allowed",
    label: "Discord allowed users",
    type: "text",
    autoComplete: "off",
    placeholder: "Leave empty to keep current value",
  },
] as const;

const discordAdvancedTextFields: readonly TextFieldConfig[] = [
  { id: "d-adv-roles", label: "Discord allowed roles", dataDiscordKey: "DISCORD_ALLOWED_ROLES" },
  {
    id: "d-adv-allow-ch",
    label: "Discord allowed channels",
    dataDiscordKey: "DISCORD_ALLOWED_CHANNELS",
  },
  {
    id: "d-adv-free",
    label: "Discord free response channels",
    className: "sm:col-span-2",
    dataDiscordKey: "DISCORD_FREE_RESPONSE_CHANNELS",
  },
  { id: "d-adv-home", label: "Discord home channel", dataDiscordKey: "DISCORD_HOME_CHANNEL" },
  {
    id: "d-adv-homen",
    label: "Discord home channel name",
    dataDiscordKey: "DISCORD_HOME_CHANNEL_NAME",
  },
  {
    id: "d-adv-proxy",
    label: "Discord proxy",
    className: "sm:col-span-2",
    dataDiscordKey: "DISCORD_PROXY",
  },
  {
    id: "d-adv-ign",
    label: "Discord ignored channels",
    className: "sm:col-span-2",
    dataDiscordKey: "DISCORD_IGNORED_CHANNELS",
  },
  {
    id: "d-adv-nothr",
    label: "Discord no thread channels",
    className: "sm:col-span-2",
    dataDiscordKey: "DISCORD_NO_THREAD_CHANNELS",
  },
] as const;

const discordAdvancedSelectFields: readonly SelectFieldConfig[] = [
  {
    id: "d-adv-cmd",
    label: "Discord command sync policy",
    dataDiscordKey: "DISCORD_COMMAND_SYNC_POLICY",
    options: ["safe", "bulk", "off"],
  },
  {
    id: "d-adv-reply",
    label: "Discord reply mode",
    dataDiscordKey: "DISCORD_REPLY_TO_MODE",
    options: ["off", "first", "all"],
  },
  {
    id: "d-adv-reqm",
    label: "Discord require mention",
    dataDiscordKey: "DISCORD_REQUIRE_MENTION",
    options: ["true", "false"],
  },
  {
    id: "d-adv-autoth",
    label: "Discord auto thread",
    dataDiscordKey: "DISCORD_AUTO_THREAD",
    options: ["true", "false"],
  },
  {
    id: "d-adv-rxn",
    label: "Discord reactions",
    dataDiscordKey: "DISCORD_REACTIONS",
    options: ["true", "false"],
  },
  {
    id: "d-adv-alle",
    label: "Allow @everyone",
    dataDiscordKey: "DISCORD_ALLOW_MENTION_EVERYONE",
    options: ["true", "false"],
  },
  {
    id: "d-adv-alr",
    label: "Allow role mentions",
    dataDiscordKey: "DISCORD_ALLOW_MENTION_ROLES",
    options: ["true", "false"],
  },
  {
    id: "d-adv-alu",
    label: "Allow user mentions",
    dataDiscordKey: "DISCORD_ALLOW_MENTION_USERS",
    options: ["true", "false"],
  },
  {
    id: "d-adv-alk",
    label: "Allow replied user mention",
    dataDiscordKey: "DISCORD_ALLOW_MENTION_REPLIED_USER",
    options: ["true", "false"],
  },
  {
    id: "d-adv-ignm",
    label: "Ignore no mention",
    dataDiscordKey: "DISCORD_IGNORE_NO_MENTION",
    options: ["true", "false"],
  },
] as const;

const slackFields: readonly TextFieldConfig[] = [
  {
    id: "messaging-slack-bot",
    label: "Slack bot token",
    type: "password",
    autoComplete: "new-password",
    placeholder: "Leave unchanged if already set",
  },
  {
    id: "messaging-slack-app",
    label: "Slack app token",
    type: "password",
    autoComplete: "new-password",
    placeholder: "Leave unchanged if already set",
  },
] as const;

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
  const field = (id: string): string => String(integrations.fieldValues[id] ?? "");

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
      <div className="mt-3 flex w-full min-w-0 flex-col gap-8">
        <div className="flex w-full min-w-0 flex-col rounded-lg border border-frosted bg-background p-5">
          <h3 className="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">
            Discord
          </h3>
          <div className="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            {discordBaseFields.map((config) => (
              <FormInput
                key={config.id}
                config={config}
                value={field(config.id)}
                onChange={integrations.setFieldValue}
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
                    <FormInput
                      key={config.id}
                      config={config}
                      value={field(config.id)}
                      onChange={integrations.setFieldValue}
                      compact
                    />
                  ))}
                  {discordAdvancedSelectFields.map((config) => (
                    <FormSelect
                      key={config.id}
                      config={config}
                      value={field(config.id)}
                      onChange={integrations.setFieldValue}
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
        </div>

        <div className="flex w-full min-w-0 flex-col rounded-lg border border-frosted bg-background p-5">
          <h3 className="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">
            Slack (Socket Mode)
          </h3>
          <div className="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            {slackFields.map((config) => (
              <FormInput
                key={config.id}
                config={config}
                value={field(config.id)}
                onChange={integrations.setFieldValue}
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
        </div>
      </div>
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
