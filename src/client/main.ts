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
  ModelProvidersMutationResponse,
  ModelYamlPatch,
} from "../server/types";

type GatewayAction = "start" | "stop" | "restart";
type TabKey = "control" | "logs" | "shell" | "config" | "env" | "messaging" | "model-providers";

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
let modelProvidersBusy = false;
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

const MODEL_OPENROUTER_KEYS = ["OPENROUTER_API_KEY", "OPENROUTER_BASE_URL"] as const;
const MODEL_ANTHROPIC_KEYS = ["ANTHROPIC_API_KEY"] as const;
const MODEL_OPENAI_KEYS = ["OPENAI_API_KEY", "OPENAI_BASE_URL"] as const;
const MODEL_GEMINI_KEYS = ["GOOGLE_API_KEY", "GEMINI_API_KEY", "GEMINI_BASE_URL"] as const;

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
  void setupModelProviders();
}

function parseInitialStatus(): GatewayStatus {
  const script = document.querySelector<HTMLScriptElement>("script[data-initial-status]");
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
    if (tab === "model-providers") {
      const first = document.getElementById("mp-yaml-default");
      if (first instanceof HTMLInputElement) {
        first.focus();
      }
      void refreshModelProvidersEnvHint();
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
        key === "messaging" ||
        key === "model-providers"
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
      setConfigStatus(
        `Config saved. Gateway restart failed: ${response.restart.error ?? "Unknown error"}`,
      );
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

function applyMessagingMutationResponse(response: EnvMutationResponse, doneMessage: string): void {
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
      platform === "discord"
        ? "Discord settings written to .env."
        : "Slack settings written to .env.";
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
    applyMessagingMutationResponse(response, `${label} keys removed from .env.`);
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

function countEnvKeysPresent(env: EnvReadResult, keys: readonly string[]): number {
  return keys.filter((key) => env.entries.some((e) => e.key === key)).length;
}

function setModelProvidersStatus(message: string): void {
  const el = document.getElementById("model-providers-status");
  if (el) {
    el.textContent = message;
  }
}

function renderModelProvidersEnvHint(env: EnvReadResult): void {
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

async function refreshModelProvidersEnvHint(): Promise<void> {
  const hint = document.getElementById("model-providers-env-hint");
  if (!hint) {
    return;
  }
  hint.textContent = "Loading…";
  try {
    const env = await getEnvRead();
    renderModelProvidersEnvHint(env);
  } catch (cause: unknown) {
    hint.textContent = `Could not load .env: ${getErrorMessage(cause)}`;
  }
}

const MODEL_PROVIDERS_BUTTON_IDS = [
  "mp-save-yaml",
  "mp-save-or",
  "mp-clear-or",
  "mp-save-anthropic",
  "mp-clear-anthropic",
  "mp-save-openai",
  "mp-clear-openai",
  "mp-save-gemini",
  "mp-clear-gemini",
] as const;

function updateModelProvidersButtons(): void {
  for (const id of MODEL_PROVIDERS_BUTTON_IDS) {
    const button = document.getElementById(id);
    if (button instanceof HTMLButtonElement) {
      button.disabled = modelProvidersBusy;
    }
  }
}

function setModelProvidersBusy(busy: boolean): void {
  modelProvidersBusy = busy;
  updateModelProvidersButtons();
}

function applyModelProvidersMutationResponse(
  response: ModelProvidersMutationResponse,
  doneMessage: string,
): void {
  renderEnvMeta(response.env);
  renderEnvList(response.env.entries);
  renderGatewayStatus(response.gateway, null);
  queryClient.setQueryData(gatewayQueryKey, response.gateway);
  renderModelProvidersEnvHint(response.env);
  void syncConfigEditorFromServerIfClean();
  if (response.restart.ok) {
    setModelProvidersStatus(`${doneMessage} Gateway restarted.`);
    return;
  }
  if (!response.restart.attempted) {
    setModelProvidersStatus(`${doneMessage} Gateway was stopped; no restart performed.`);
    return;
  }
  setModelProvidersStatus(
    `${doneMessage} Gateway restart failed: ${response.restart.error ?? "Unknown error"}`,
  );
}

async function syncConfigEditorFromServerIfClean(): Promise<void> {
  if (!configEditor || !configLoaded || isConfigDirty()) {
    return;
  }
  try {
    const config = await getConfigRead();
    savedConfigContent = config.content;
    configEditor.setValue(config.content);
    renderConfigMeta(config);
    renderConfigIssues(config.validation.issues);
    setConfigStatus("No unsaved changes.");
    updateSaveState();
  } catch {
    // User can reload from disk on the Hermes config tab if this fails.
  }
}

type ModelProvidersSavePayload = {
  model?: ModelYamlPatch;
  env?: { set?: Record<string, string>; remove?: string[] };
};

async function postModelProvidersSettings(
  body: ModelProvidersSavePayload,
): Promise<ModelProvidersMutationResponse> {
  const response = await fetch(`${window.location.origin}/settings/model-providers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  if (!response.ok) {
    let message = `${String(response.status)} ${response.statusText}`;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "error" in parsed &&
          typeof (parsed as { error: unknown }).error === "string"
        ) {
          message = (parsed as { error: string }).error;
        } else {
          message = raw;
        }
      } catch {
        message = raw;
      }
    }
    throw new Error(message);
  }
  if (!raw) {
    throw new Error("Empty response from server.");
  }
  return JSON.parse(raw) as ModelProvidersMutationResponse;
}

function readYamlModelForm(): ModelYamlPatch | undefined {
  const model: ModelYamlPatch = {};
  const defaultEl = document.getElementById("mp-yaml-default");
  const providerEl = document.getElementById("mp-yaml-provider");
  const baseUrlEl = document.getElementById("mp-yaml-base-url");
  if (defaultEl instanceof HTMLInputElement && defaultEl.value.trim().length > 0) {
    model.default = defaultEl.value.trim();
  }
  if (providerEl instanceof HTMLInputElement && providerEl.value.trim().length > 0) {
    model.provider = providerEl.value.trim();
  }
  if (baseUrlEl instanceof HTMLInputElement && baseUrlEl.value.trim().length > 0) {
    model.base_url = baseUrlEl.value.trim();
  }
  return Object.keys(model).length > 0 ? model : undefined;
}

function clearYamlModelInputs(): void {
  for (const id of ["mp-yaml-default", "mp-yaml-provider", "mp-yaml-base-url"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
      el.value = "";
    }
  }
}

function readOpenRouterForm(): Record<string, string> {
  const set: Record<string, string> = {};
  const keyEl = document.getElementById("mp-or-key");
  const baseEl = document.getElementById("mp-or-base");
  if (keyEl instanceof HTMLInputElement && keyEl.value.trim().length > 0) {
    set.OPENROUTER_API_KEY = keyEl.value.trim();
  }
  if (baseEl instanceof HTMLInputElement && baseEl.value.trim().length > 0) {
    set.OPENROUTER_BASE_URL = baseEl.value.trim();
  }
  return set;
}

function clearOpenRouterInputs(): void {
  for (const id of ["mp-or-key", "mp-or-base"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
      el.value = "";
    }
  }
}

function readAnthropicForm(): Record<string, string> {
  const set: Record<string, string> = {};
  const keyEl = document.getElementById("mp-anthropic-key");
  if (keyEl instanceof HTMLInputElement && keyEl.value.trim().length > 0) {
    set.ANTHROPIC_API_KEY = keyEl.value.trim();
  }
  return set;
}

function clearAnthropicInputs(): void {
  const el = document.getElementById("mp-anthropic-key");
  if (el instanceof HTMLInputElement) {
    el.value = "";
  }
}

function readOpenAiForm(): Record<string, string> {
  const set: Record<string, string> = {};
  const keyEl = document.getElementById("mp-openai-key");
  const baseEl = document.getElementById("mp-openai-base");
  if (keyEl instanceof HTMLInputElement && keyEl.value.trim().length > 0) {
    set.OPENAI_API_KEY = keyEl.value.trim();
  }
  if (baseEl instanceof HTMLInputElement && baseEl.value.trim().length > 0) {
    set.OPENAI_BASE_URL = baseEl.value.trim();
  }
  return set;
}

function clearOpenAiInputs(): void {
  for (const id of ["mp-openai-key", "mp-openai-base"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
      el.value = "";
    }
  }
}

function readGeminiForm(): Record<string, string> {
  const set: Record<string, string> = {};
  const keyEl = document.getElementById("mp-google-key");
  const baseEl = document.getElementById("mp-gemini-base");
  if (keyEl instanceof HTMLInputElement && keyEl.value.trim().length > 0) {
    set.GOOGLE_API_KEY = keyEl.value.trim();
  }
  if (baseEl instanceof HTMLInputElement && baseEl.value.trim().length > 0) {
    set.GEMINI_BASE_URL = baseEl.value.trim();
  }
  return set;
}

function clearGeminiInputs(): void {
  for (const id of ["mp-google-key", "mp-gemini-base"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) {
      el.value = "";
    }
  }
}

function modelProvidersPayloadHasWork(payload: ModelProvidersSavePayload): boolean {
  const hasModel = payload.model !== undefined && Object.keys(payload.model).length > 0;
  const hasEnvSet =
    payload.env?.set !== undefined && Object.keys(payload.env.set).length > 0;
  const hasEnvRemove =
    payload.env?.remove !== undefined && payload.env.remove.length > 0;
  return hasModel || hasEnvSet || hasEnvRemove;
}

async function saveModelProvidersFromPayload(
  payload: ModelProvidersSavePayload,
  emptyHint: string,
  doneMessage: string,
  clear?: () => void,
): Promise<void> {
  if (modelProvidersBusy) {
    return;
  }
  if (!modelProvidersPayloadHasWork(payload)) {
    setModelProvidersStatus(emptyHint);
    return;
  }
  setModelProvidersBusy(true);
  setModelProvidersStatus("Saving…");
  try {
    const response = await postModelProvidersSettings(payload);
    applyModelProvidersMutationResponse(response, doneMessage);
    clear?.();
  } catch (cause: unknown) {
    setModelProvidersStatus(`Save failed: ${getErrorMessage(cause)}`);
  } finally {
    setModelProvidersBusy(false);
  }
}

async function clearModelProviderKeys(
  keys: readonly string[],
  label: string,
  afterClear?: () => void,
): Promise<void> {
  if (modelProvidersBusy) {
    return;
  }
  if (
    !window.confirm(
      `Remove ${label} keys from data/.env and restart the gateway if it is running?`,
    )
  ) {
    return;
  }
  setModelProvidersBusy(true);
  setModelProvidersStatus("Removing keys…");
  try {
    const response = await postModelProvidersSettings({ env: { remove: [...keys] } });
    applyModelProvidersMutationResponse(response, `${label} keys removed from .env.`);
    afterClear?.();
  } catch (cause: unknown) {
    setModelProvidersStatus(`Clear failed: ${getErrorMessage(cause)}`);
  } finally {
    setModelProvidersBusy(false);
  }
}

function setupModelProviders(): void {
  void refreshModelProvidersEnvHint();
  updateModelProvidersButtons();

  const saveYaml = document.getElementById("mp-save-yaml");
  if (saveYaml instanceof HTMLButtonElement) {
    saveYaml.addEventListener("click", () => {
      const model = readYamlModelForm();
      void saveModelProvidersFromPayload(
        model ? { model } : {},
        "Nothing to save — enter at least one default model field.",
        "Default model written to config.yaml.",
        model ? clearYamlModelInputs : undefined,
      );
    });
  }

  const saveOr = document.getElementById("mp-save-or");
  if (saveOr instanceof HTMLButtonElement) {
    saveOr.addEventListener("click", () => {
      const set = readOpenRouterForm();
      void saveModelProvidersFromPayload(
        { env: { set } },
        "Nothing to save for OpenRouter — enter at least one value.",
        "OpenRouter settings written to .env.",
        Object.keys(set).length > 0 ? clearOpenRouterInputs : undefined,
      );
    });
  }
  const clearOr = document.getElementById("mp-clear-or");
  if (clearOr instanceof HTMLButtonElement) {
    clearOr.addEventListener("click", () => {
      void clearModelProviderKeys([...MODEL_OPENROUTER_KEYS], "OpenRouter", clearOpenRouterInputs);
    });
  }

  const saveAnthropic = document.getElementById("mp-save-anthropic");
  if (saveAnthropic instanceof HTMLButtonElement) {
    saveAnthropic.addEventListener("click", () => {
      const set = readAnthropicForm();
      void saveModelProvidersFromPayload(
        { env: { set } },
        "Nothing to save for Claude — enter the API key.",
        "Claude (Anthropic) settings written to .env.",
        Object.keys(set).length > 0 ? clearAnthropicInputs : undefined,
      );
    });
  }
  const clearAnthropic = document.getElementById("mp-clear-anthropic");
  if (clearAnthropic instanceof HTMLButtonElement) {
    clearAnthropic.addEventListener("click", () => {
      void clearModelProviderKeys([...MODEL_ANTHROPIC_KEYS], "Claude", clearAnthropicInputs);
    });
  }

  const saveOpenai = document.getElementById("mp-save-openai");
  if (saveOpenai instanceof HTMLButtonElement) {
    saveOpenai.addEventListener("click", () => {
      const set = readOpenAiForm();
      void saveModelProvidersFromPayload(
        { env: { set } },
        "Nothing to save for OpenAI — enter at least one value.",
        "OpenAI settings written to .env.",
        Object.keys(set).length > 0 ? clearOpenAiInputs : undefined,
      );
    });
  }
  const clearOpenai = document.getElementById("mp-clear-openai");
  if (clearOpenai instanceof HTMLButtonElement) {
    clearOpenai.addEventListener("click", () => {
      void clearModelProviderKeys([...MODEL_OPENAI_KEYS], "OpenAI", clearOpenAiInputs);
    });
  }

  const saveGemini = document.getElementById("mp-save-gemini");
  if (saveGemini instanceof HTMLButtonElement) {
    saveGemini.addEventListener("click", () => {
      const set = readGeminiForm();
      void saveModelProvidersFromPayload(
        { env: { set } },
        "Nothing to save for Gemini — enter at least one value.",
        "Gemini settings written to .env.",
        Object.keys(set).length > 0 ? clearGeminiInputs : undefined,
      );
    });
  }
  const clearGemini = document.getElementById("mp-clear-gemini");
  if (clearGemini instanceof HTMLButtonElement) {
    clearGemini.addEventListener("click", () => {
      void clearModelProviderKeys([...MODEL_GEMINI_KEYS], "Gemini", clearGeminiInputs);
    });
  }
}

type MonacoApi = typeof import("monaco-editor");
type MonacoAmdRequire = {
  config: (options: { paths: { vs: string } }) => void;
  (
    modules: readonly string[],
    onLoad: (monaco: MonacoApi) => void,
    onError?: (error: unknown) => void,
  ): void;
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
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {
      once: true,
    });
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
