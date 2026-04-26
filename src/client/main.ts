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
  GatewayStatus,
  LogTail,
} from "../server/types";

type GatewayAction = "start" | "stop" | "restart";
type TabKey = "logs" | "shell" | "config";

const queryClient = new QueryClient();
const gatewayQueryKey = ["gateway-status"] as const;
const logsQueryKey = ["log-tail"] as const;
let configEditor: import("monaco-editor").editor.IStandaloneCodeEditor | null = null;
let savedConfigContent: string | null = null;
let configLoaded = false;
let isSaving = false;
let shellTerminal: Terminal | null = null;
const rpcClient = hc<AppType>(window.location.origin);

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
    for (const trigger of triggers) {
      const active = trigger.dataset.tabTrigger === tab;
      trigger.classList.toggle("bg-frosted", active);
      trigger.classList.toggle("text-text", active);
      trigger.classList.toggle("text-muted", !active);
    }
    for (const panel of panels) {
      panel.classList.toggle("hidden", panel.dataset.tabPanel !== tab);
      panel.classList.toggle("flex", panel.dataset.tabPanel === tab);
    }
    if (tab === "shell") {
      shellTerminal?.focus();
    }
    if (tab === "config") {
      configEditor?.layout();
    }
  };

  for (const trigger of triggers) {
    trigger.addEventListener("click", () => {
      const key = trigger.dataset.tabTrigger;
      if (key === "logs" || key === "shell" || key === "config") {
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
