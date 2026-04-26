import { QueryClient } from "@tanstack/query-core";
import { hc } from "hono/client";
import { io } from "socket.io-client";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import type { AppType } from "../server/app";
import type {
  ConfigReadResult,
  ConfigSaveResponse,
  ConfigValidationIssue,
  EnvMutationResponse,
  EnvReadResult,
  GatewayStatus,
  LogTail,
} from "../server/types";

type GatewayAction = "start" | "stop" | "restart";
type TabKey = "control" | "logs" | "shell" | "config" | "env" | "messaging";

const queryClient = new QueryClient();
const gatewayQueryKey = ["gateway-status"] as const;
const logsQueryKey = ["log-tail"] as const;
let configEditor: import("monaco-editor").editor.IStandaloneCodeEditor | null = null;
let savedConfigContent: string | null = null;
let configLoaded = false;
let isSaving = false;
let shellTerminal: Terminal | null = null;
let envLoaded = false;
let envBusy = false;
let messagingBusy = false;
const rpcClient = hc<AppType>(window.location.origin);

/** All Discord env keys the UI can set — used for Clear + hint logic */
const MESSAGING_DISCORD_ALL_KEYS: readonly string[] = [
  "DISCORD_BOT_TOKEN",
  "DISCORD_ALLOWED_USERS",
  "DISCORD_ALLOWED_ROLES",
  "DISCORD_ALLOWED_CHANNELS",
  "DISCORD_FREE_RESPONSE_CHANNELS",
  "DISCORD_HOME_CHANNEL",
  "DISCORD_HOME_CHANNEL_NAME",
  "DISCORD_PROXY",
  "DISCORD_COMMAND_SYNC_POLICY",
  "DISCORD_REQUIRE_MENTION",
  "DISCORD_AUTO_THREAD",
  "DISCORD_REACTIONS",
  "DISCORD_IGNORED_CHANNELS",
  "DISCORD_NO_THREAD_CHANNELS",
  "DISCORD_REPLY_TO_MODE",
  "DISCORD_ALLOW_MENTION_EVERYONE",
  "DISCORD_ALLOW_MENTION_ROLES",
  "DISCORD_ALLOW_MENTION_USERS",
  "DISCORD_ALLOW_MENTION_REPLIED_USER",
  "DISCORD_IGNORE_NO_MENTION",
];
const MESSAGING_SLACK_KEYS = ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"] as const;

function main(): void {
  const initialStatus = parseInitialStatus();
  queryClient.setQueryData(gatewayQueryKey, initialStatus);
  renderGatewayStatus(initialStatus, null);
  wireTabs();
  wireGatewayActions();
  void refreshGatewayStatus();
  void setupLogs();
  void setupConfigEditor();
  void setupTerminal();
  void setupEnvEditor();
  void setupMessagingPlatform();
}

function parseInitialStatus(): GatewayStatus {
  const script = document.querySelector<HTMLScriptElement>('script[data-initial-status]');
  const raw = script?.dataset.initialStatus;
  if (!raw) {
    return {
      state: "stopped",
      health: "unknown",
      pid: null,
      cwd: "-",
      startedAt: null,
      uptimeMs: null,
      exitCode: null,
      lastError: null,
      logWarning: null,
    };
  }

  return JSON.parse(decodeURIComponent(raw)) as GatewayStatus;
}

function wireTabs(): void {
  const triggers = document.querySelectorAll<HTMLButtonElement>("[data-tab-trigger]");
  const panels = document.querySelectorAll<HTMLElement>("[data-tab-panel]");

  const setActiveTab = (tab: TabKey): void => {
    for (const trigger of Array.from(triggers)) {
      const active = trigger.dataset.tabTrigger === tab;
      trigger.classList.toggle("bg-frosted", active);
      trigger.classList.toggle("text-text", active);
      trigger.classList.toggle("text-muted", !active);
    }
    for (const panel of Array.from(panels)) {
      const panelKey = panel.dataset.tabPanel;
      if (!panelKey) {
        continue;
      }
      // Use the `hidden` property so panels keep `display:flex` layout classes at all times.
      panel.hidden = panelKey !== tab;
    }
    if (tab === "shell") {
      shellTerminal?.focus();
    }
    if (tab === "config") {
      configEditor?.layout();
    }
    if (tab === "env") {
      const keyInput = document.getElementById("env-key-input");
      if (keyInput instanceof HTMLInputElement) {
        keyInput.focus();
      }
    }
    if (tab === "messaging") {
      const tokenInput = document.getElementById("messaging-discord-token");
      if (tokenInput instanceof HTMLInputElement) {
        tokenInput.focus();
      }
      void refreshMessagingEnvHint();
    }
  };

  for (const trigger of Array.from(triggers)) {
    trigger.addEventListener("click", () => {
      const key = trigger.dataset.tabTrigger;
      if (
        key === "control" ||
        key === "logs" ||
        key === "shell" ||
        key === "config" ||
        key === "env" ||
        key === "messaging"
      ) {
        setActiveTab(key);
      }
    });
  }
}

function setBusyButtons(disabled: boolean): void {
  for (const id of ["start-button", "stop-button", "restart-button"]) {
    const button = document.getElementById(id);
    if (button instanceof HTMLButtonElement) {
      button.disabled = disabled;
    }
  }
}

function wireGatewayActions(): void {
  document.body.addEventListener("htmx:afterRequest", (event) => {
    const detail = (event as CustomEvent<{ elt?: Element; xhr?: XMLHttpRequest }>).detail;
    const elt = detail?.elt;
    if (!(elt instanceof HTMLElement)) {
      return;
    }
    const action = mapButtonToAction(elt.id);
    if (!action) {
      return;
    }
    setBusyButtons(false);
    if (!detail?.xhr) {
      return;
    }
    if (detail.xhr.status >= 400) {
      renderGatewayError(`Gateway ${action} failed (${detail.xhr.status}).`);
      return;
    }

    try {
      const status = JSON.parse(detail.xhr.responseText) as GatewayStatus;
      queryClient.setQueryData(gatewayQueryKey, status);
      renderGatewayStatus(status, null);
    } catch {
      renderGatewayError("Gateway action returned invalid JSON.");
    }
  });

  for (const id of ["start-button", "stop-button", "restart-button"]) {
    const button = document.getElementById(id);
    if (button instanceof HTMLButtonElement) {
      button.addEventListener("click", () => {
        setBusyButtons(true);
      });
    }
  }

  window.setInterval(() => {
    void refreshGatewayStatus();
  }, 3000);
}

function mapButtonToAction(id: string): GatewayAction | null {
  if (id === "start-button") {
    return "start";
  }
  if (id === "stop-button") {
    return "stop";
  }
  if (id === "restart-button") {
    return "restart";
  }
  return null;
}

async function refreshGatewayStatus(): Promise<void> {
  try {
    const status = await queryClient.fetchQuery({
      queryKey: gatewayQueryKey,
      queryFn: getGatewayStatus,
      staleTime: 0,
    });
    renderGatewayStatus(status, null);
  } catch (cause: unknown) {
    renderGatewayError(getErrorMessage(cause));
  }
}

function renderGatewayError(message: string): void {
  const error = document.getElementById("gateway-error");
  if (!(error instanceof HTMLParagraphElement)) {
    return;
  }
  error.textContent = message;
  error.classList.remove("hidden");
}

function renderGatewayStatus(status: GatewayStatus, error: string | null): void {
  const host = document.getElementById("gateway-status");
  if (host) {
    host.innerHTML = [
      `State: <span class="text-text">${status.state}</span>`,
      `Health: <span class="text-text">${status.health}</span>`,
      `PID: <span class="text-text">${status.pid ?? "-"}</span>`,
      `CWD: <span class="text-text">${status.cwd}</span>`,
      `Last error: <span class="text-text">${status.lastError ?? "-"}</span>`,
    ]
      .map((line) => `<div>${line}</div>`)
      .join("");
  }
  const errorNode = document.getElementById("gateway-error");
  if (errorNode instanceof HTMLParagraphElement) {
    errorNode.textContent = error ?? "";
    errorNode.classList.toggle("hidden", error === null);
  }
}

async function setupLogs(): Promise<void> {
  await refreshLogs();
  const source = new EventSource("/logs/stream");
  source.addEventListener("message", () => {
    void refreshLogs();
  });
  source.addEventListener("error", () => {
    setLogError("Log stream disconnected.");
  });
}

async function refreshLogs(): Promise<void> {
  try {
    const logs = await queryClient.fetchQuery({
      queryKey: logsQueryKey,
      queryFn: getLogTail,
      staleTime: 0,
    });
    const host = document.getElementById("log-lines");
    if (host) {
      host.textContent = logs.lines.join("\n");
    }
    setLogError(logs.warning);
  } catch (cause: unknown) {
    setLogError(getErrorMessage(cause));
  }
}

function setLogError(message: string | null): void {
  const node = document.getElementById("log-error");
  if (!(node instanceof HTMLParagraphElement)) {
    return;
  }
  node.textContent = message ?? "";
  node.classList.toggle("hidden", !message);
}

async function setupConfigEditor(): Promise<void> {
  const container = document.getElementById("config-editor");
  if (!(container instanceof HTMLDivElement)) {
    return;
  }
  setConfigStatus("Loading editor...");
  try {
    const monaco = await loadMonaco();
    configEditor = monaco.editor.create(container, {
      value: "",
      language: "yaml",
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
    });
    configEditor.onDidChangeModelContent(() => {
      if (!configLoaded) {
        updateSaveState();
        return;
      }
      setConfigStatus(isConfigDirty() ? "Unsaved changes." : "No unsaved changes.");
      updateSaveState();
    });
    wireConfigButtons();
    await loadConfig();
  } catch (cause: unknown) {
    setConfigStatus(`Failed to initialize config editor: ${getErrorMessage(cause)}`);
  }
}

function wireConfigButtons(): void {
  const reload = document.getElementById("config-reload");
  const save = document.getElementById("config-save");
  if (reload instanceof HTMLButtonElement) {
    reload.addEventListener("click", () => {
      void reloadConfigWithConfirmation();
    });
  }
  if (save instanceof HTMLButtonElement) {
    save.addEventListener("click", () => {
      void saveConfig();
    });
  }
}

function isConfigDirty(): boolean {
  if (!configEditor || savedConfigContent === null) {
    return false;
  }
  return configEditor.getValue() !== savedConfigContent;
}

function updateSaveState(): void {
  const save = document.getElementById("config-save");
  if (save instanceof HTMLButtonElement) {
    save.disabled = !configLoaded || isSaving || !isConfigDirty();
  }
}

function setConfigStatus(message: string): void {
  const status = document.getElementById("config-status");
  if (status) {
    status.textContent = message;
  }
}

function renderConfigIssues(issues: ConfigValidationIssue[]): void {
  const host = document.getElementById("config-issues");
  if (!(host instanceof HTMLUListElement)) {
    return;
  }
  host.innerHTML = "";
  for (const issue of issues) {
    const row = document.createElement("li");
    row.textContent = issue.path ? `${issue.path}: ${issue.message}` : issue.message;
    host.append(row);
  }
}

function renderConfigMeta(config: ConfigReadResult): void {
  const path = document.getElementById("config-path");
  const updatedAt = document.getElementById("config-updated-at");
  if (path) {
    path.textContent = config.path;
  }
  if (updatedAt) {
    updatedAt.textContent = config.updatedAt ? `Updated ${config.updatedAt}` : "Not saved yet";
  }
}

async function loadConfig(): Promise<void> {
  if (!configEditor) {
    return;
  }
  configLoaded = false;
  setConfigStatus("Loading config...");
  updateSaveState();
  try {
    const config = await getConfigRead();
    savedConfigContent = config.content;
    configEditor.setValue(config.content);
    configLoaded = true;
    renderConfigMeta(config);
    renderConfigIssues(config.validation.issues);
    setConfigStatus("No unsaved changes.");
  } catch (cause: unknown) {
    setConfigStatus(`Failed to load config: ${getErrorMessage(cause)}`);
  } finally {
    updateSaveState();
  }
}

async function reloadConfigWithConfirmation(): Promise<void> {
  if (configLoaded && isConfigDirty() && !window.confirm("Discard unsaved config changes?")) {
    return;
  }
  await loadConfig();
}

async function saveConfig(): Promise<void> {
  if (!configEditor || !configLoaded || !isConfigDirty()) {
    updateSaveState();
    return;
  }
  isSaving = true;
  setConfigStatus("Saving config...");
  updateSaveState();
  try {
    const submittedContent = configEditor.getValue();
    const response = await postConfig(submittedContent);
    renderGatewayStatus(response.gateway, null);
    queryClient.setQueryData(gatewayQueryKey, response.gateway);
    renderConfigMeta(response.config);

    if (!response.config.saved) {
      renderConfigIssues(response.config.validation.issues);
      setConfigStatus("Config validation failed. File was not changed.");
      return;
    }

    savedConfigContent = response.config.content;
    renderConfigIssues(response.config.validation.issues);
    if (configEditor.getValue() !== response.config.content) {
      setConfigStatus("Unsaved changes.");
      return;
    }

    if (response.restart.attempted && response.restart.ok) {
      setConfigStatus("Config saved. Gateway restarted.");
    } else if (response.restart.attempted) {
      setConfigStatus(`Config saved. Gateway restart failed: ${response.restart.error ?? "Unknown error"}`);
    } else {
      setConfigStatus("Config saved. Gateway was stopped, so no restart was needed.");
    }
  } catch (cause: unknown) {
    setConfigStatus(`Failed to save config: ${getErrorMessage(cause)}`);
  } finally {
    isSaving = false;
    updateSaveState();
  }
}

async function setupTerminal(): Promise<void> {
  const host = document.getElementById("terminal");
  if (!(host instanceof HTMLDivElement)) {
    return;
  }
  const terminal = new Terminal({
    cursorBlink: true,
    fontFamily: '"Azeret Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 13,
    theme: {
      background: "#000000",
      foreground: "#ffffff",
      cursor: "#0099ff",
      selectionBackground: "#0099ff55",
    },
  });
  shellTerminal = terminal;
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(host);
  const socket = io({
    transports: ["websocket"],
    auth: { token: getBasicAuthTokenFromLocation() },
  });

  const resize = (): void => {
    if (host.offsetWidth < 2 || host.offsetHeight < 2) {
      return;
    }
    fit.fit();
    if (socket.connected) {
      socket.emit("terminal:resize", { cols: terminal.cols, rows: terminal.rows });
    }
  };

  const clear = document.getElementById("shell-clear");
  if (clear instanceof HTMLButtonElement) {
    clear.addEventListener("click", () => {
      terminal.clear();
    });
  }

  terminal.onData((input) => socket.emit("terminal:input", input));
  socket.on("connect", () => {
    socket.emit("terminal:start");
    resize();
  });
  socket.on("terminal:output", (data: string) => terminal.write(data));
  socket.on("terminal:exit", ({ exitCode }: { exitCode: number }) => {
    terminal.writeln(`\r\n[process exited ${exitCode}]\r\n`);
  });
  window.addEventListener("resize", resize);
  new ResizeObserver(() => resize()).observe(host);
  resize();
}

function setEnvStatus(message: string): void {
  const status = document.getElementById("env-status");
  if (status) {
    status.textContent = message;
  }
}

function renderEnvMeta(env: EnvReadResult): void {
  const path = document.getElementById("env-path");
  const updatedAt = document.getElementById("env-updated-at");
  if (path) {
    path.textContent = env.path;
  }
  if (updatedAt) {
    updatedAt.textContent = env.updatedAt ? `Updated ${env.updatedAt}` : "Not saved yet";
  }
}

function renderEnvList(entries: EnvReadResult["entries"]): void {
  const list = document.getElementById("env-list");
  if (!(list instanceof HTMLSelectElement)) {
    return;
  }
  const selectedKey = list.value;
  list.innerHTML = "";
  for (const entry of entries) {
    const option = document.createElement("option");
    option.value = entry.key;
    option.textContent = `${entry.key}=${entry.maskedValue}`;
    list.append(option);
  }
  if (selectedKey && entries.some((entry) => entry.key === selectedKey)) {
    list.value = selectedKey;
  }
}

function updateEnvButtons(): void {
  const save = document.getElementById("env-save");
  const remove = document.getElementById("env-remove");
  if (save instanceof HTMLButtonElement) {
    save.disabled = !envLoaded || envBusy;
  }
  if (remove instanceof HTMLButtonElement) {
    remove.disabled = !envLoaded || envBusy;
  }
}

function getEnvInput(): { key: string; value: string } | null {
  const keyInput = document.getElementById("env-key-input");
  const valueInput = document.getElementById("env-value-input");
  if (!(keyInput instanceof HTMLInputElement) || !(valueInput instanceof HTMLInputElement)) {
    return null;
  }
  const key = keyInput.value.trim().toUpperCase();
  const value = valueInput.value;
  return { key, value };
}

function setEnvBusy(busy: boolean): void {
  envBusy = busy;
  updateEnvButtons();
}

function wireEnvButtons(): void {
  const reload = document.getElementById("env-reload");
  const save = document.getElementById("env-save");
  const remove = document.getElementById("env-remove");
  const list = document.getElementById("env-list");
  const keyInput = document.getElementById("env-key-input");
  const valueInput = document.getElementById("env-value-input");

  if (reload instanceof HTMLButtonElement) {
    reload.addEventListener("click", () => {
      void loadEnvVars();
    });
  }
  if (save instanceof HTMLButtonElement) {
    save.addEventListener("click", () => {
      void upsertEnvVar();
    });
  }
  if (remove instanceof HTMLButtonElement) {
    remove.addEventListener("click", () => {
      void removeEnvVar();
    });
  }
  if (
    list instanceof HTMLSelectElement &&
    keyInput instanceof HTMLInputElement &&
    valueInput instanceof HTMLInputElement
  ) {
    list.addEventListener("change", () => {
      keyInput.value = list.value;
      valueInput.value = "";
    });
  }
}

async function setupEnvEditor(): Promise<void> {
  wireEnvButtons();
  await loadEnvVars();
}

async function loadEnvVars(): Promise<void> {
  envLoaded = false;
  setEnvStatus("Loading env vars...");
  updateEnvButtons();
  try {
    const env = await getEnvRead();
    renderEnvMeta(env);
    renderEnvList(env.entries);
    renderMessagingEnvHint(env);
    envLoaded = true;
    setEnvStatus("Select key to update. Values are masked.");
  } catch (cause: unknown) {
    setEnvStatus(`Failed to load env vars: ${getErrorMessage(cause)}`);
  } finally {
    updateEnvButtons();
  }
}

async function upsertEnvVar(): Promise<void> {
  if (!envLoaded || envBusy) {
    return;
  }
  const input = getEnvInput();
  if (!input) {
    return;
  }
  if (!input.key || !input.value) {
    setEnvStatus("Key and value required.");
    return;
  }
  if (!/^[A-Z_][A-Z0-9_]*$/.test(input.key)) {
    setEnvStatus("Invalid key. Use A-Z, 0-9, and underscore.");
    return;
  }
  setEnvBusy(true);
  setEnvStatus("Saving env var and restarting gateway...");
  try {
    const response = await postEnvUpsert(input.key, input.value);
    applyEnvMutationResponse(response);
    const valueInput = document.getElementById("env-value-input");
    if (valueInput instanceof HTMLInputElement) {
      valueInput.value = "";
    }
  } catch (cause: unknown) {
    setEnvStatus(`Failed to save env var: ${getErrorMessage(cause)}`);
  } finally {
    setEnvBusy(false);
  }
}

async function removeEnvVar(): Promise<void> {
  if (!envLoaded || envBusy) {
    return;
  }
  const input = getEnvInput();
  if (!input || !input.key) {
    setEnvStatus("Key required to remove.");
    return;
  }
  if (!window.confirm(`Remove ${input.key}?`)) {
    return;
  }
  setEnvBusy(true);
  setEnvStatus("Removing env var and restarting gateway...");
  try {
    const response = await deleteEnvKey(input.key);
    applyEnvMutationResponse(response);
    const valueInput = document.getElementById("env-value-input");
    if (valueInput instanceof HTMLInputElement) {
      valueInput.value = "";
    }
  } catch (cause: unknown) {
    setEnvStatus(`Failed to remove env var: ${getErrorMessage(cause)}`);
  } finally {
    setEnvBusy(false);
  }
}

function applyEnvMutationResponse(response: EnvMutationResponse): void {
  renderEnvMeta(response.env);
  renderEnvList(response.env.entries);
  renderGatewayStatus(response.gateway, null);
  queryClient.setQueryData(gatewayQueryKey, response.gateway);
  if (response.restart.ok) {
    setEnvStatus("Env updated. Gateway restarted.");
    return;
  }
  setEnvStatus(`Env updated. Gateway restart failed: ${response.restart.error ?? "Unknown error"}`);
}

function setMessagingStatus(message: string): void {
  const el = document.getElementById("messaging-status");
  if (el) {
    el.textContent = message;
  }
}

function renderMessagingEnvHint(env: EnvReadResult): void {
  const hint = document.getElementById("messaging-env-hint");
  if (!hint) {
    return;
  }
  const discordN = env.entries.filter((e) => e.key.startsWith("DISCORD_")).length;
  const slackN = env.entries.filter((e) => e.key.startsWith("SLACK_")).length;
  const parts: string[] = [];
  if (discordN > 0) {
    parts.push(`Discord: ${String(discordN)} DISCORD_* key(s) in .env`);
  } else {
    parts.push("Discord: no DISCORD_* in .env");
  }
  if (slackN > 0) {
    parts.push(`Slack: ${String(slackN)} SLACK_* key(s) in .env`);
  } else {
    parts.push("Slack: no SLACK_* in .env");
  }
  hint.textContent = parts.join(" · ");
}

async function refreshMessagingEnvHint(): Promise<void> {
  const hint = document.getElementById("messaging-env-hint");
  if (!hint) {
    return;
  }
  hint.textContent = "Loading…";
  try {
    const env = await getEnvRead();
    renderMessagingEnvHint(env);
  } catch (cause: unknown) {
    hint.textContent = `Could not load .env: ${getErrorMessage(cause)}`;
  }
}

function updateMessagingButtons(): void {
  for (const id of [
    "messaging-save-discord",
    "messaging-save-slack",
    "messaging-clear-discord",
    "messaging-clear-slack",
  ]) {
    const button = document.getElementById(id);
    if (button instanceof HTMLButtonElement) {
      button.disabled = messagingBusy;
    }
  }
}

function setMessagingBusy(busy: boolean): void {
  messagingBusy = busy;
  updateMessagingButtons();
}

function applyMessagingMutationResponse(
  response: EnvMutationResponse,
  doneMessage: string,
): void {
  renderEnvMeta(response.env);
  renderEnvList(response.env.entries);
  renderGatewayStatus(response.gateway, null);
  queryClient.setQueryData(gatewayQueryKey, response.gateway);
  renderMessagingEnvHint(response.env);
  if (response.restart.ok) {
    setMessagingStatus(`${doneMessage} Gateway restarted.`);
    return;
  }
  setMessagingStatus(
    `${doneMessage} Gateway restart failed: ${response.restart.error ?? "Unknown error"}`,
  );
}

function readDiscordFieldsFromAdvanced(set: Record<string, string>): void {
  const root = document.getElementById("messaging-discord-advanced");
  if (root === null) {
    return;
  }
  for (const el of Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-discord-key]"),
  )) {
    const key = el.getAttribute("data-discord-key");
    if (key === null) {
      continue;
    }
    const value = el.value.trim();
    if (value.length > 0) {
      set[key] = value;
    }
  }
}

function readDiscordForm(): Record<string, string> {
  const set: Record<string, string> = {};
  const discordToken = document.getElementById("messaging-discord-token");
  const discordAllowed = document.getElementById("messaging-discord-allowed");
  if (discordToken instanceof HTMLInputElement && discordToken.value.trim().length > 0) {
    set.DISCORD_BOT_TOKEN = discordToken.value.trim();
  }
  if (discordAllowed instanceof HTMLInputElement && discordAllowed.value.trim().length > 0) {
    set.DISCORD_ALLOWED_USERS = discordAllowed.value.trim();
  }
  readDiscordFieldsFromAdvanced(set);
  return set;
}

function readSlackForm(): Record<string, string> {
  const set: Record<string, string> = {};
  const slackBot = document.getElementById("messaging-slack-bot");
  const slackApp = document.getElementById("messaging-slack-app");
  if (slackBot instanceof HTMLInputElement && slackBot.value.trim().length > 0) {
    set.SLACK_BOT_TOKEN = slackBot.value.trim();
  }
  if (slackApp instanceof HTMLInputElement && slackApp.value.trim().length > 0) {
    set.SLACK_APP_TOKEN = slackApp.value.trim();
  }
  return set;
}

function clearMessagingInputs(platform: "discord" | "slack"): void {
  if (platform === "discord") {
    for (const id of ["messaging-discord-token", "messaging-discord-allowed"]) {
      const el = document.getElementById(id);
      if (el instanceof HTMLInputElement) {
        el.value = "";
      }
    }
    const adv = document.getElementById("messaging-discord-advanced");
    if (adv !== null) {
      for (const el of Array.from(
        adv.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-discord-key]"),
      )) {
        if (el instanceof HTMLInputElement) {
          el.value = "";
        } else {
          el.selectedIndex = 0;
        }
      }
    }
    return;
  }
  for (const id of ["messaging-slack-bot", "messaging-slack-app"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
      el.value = "";
    }
  }
}

type MessagingPlatform = "discord" | "slack";

async function saveMessagingSettings(platform: MessagingPlatform): Promise<void> {
  if (messagingBusy) {
    return;
  }
  const set = platform === "discord" ? readDiscordForm() : readSlackForm();
  if (Object.keys(set).length === 0) {
    const name = platform === "discord" ? "Discord" : "Slack";
    setMessagingStatus(
      `Nothing to save for ${name} — enter at least one value or use Clear to remove keys.`,
    );
    return;
  }
  setMessagingBusy(true);
  setMessagingStatus("Saving and restarting gateway…");
  try {
    const response = await postEnvBatch({ set });
    const done =
      platform === "discord" ? "Discord settings written to .env." : "Slack settings written to .env.";
    applyMessagingMutationResponse(response, done);
    clearMessagingInputs(platform);
  } catch (cause: unknown) {
    setMessagingStatus(`Save failed: ${getErrorMessage(cause)}`);
  } finally {
    setMessagingBusy(false);
  }
}

async function clearMessagingPlatformKeys(
  platform: MessagingPlatform,
  keys: readonly string[],
  label: string,
): Promise<void> {
  if (messagingBusy) {
    return;
  }
  if (!window.confirm(`Remove ${label} keys from data/.env and restart the gateway?`)) {
    return;
  }
  setMessagingBusy(true);
  setMessagingStatus("Removing keys and restarting gateway…");
  try {
    const response = await postEnvBatch({ remove: [...keys] });
    applyMessagingMutationResponse(
      response,
      `${label} keys removed from .env.`,
    );
    clearMessagingInputs(platform);
  } catch (cause: unknown) {
    setMessagingStatus(`Clear failed: ${getErrorMessage(cause)}`);
  } finally {
    setMessagingBusy(false);
  }
}

function setupMessagingPlatform(): void {
  void refreshMessagingEnvHint();
  updateMessagingButtons();

  const saveDiscord = document.getElementById("messaging-save-discord");
  if (saveDiscord instanceof HTMLButtonElement) {
    saveDiscord.addEventListener("click", () => {
      void saveMessagingSettings("discord");
    });
  }
  const saveSlack = document.getElementById("messaging-save-slack");
  if (saveSlack instanceof HTMLButtonElement) {
    saveSlack.addEventListener("click", () => {
      void saveMessagingSettings("slack");
    });
  }
  const clearDiscord = document.getElementById("messaging-clear-discord");
  if (clearDiscord instanceof HTMLButtonElement) {
    clearDiscord.addEventListener("click", () => {
      void clearMessagingPlatformKeys("discord", MESSAGING_DISCORD_ALL_KEYS, "Discord");
    });
  }
  const clearSlack = document.getElementById("messaging-clear-slack");
  if (clearSlack instanceof HTMLButtonElement) {
    clearSlack.addEventListener("click", () => {
      void clearMessagingPlatformKeys("slack", MESSAGING_SLACK_KEYS, "Slack");
    });
  }
}

type MonacoApi = typeof import("monaco-editor");
type MonacoAmdRequire = {
  config: (options: { paths: { vs: string } }) => void;
  (modules: readonly string[], onLoad: (monaco: MonacoApi) => void, onError?: (error: unknown) => void): void;
};
type MonacoGlobal = typeof globalThis & {
  monaco?: MonacoApi;
  require?: MonacoAmdRequire;
};

const monacoAssetsPath = "/assets/monaco/vs";
const monacoLoaderPath = `${monacoAssetsPath}/loader.js`;

async function loadMonaco(): Promise<MonacoApi> {
  const global = globalThis as MonacoGlobal;
  if (global.monaco) {
    return global.monaco;
  }
  await loadScript(monacoLoaderPath);
  const amdRequire = global.require;
  if (!amdRequire) {
    throw new Error("Monaco loader did not initialize.");
  }
  amdRequire.config({ paths: { vs: monacoAssetsPath } });
  return new Promise((resolve, reject) => {
    amdRequire(
      ["vs/editor/editor.main"],
      () => {
        if (!global.monaco) {
          reject(new Error("Monaco editor did not initialize."));
          return;
        }
        resolve(global.monaco);
      },
      reject,
    );
  });
}

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.append(script);
  });
}

function getBasicAuthTokenFromLocation(): string | undefined {
  const url = new URL(window.location.href);
  if (!url.username || !url.password) {
    return undefined;
  }
  return `Basic ${btoa(`${url.username}:${url.password}`)}`;
}

function getErrorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  return String(cause);
}

async function getGatewayStatus(): Promise<GatewayStatus> {
  const response = await rpcClient.gateway.status.$get();
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
  return response.json() as Promise<GatewayStatus>;
}

async function getLogTail(): Promise<LogTail> {
  const response = await rpcClient.logs.tail.$get();
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
  return response.json() as Promise<LogTail>;
}

async function getConfigRead(): Promise<ConfigReadResult> {
  const response = await rpcClient.config.$get();
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
  return response.json() as Promise<ConfigReadResult>;
}

async function getEnvRead(): Promise<EnvReadResult> {
  const response = await rpcClient.env.$get();
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
  return response.json() as Promise<EnvReadResult>;
}

async function postEnvUpsert(key: string, value: string): Promise<EnvMutationResponse> {
  const response = await rpcClient.env.$post({
    json: { key, value },
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
  return response.json() as Promise<EnvMutationResponse>;
}

async function postEnvBatch(body: {
  set?: Record<string, string>;
  remove?: string[];
}): Promise<EnvMutationResponse> {
  const response = await rpcClient.env.batch.$post({
    json: body,
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
  return response.json() as Promise<EnvMutationResponse>;
}

async function deleteEnvKey(key: string): Promise<EnvMutationResponse> {
  const response = await rpcClient.env[":key"].$delete({
    param: { key },
  });
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
  return response.json() as Promise<EnvMutationResponse>;
}

async function postConfig(content: string): Promise<ConfigSaveResponse> {
  const response = await rpcClient.config.$post({
    json: { content },
  });
  if (!response.ok && response.status !== 422) {
    throw new Error(await getResponseErrorMessage(response));
  }
  return response.json() as Promise<ConfigSaveResponse>;
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  const body = await response.text();
  if (!body) {
    return `${response.status} ${response.statusText}`;
  }
  try {
    const parsed = JSON.parse(body) as unknown;
    if (isErrorResponse(parsed)) {
      return parsed.error;
    }
    return body;
  } catch {
    return body;
  }
}

function isErrorResponse(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  );
}

main();
