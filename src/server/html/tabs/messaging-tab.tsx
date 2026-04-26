/** @jsxImportSource hono/jsx */

export function MessagingTabPanel() {
  return (
    <section
      data-tab-panel="messaging"
      hidden
      class="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-2"
    >
      <div class="mb-6 shrink-0">
        <p class="text-sm font-semibold uppercase tracking-wide text-text sm:text-base">
          Messaging Platform
        </p>
        <p class="mt-3 text-sm text-muted">
          Hermes reads tokens from <span class="text-text">data/.env</span>.
          Existing secrets cannot be shown here; leave a field empty to keep its
          current value. Saving applies changes and restarts the gateway (same
          as Env vars).
        </p>
        <p
          id="messaging-env-hint"
          class="mt-2 text-xs text-muted"
          aria-live="polite"
        >
          Loading…
        </p>
      </div>
      <div class="flex w-full min-w-0 flex-col gap-8">
        <div class="flex w-full min-w-0 flex-col rounded-lg border border-frosted bg-background p-5">
          <h3 class="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">
            Discord
          </h3>
          <div class="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            <div class="min-w-0">
              <label
                class="mb-1 block text-sm font-medium text-text"
                for="messaging-discord-token"
              >
                Bot token (DISCORD_BOT_TOKEN)
              </label>
              <input
                id="messaging-discord-token"
                type="password"
                autoComplete="new-password"
                placeholder="Leave unchanged if already set"
                class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none"
              />
              <p class="mt-1 text-xs text-muted leading-relaxed">
                From the Discord Developer Portal. Leave empty to keep the current
                token on disk.
              </p>
            </div>
            <div class="min-w-0">
              <label
                class="mb-1 block text-sm font-medium text-text"
                for="messaging-discord-allowed"
              >
                Allowed user IDs, comma-separated (optional,
                config.yaml → discord.allowed_users)
              </label>
              <input
                id="messaging-discord-allowed"
                type="text"
                autoComplete="off"
                placeholder="Leave empty to keep current value"
                class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none"
              />
              <p class="mt-1 text-xs text-muted leading-relaxed">
                Stored in <span class="text-text">data/config.yaml</span> under{" "}
                <span class="text-text">discord.allowed_users</span>. If set, only
                these Discord user IDs may use the bot. Leave empty to allow all
                users in allowed channels.
              </p>
            </div>
          </div>
          <details
            id="messaging-discord-advanced"
            class="mt-6 rounded-lg border border-frosted bg-surface/40 p-4 open:border-accent-border/40"
          >
            <summary class="cursor-pointer list-none text-sm font-normal normal-case text-text">
              Advanced options
            </summary>
            <p class="mt-2 text-xs text-muted">
              Optional Discord settings from the{" "}
              <a
                class="text-accent underline"
                href="https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord"
                rel="noopener noreferrer"
                target="_blank"
              >
                Discord guide
              </a>{" "}
              and{" "}
              <a
                class="text-accent underline"
                href="https://hermes-agent.nousresearch.com/docs/reference/environment-variables"
                rel="noopener noreferrer"
                target="_blank"
              >
                environment variable reference
              </a>
              . Empty fields are left unchanged; booleans use Unchanged / true /
              false.
            </p>
            <div class="mt-4 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
              <div>
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-roles"
                >
                  Allow Role IDs
                </label>
                <input
                  id="d-adv-roles"
                  data-discord-key="DISCORD_ALLOWED_ROLES"
                  type="text"
                  autoComplete="off"
                  placeholder="Comma-separated role IDs"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                />
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  Comma-separated role IDs. If set, members need one of these roles
                  (in addition to channel rules).
                </p>
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-allow-ch"
                >
                  Allow Channel IDs
                </label>
                <input
                  id="d-adv-allow-ch"
                  data-discord-key="DISCORD_ALLOWED_CHANNELS"
                  type="text"
                  autoComplete="off"
                  placeholder="Comma-separated channel IDs"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                />
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  Comma-separated channel IDs where the bot is allowed to read and
                  reply. Leave empty to use Hermes defaults.
                </p>
              </div>
              <div class="sm:col-span-2">
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-free"
                >
                  Free Response Channels
                </label>
                <input
                  id="d-adv-free"
                  data-discord-key="DISCORD_FREE_RESPONSE_CHANNELS"
                  type="text"
                  autoComplete="off"
                  placeholder="Channels where @mention is not required"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                />
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  Channels where the bot may respond without an @mention (comma-separated
                  IDs).
                </p>
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-home"
                >
                  Home Channel
                </label>
                <input
                  id="d-adv-home"
                  data-discord-key="DISCORD_HOME_CHANNEL"
                  type="text"
                  autoComplete="off"
                  placeholder="Channel ID for cron / notifications"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                />
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  Channel ID used for cron jobs, notifications, and similar “home”
                  traffic.
                </p>
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-homen"
                >
                  Home Channel Name
                </label>
                <input
                  id="d-adv-homen"
                  data-discord-key="DISCORD_HOME_CHANNEL_NAME"
                  type="text"
                  autoComplete="off"
                  placeholder="Display name, e.g. #bot-updates"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                />
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  Display name for the home channel (e.g. #alerts) for logs and UI.
                </p>
              </div>
              <div class="sm:col-span-2">
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-proxy"
                >
                  Proxy URL
                </label>
                <input
                  id="d-adv-proxy"
                  data-discord-key="DISCORD_PROXY"
                  type="text"
                  autoComplete="off"
                  placeholder="http(s):// or socks5:// URL"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                />
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  Optional outbound proxy for Discord (http://, https://, or socks5://).
                </p>
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-cmd"
                >
                  Command Sync Policy
                </label>
<select
                  id="d-adv-cmd"
                  data-discord-key="DISCORD_COMMAND_SYNC_POLICY"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                >
                  <option value="">Unchanged</option>
                  <option value="safe">safe</option>
                  <option value="bulk">bulk</option>
                  <option value="off">off</option>
                </select>
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  How slash commands are synced with Discord: safe (incremental),
                  bulk (full replace), or off.
                </p>
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-reply"
                >
                  Reply-To Mode
                </label>
<select
                  id="d-adv-reply"
                  data-discord-key="DISCORD_REPLY_TO_MODE"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                >
                  <option value="">Unchanged</option>
                  <option value="off">off</option>
                  <option value="first">first</option>
                  <option value="all">all</option>
                </select>
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  Controls reply threading: off, link only the first assistant message,
                  or link all replies in the chain.
                </p>
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-reqm"
                >
                  Require Mention
                </label>
<select
                  id="d-adv-reqm"
                  data-discord-key="DISCORD_REQUIRE_MENTION"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                >
                  <option value="">Unchanged</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  When true, the bot only responds if @mentioned (except in free-response
                  channels).
                </p>
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-autoth"
                >
                  Auto Thread
                </label>
<select
                  id="d-adv-autoth"
                  data-discord-key="DISCORD_AUTO_THREAD"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                >
                  <option value="">Unchanged</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  When true, assistant replies start a new thread instead of posting
                  inline.
                </p>
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-rxn"
                >
                  Reactions
                </label>
<select
                  id="d-adv-rxn"
                  data-discord-key="DISCORD_REACTIONS"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                >
                  <option value="">Unchanged</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  Whether the bot may add emoji reactions to messages.
                </p>
              </div>
              <div class="sm:col-span-2">
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-ign"
                >
                  Ignored Channels
                </label>
                <input
                  id="d-adv-ign"
                  data-discord-key="DISCORD_IGNORED_CHANNELS"
                  type="text"
                  autoComplete="off"
                  placeholder="Bot never responds, even if @mentioned"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                />
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  Channel IDs the bot never reads or responds in, even if @mentioned
                  (comma-separated).
                </p>
              </div>
              <div class="sm:col-span-2">
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-nothr"
                >
                  No-Thread Channels
                </label>
                <input
                  id="d-adv-nothr"
                  data-discord-key="DISCORD_NO_THREAD_CHANNELS"
                  type="text"
                  autoComplete="off"
                  placeholder="Reply inline (no new thread) when auto_thread is on"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                />
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  When auto-thread is on, these channels still get inline replies
                  (comma-separated IDs).
                </p>
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-alle"
                >
                  Allow Mention Everyone
                </label>
<select
                  id="d-adv-alle"
                  data-discord-key="DISCORD_ALLOW_MENTION_EVERYONE"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                >
                  <option value="">Unchanged</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  Whether bot messages may include an @everyone mention.
                </p>
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-alr"
                >
                  Allow Mention Roles
                </label>
<select
                  id="d-adv-alr"
                  data-discord-key="DISCORD_ALLOW_MENTION_ROLES"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                >
                  <option value="">Unchanged</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  Whether bot messages may @mention roles.
                </p>
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-alu"
                >
                  Allow Mention Users
                </label>
<select
                  id="d-adv-alu"
                  data-discord-key="DISCORD_ALLOW_MENTION_USERS"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                >
                  <option value="">Unchanged</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  Whether bot messages may @mention users.
                </p>
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-alk"
                >
                  Allow Mention Replied User
                </label>
<select
                  id="d-adv-alk"
                  data-discord-key="DISCORD_ALLOW_MENTION_REPLIED_USER"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                >
                  <option value="">Unchanged</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  Whether replies may ping the author of the message being replied to.
                </p>
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium normal-case text-text"
                  for="d-adv-ignm"
                >
                  Ignore Without Mention
                </label>
<select
                  id="d-adv-ignm"
                  data-discord-key="DISCORD_IGNORE_NO_MENTION"
                  class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-1.5 text-xs text-text outline-none"
                >
                  <option value="">Unchanged</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
                <p class="mt-1 text-xs text-muted leading-relaxed">
                  When true, messages without an @mention are ignored outside free-response
                  channels.
                </p>
              </div>
            </div>
          </details>
          <div class="mt-6 flex flex-wrap gap-2">
            <button
              id="messaging-save-discord"
              type="button"
              class="rounded-full bg-text px-3 py-2 text-xs text-background disabled:opacity-50"
            >
              Save Discord
            </button>
            <button
              id="messaging-clear-discord"
              type="button"
              class="rounded-full bg-frosted px-3 py-2 text-xs text-text disabled:opacity-50"
            >
              Clear Discord keys
            </button>
          </div>
        </div>
        <div class="flex w-full min-w-0 flex-col rounded-lg border border-frosted bg-background p-5">
          <h3 class="text-lg font-bold leading-snug tracking-tight text-text sm:text-xl">
            Slack (Socket Mode)
          </h3>
          <div class="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            <div class="min-w-0">
              <label
                class="mb-1 block text-sm font-medium text-text"
                for="messaging-slack-bot"
              >
                Bot token (SLACK_BOT_TOKEN, xoxb-…)
              </label>
              <input
                id="messaging-slack-bot"
                type="password"
                autoComplete="new-password"
                placeholder="Leave unchanged if already set"
                class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none"
              />
              <p class="mt-1 text-xs text-muted leading-relaxed">
                OAuth bot token from your Slack app (starts with xoxb-). Used for Web
                API calls. Leave empty to keep the current value.
              </p>
            </div>
            <div class="min-w-0">
              <label
                class="mb-1 block text-sm font-medium text-text"
                for="messaging-slack-app"
              >
                App-level token (SLACK_APP_TOKEN, xapp-…)
              </label>
              <input
                id="messaging-slack-app"
                type="password"
                autoComplete="new-password"
                placeholder="Leave unchanged if already set"
                class="mt-1 w-full rounded-md border border-frosted bg-surface px-2 py-2 text-xs text-text outline-none"
              />
              <p class="mt-1 text-xs text-muted leading-relaxed">
                App-level token with connections:write for Socket Mode (starts with
                xapp-). Leave empty to keep the current value.
              </p>
            </div>
          </div>
          <div class="mt-6 flex flex-wrap gap-2">
            <button
              id="messaging-save-slack"
              type="button"
              class="rounded-full bg-text px-3 py-2 text-xs text-background disabled:opacity-50"
            >
              Save Slack
            </button>
            <button
              id="messaging-clear-slack"
              type="button"
              class="rounded-full bg-frosted px-3 py-2 text-xs text-text disabled:opacity-50"
            >
              Clear Slack keys
            </button>
          </div>
        </div>
      </div>
      <p
        id="messaging-status"
        class="mt-3 shrink-0 text-xs text-muted"
        role="status"
        aria-live="polite"
      >
        Ready.
      </p>
    </section>
  );
}
