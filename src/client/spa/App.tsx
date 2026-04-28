import type { GatewayStatus } from "../../server/types";
import { useConfigTab } from "../hooks/useConfigTab";
import { useEnvTab } from "../hooks/useEnvTab";
import { useGatewayStatus } from "../hooks/useGatewayStatus";
import { useLogs } from "../hooks/useLogs";
import { useMessagingModelProviders } from "../hooks/useMessagingModelProviders";
import { useProfileFilesTab } from "../hooks/useProfileFilesTab";
import { useProfilesTab } from "../hooks/useProfilesTab";
import { useSessionsTab } from "../hooks/useSessionsTab";
import { useWorkspaceTabs } from "../hooks/useWorkspaceTabs";
import { ConfigTab } from "./ui/ConfigTab";
import { ControlTab } from "./ui/ControlTab";
import { EnvTab } from "./ui/EnvTab";
import { LogsTab } from "./ui/LogsTab";
import { ProfilesTab } from "./ui/ProfilesTab";
import { ShellTab } from "./ui/ShellTab";
import { SessionsTab } from "./ui/SessionsTab";
import { WorkspaceTabBar } from "./ui/WorkspaceTabBar";

type AppProps = {
  initialStatus: GatewayStatus;
};

export function App({ initialStatus }: AppProps) {
  const { activeTab, setActiveTab, triggerClass } = useWorkspaceTabs();
  const config = useConfigTab();
  const env = useEnvTab();
  const gateway = useGatewayStatus(initialStatus);
  const logs = useLogs();
  const integrations = useMessagingModelProviders();
  const profiles = useProfilesTab();
  const profileFiles = useProfileFilesTab(profiles.list.active);
  const sessions = useSessionsTab();

  const field = (id: string): string => String(integrations.fieldValues[id] ?? "");

  return (
    <main className="h-screen overflow-x-hidden overflow-y-hidden bg-background text-text">
      <section className="mx-auto flex h-full min-w-0 max-w-[1400px] flex-col gap-4 p-4">
        <section
          id="workspace"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-accent-border bg-surface p-3"
        >
          <WorkspaceTabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            triggerClass={triggerClass}
            profileValue={profiles.pickerValue}
            profiles={profiles.pickerOptions}
            onProfileChange={(value) => {
              void profiles.activate(value === "default" ? null : value);
            }}
          />

          <div hidden={activeTab !== "control"}>
            <ControlTab
              status={gateway.status}
              error={gateway.error}
              busy={gateway.busy}
              onStart={gateway.start}
              onStop={gateway.stop}
              onRestart={gateway.restart}
            />
          </div>

          <div hidden={activeTab !== "logs"}>
            <LogsTab lines={logs.lines} error={logs.error} />
          </div>

          <div hidden={activeTab !== "shell"}>
            <ShellTab />
          </div>

          <div hidden={activeTab !== "config"}>
            <ConfigTab
              path={config.path}
              updatedAt={config.updatedAt}
              content={config.content}
              issues={config.issues}
              status={config.status}
              canSave={config.canSave}
              onChange={config.onChange}
              onReload={config.reload}
              onSave={config.save}
            />
          </div>

          <div hidden={activeTab !== "env"}>
            <EnvTab
              path={env.path}
              updatedAt={env.updatedAt}
              entries={env.entries}
              keyValue={env.key}
              valueValue={env.value}
              status={env.status}
              canMutate={env.canMutate}
              onKeyChange={env.setKey}
              onValueChange={env.setValue}
              onSelectKey={env.setSelectedKey}
              onReload={env.reload}
              onSave={env.upsert}
              onRemove={env.remove}
            />
          </div>

          <section data-tab-panel="messaging" hidden={activeTab !== "messaging"} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-text sm:text-base">Messaging Platform</p>
            <p id="messaging-env-hint" className="mt-2 text-xs text-muted" aria-live="polite">{integrations.messagingHint}</p>
            <div className="mt-3 flex w-full min-w-0 flex-col gap-8">
              <div className="flex w-full min-w-0 flex-col rounded-lg border border-frosted bg-background p-5">
                <h3 className="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">Discord</h3>
                <div className="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                  <input id="messaging-discord-token" type="password" autoComplete="new-password" placeholder="Leave unchanged if already set" className="rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none" value={field("messaging-discord-token")} onChange={(event) => integrations.setFieldValue("messaging-discord-token", event.target.value)} />
                  <input id="messaging-discord-allowed" type="text" autoComplete="off" placeholder="Leave empty to keep current value" className="rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none" value={field("messaging-discord-allowed")} onChange={(event) => integrations.setFieldValue("messaging-discord-allowed", event.target.value)} />
                </div>
                <details id="messaging-discord-advanced" className="mt-6 rounded-lg border border-frosted bg-surface/40 p-4 open:border-accent-border/40">
                  <summary className="cursor-pointer list-none text-sm font-normal normal-case text-text">Advanced options</summary>
                  <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                    <input id="d-adv-roles" data-discord-key="DISCORD_ALLOWED_ROLES" className="rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-roles")} onChange={(event) => integrations.setFieldValue("d-adv-roles", event.target.value)} />
                    <input id="d-adv-allow-ch" data-discord-key="DISCORD_ALLOWED_CHANNELS" className="rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-allow-ch")} onChange={(event) => integrations.setFieldValue("d-adv-allow-ch", event.target.value)} />
                    <input id="d-adv-free" data-discord-key="DISCORD_FREE_RESPONSE_CHANNELS" className="sm:col-span-2 rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-free")} onChange={(event) => integrations.setFieldValue("d-adv-free", event.target.value)} />
                    <input id="d-adv-home" data-discord-key="DISCORD_HOME_CHANNEL" className="rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-home")} onChange={(event) => integrations.setFieldValue("d-adv-home", event.target.value)} />
                    <input id="d-adv-homen" data-discord-key="DISCORD_HOME_CHANNEL_NAME" className="rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-homen")} onChange={(event) => integrations.setFieldValue("d-adv-homen", event.target.value)} />
                    <input id="d-adv-proxy" data-discord-key="DISCORD_PROXY" className="sm:col-span-2 rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-proxy")} onChange={(event) => integrations.setFieldValue("d-adv-proxy", event.target.value)} />
                    <select id="d-adv-cmd" data-discord-key="DISCORD_COMMAND_SYNC_POLICY" className="rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-cmd")} onChange={(event) => integrations.setFieldValue("d-adv-cmd", event.target.value)}><option value="">Unchanged</option><option value="safe">safe</option><option value="bulk">bulk</option><option value="off">off</option></select>
                    <select id="d-adv-reply" data-discord-key="DISCORD_REPLY_TO_MODE" className="rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-reply")} onChange={(event) => integrations.setFieldValue("d-adv-reply", event.target.value)}><option value="">Unchanged</option><option value="off">off</option><option value="first">first</option><option value="all">all</option></select>
                    <select id="d-adv-reqm" data-discord-key="DISCORD_REQUIRE_MENTION" className="rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-reqm")} onChange={(event) => integrations.setFieldValue("d-adv-reqm", event.target.value)}><option value="">Unchanged</option><option value="true">true</option><option value="false">false</option></select>
                    <select id="d-adv-autoth" data-discord-key="DISCORD_AUTO_THREAD" className="rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-autoth")} onChange={(event) => integrations.setFieldValue("d-adv-autoth", event.target.value)}><option value="">Unchanged</option><option value="true">true</option><option value="false">false</option></select>
                    <select id="d-adv-rxn" data-discord-key="DISCORD_REACTIONS" className="rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-rxn")} onChange={(event) => integrations.setFieldValue("d-adv-rxn", event.target.value)}><option value="">Unchanged</option><option value="true">true</option><option value="false">false</option></select>
                    <input id="d-adv-ign" data-discord-key="DISCORD_IGNORED_CHANNELS" className="sm:col-span-2 rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-ign")} onChange={(event) => integrations.setFieldValue("d-adv-ign", event.target.value)} />
                    <input id="d-adv-nothr" data-discord-key="DISCORD_NO_THREAD_CHANNELS" className="sm:col-span-2 rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-nothr")} onChange={(event) => integrations.setFieldValue("d-adv-nothr", event.target.value)} />
                    <select id="d-adv-alle" data-discord-key="DISCORD_ALLOW_MENTION_EVERYONE" className="rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-alle")} onChange={(event) => integrations.setFieldValue("d-adv-alle", event.target.value)}><option value="">Unchanged</option><option value="true">true</option><option value="false">false</option></select>
                    <select id="d-adv-alr" data-discord-key="DISCORD_ALLOW_MENTION_ROLES" className="rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-alr")} onChange={(event) => integrations.setFieldValue("d-adv-alr", event.target.value)}><option value="">Unchanged</option><option value="true">true</option><option value="false">false</option></select>
                    <select id="d-adv-alu" data-discord-key="DISCORD_ALLOW_MENTION_USERS" className="rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-alu")} onChange={(event) => integrations.setFieldValue("d-adv-alu", event.target.value)}><option value="">Unchanged</option><option value="true">true</option><option value="false">false</option></select>
                    <select id="d-adv-alk" data-discord-key="DISCORD_ALLOW_MENTION_REPLIED_USER" className="rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-alk")} onChange={(event) => integrations.setFieldValue("d-adv-alk", event.target.value)}><option value="">Unchanged</option><option value="true">true</option><option value="false">false</option></select>
                    <select id="d-adv-ignm" data-discord-key="DISCORD_IGNORE_NO_MENTION" className="rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none" value={field("d-adv-ignm")} onChange={(event) => integrations.setFieldValue("d-adv-ignm", event.target.value)}><option value="">Unchanged</option><option value="true">true</option><option value="false">false</option></select>
                  </div>
                </details>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button id="messaging-save-discord" type="button" className="rounded-full bg-text px-3 py-2 text-xs text-background disabled:opacity-50" disabled={integrations.messagingBusy} onClick={() => void integrations.saveDiscord()}>Save Discord</button>
                  <button id="messaging-clear-discord" type="button" className="rounded-full bg-frosted px-3 py-2 text-xs text-text disabled:opacity-50" disabled={integrations.messagingBusy} onClick={() => void integrations.clearDiscord()}>Clear Discord keys</button>
                </div>
              </div>
              <div className="flex w-full min-w-0 flex-col rounded-lg border border-frosted bg-background p-5">
                <h3 className="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">Slack (Socket Mode)</h3>
                <div className="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                  <input id="messaging-slack-bot" type="password" autoComplete="new-password" placeholder="Leave unchanged if already set" className="rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none" value={field("messaging-slack-bot")} onChange={(event) => integrations.setFieldValue("messaging-slack-bot", event.target.value)} />
                  <input id="messaging-slack-app" type="password" autoComplete="new-password" placeholder="Leave unchanged if already set" className="rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none" value={field("messaging-slack-app")} onChange={(event) => integrations.setFieldValue("messaging-slack-app", event.target.value)} />
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button id="messaging-save-slack" type="button" className="rounded-full bg-text px-3 py-2 text-xs text-background disabled:opacity-50" disabled={integrations.messagingBusy} onClick={() => void integrations.saveSlack()}>Save Slack</button>
                  <button id="messaging-clear-slack" type="button" className="rounded-full bg-frosted px-3 py-2 text-xs text-text disabled:opacity-50" disabled={integrations.messagingBusy} onClick={() => void integrations.clearSlack()}>Clear Slack keys</button>
                </div>
              </div>
            </div>
            <p id="messaging-status" className="mt-3 shrink-0 text-xs text-muted" role="status" aria-live="polite">{integrations.messagingStatus}</p>
          </section>

          <section data-tab-panel="model-providers" hidden={activeTab !== "model-providers"} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-text sm:text-base">Model providers</p>
            <p id="model-providers-env-hint" className="mt-2 text-xs text-muted" aria-live="polite">{integrations.modelProvidersHint}</p>
            <div className="mt-3 flex w-full min-w-0 flex-col gap-3">
              <input id="mp-yaml-default" className="rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none" value={field("mp-yaml-default")} onChange={(event) => integrations.setFieldValue("mp-yaml-default", event.target.value)} />
              <input id="mp-yaml-provider" className="rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none" value={field("mp-yaml-provider")} onChange={(event) => integrations.setFieldValue("mp-yaml-provider", event.target.value)} />
              <input id="mp-yaml-base-url" className="rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none" value={field("mp-yaml-base-url")} onChange={(event) => integrations.setFieldValue("mp-yaml-base-url", event.target.value)} />
              <button id="mp-save-yaml" type="button" className="rounded-full bg-text px-3 py-2 text-xs text-background disabled:opacity-50" disabled={integrations.modelProvidersBusy} onClick={() => void integrations.saveYamlModel()}>Save default model</button>
              <input id="mp-or-key" type="password" className="rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none" value={field("mp-or-key")} onChange={(event) => integrations.setFieldValue("mp-or-key", event.target.value)} />
              <input id="mp-or-base" className="rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none" value={field("mp-or-base")} onChange={(event) => integrations.setFieldValue("mp-or-base", event.target.value)} />
              <button id="mp-save-or" type="button" className="rounded-full bg-text px-3 py-2 text-xs text-background disabled:opacity-50" disabled={integrations.modelProvidersBusy} onClick={() => void integrations.saveOpenRouter()}>Save OpenRouter</button>
              <button id="mp-clear-or" type="button" className="rounded-full bg-frosted px-3 py-2 text-xs text-text disabled:opacity-50" disabled={integrations.modelProvidersBusy} onClick={() => void integrations.clearOpenRouter()}>Clear OpenRouter keys</button>
              <input id="mp-anthropic-key" type="password" className="rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none" value={field("mp-anthropic-key")} onChange={(event) => integrations.setFieldValue("mp-anthropic-key", event.target.value)} />
              <button id="mp-save-anthropic" type="button" className="rounded-full bg-text px-3 py-2 text-xs text-background disabled:opacity-50" disabled={integrations.modelProvidersBusy} onClick={() => void integrations.saveAnthropic()}>Save Claude</button>
              <button id="mp-clear-anthropic" type="button" className="rounded-full bg-frosted px-3 py-2 text-xs text-text disabled:opacity-50" disabled={integrations.modelProvidersBusy} onClick={() => void integrations.clearAnthropic()}>Clear Claude keys</button>
              <input id="mp-openai-key" type="password" className="rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none" value={field("mp-openai-key")} onChange={(event) => integrations.setFieldValue("mp-openai-key", event.target.value)} />
              <input id="mp-openai-base" className="rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none" value={field("mp-openai-base")} onChange={(event) => integrations.setFieldValue("mp-openai-base", event.target.value)} />
              <button id="mp-save-openai" type="button" className="rounded-full bg-text px-3 py-2 text-xs text-background disabled:opacity-50" disabled={integrations.modelProvidersBusy} onClick={() => void integrations.saveOpenAi()}>Save OpenAI</button>
              <button id="mp-clear-openai" type="button" className="rounded-full bg-frosted px-3 py-2 text-xs text-text disabled:opacity-50" disabled={integrations.modelProvidersBusy} onClick={() => void integrations.clearOpenAi()}>Clear OpenAI keys</button>
              <input id="mp-google-key" type="password" className="rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none" value={field("mp-google-key")} onChange={(event) => integrations.setFieldValue("mp-google-key", event.target.value)} />
              <input id="mp-gemini-base" className="rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none" value={field("mp-gemini-base")} onChange={(event) => integrations.setFieldValue("mp-gemini-base", event.target.value)} />
              <button id="mp-save-gemini" type="button" className="rounded-full bg-text px-3 py-2 text-xs text-background disabled:opacity-50" disabled={integrations.modelProvidersBusy} onClick={() => void integrations.saveGemini()}>Save Gemini</button>
              <button id="mp-clear-gemini" type="button" className="rounded-full bg-frosted px-3 py-2 text-xs text-text disabled:opacity-50" disabled={integrations.modelProvidersBusy} onClick={() => void integrations.clearGemini()}>Clear Gemini keys</button>
            </div>
            <p id="model-providers-status" className="mt-3 shrink-0 text-xs text-muted" role="status" aria-live="polite">{integrations.modelProvidersStatus}</p>
          </section>

          <div hidden={activeTab !== "profiles"}>
            <ProfilesTab
              list={profiles.list}
              status={profiles.status}
              files={profileFiles.files}
              onReload={profiles.refresh}
              onCreate={profiles.create}
              onActivate={profiles.activate}
              onRename={profiles.rename}
              onDelete={profiles.remove}
              onFileChange={profileFiles.setContent}
              onFileReload={profileFiles.reload}
              onFileSave={profileFiles.save}
            />
          </div>

          <div hidden={activeTab !== "sessions"}>
            <SessionsTab
              profile={sessions.profile}
              sessions={sessions.sessions}
              selectedSessionId={sessions.selectedSessionId}
              selectedLabel={sessions.selectedLabel}
              transcript={sessions.transcript}
              status={sessions.status}
              onReload={sessions.refresh}
              onCreate={sessions.createSession}
              onOpen={sessions.openSession}
              onRename={sessions.renameSession}
              onArchive={sessions.archiveSession}
              onRestore={sessions.restoreSession}
              onDelete={sessions.deleteSession}
            />
          </div>
        </section>
      </section>
    </main>
  );
}
