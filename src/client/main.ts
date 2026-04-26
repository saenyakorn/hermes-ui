import type { editor } from "monaco-editor";

type GatewayStatus = {
  state: string;
  health: string;
  pid: number | null;
  cwd: string;
  startedAt: string | null;
  uptimeMs: number | null;
  exitCode: number | null;
  lastError: string | null;
  logWarning: string | null;
};

type LogTail = {
  lines: string[];
  warning: string | null;
};

type ConfigValidationIssue = { message: string; path: string | null };
type ConfigReadResult = {
  path: string;
  content: string;
  updatedAt: string | null;
  validation: { ok: boolean; issues: ConfigValidationIssue[] };
};
type ConfigSaveResult = ConfigReadResult & { saved: boolean };
type ConfigSaveResponse = {
  config: ConfigSaveResult;
  restart: { attempted: boolean; ok: boolean; error: string | null };
  gateway: GatewayStatus;
};

let configEditor: editor.IStandaloneCodeEditor | null = null;
let savedConfigContent: string | null = null;
let configLoaded = false;
let isSavingConfig = false;
let lastConfigStatus: string | null = null;

const monacoAssetsPath = "/assets/monaco/vs";
const monacoLoaderPath = `${monacoAssetsPath}/loader.js`;

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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(url, window.location.origin), init);

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

function renderStatus(status: GatewayStatus): void {
  const target = document.querySelector<HTMLElement>("#gateway-status");
  if (!target) {
    return;
  }

  target.dataset.state = status.state;
  target.replaceChildren(
    createStatusRow("State", status.state),
    createStatusRow("Health", status.health),
    createStatusRow("PID", status.pid?.toString() ?? "-"),
    createStatusRow("CWD", status.cwd),
    createStatusRow("Last error", status.lastError ?? "-"),
  );
}

function createStatusRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement("div");
  const text = document.createTextNode(`${label}: `);
  const valueElement = document.createElement("span");
  valueElement.className = "text-text";
  valueElement.textContent = value;
  row.append(text, valueElement);
  return row;
}

async function refreshStatus(): Promise<void> {
  const status = await fetchJson<GatewayStatus>("/gateway/status");
  renderStatus(status);
}

async function refreshLogs(): Promise<void> {
  const logs = await fetchJson<LogTail>("/logs/tail");
  const target = document.querySelector<HTMLElement>("#log-tail");
  if (!target) {
    return;
  }

  target.textContent = logs.lines.join("\n");
}

function bindActions(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      if (!action) {
        return;
      }

      button.disabled = true;
      try {
        const status = await fetchJson<GatewayStatus>(`/gateway/${action}`, { method: "POST" });
        renderStatus(status);
        await refreshLogs();
      } finally {
        button.disabled = false;
      }
    });
  });
}

function bindLogStream(): void {
  const source = new EventSource(new URL("/logs/stream", window.location.origin));
  source.addEventListener("message", () => {
    void refreshLogs();
  });
}

function setText(selector: string, value: string): void {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) {
    return;
  }

  target.textContent = value;
}

function renderConfigStatus(message: string): void {
  if (lastConfigStatus === message) {
    return;
  }

  lastConfigStatus = message;
  setText("#config-status", message);
}

function renderConfigErrors(issues: ConfigValidationIssue[]): void {
  const target = document.querySelector<HTMLElement>("#config-errors");
  if (!target) {
    return;
  }

  if (issues.length === 0) {
    target.replaceChildren();
    return;
  }

  const list = document.createElement("ul");
  list.className = "space-y-1";
  issues.forEach((issue) => {
    const item = document.createElement("li");
    item.textContent = issue.path ? `${issue.path}: ${issue.message}` : issue.message;
    list.append(item);
  });
  target.replaceChildren(list);
}

function updateSaveButton(): void {
  const saveButton = document.querySelector<HTMLButtonElement>("#config-save");
  if (!saveButton) {
    return;
  }

  saveButton.disabled = !configLoaded || isSavingConfig || !isConfigDirty();
}

function renderConfigMetadata(config: ConfigReadResult): void {
  setText("#config-path", config.path);
  setText("#config-updated-at", config.updatedAt ? `Updated ${config.updatedAt}` : "Not saved yet");
}

async function loadConfigFromDisk(): Promise<void> {
  if (!configEditor) {
    return;
  }

  configLoaded = false;
  updateSaveButton();
  renderConfigStatus("Loading config...");
  renderConfigErrors([]);

  try {
    const config = await fetchJson<ConfigReadResult>("/config");
    savedConfigContent = config.content;
    configEditor.setValue(config.content);
    configLoaded = true;
    renderConfigMetadata(config);
    renderConfigErrors(config.validation.issues);
    renderConfigStatus("No unsaved changes.");
  } catch (cause: unknown) {
    renderConfigStatus(`Failed to load config: ${getErrorMessage(cause)}`);
  } finally {
    updateSaveButton();
  }
}

async function saveConfig(): Promise<void> {
  if (!configEditor || !configLoaded || !isConfigDirty()) {
    updateSaveButton();
    return;
  }

  isSavingConfig = true;
  updateSaveButton();
  renderConfigStatus("Saving config...");

  try {
    const submittedContent = configEditor.getValue();
    const response = await fetchConfigSaveResponse(submittedContent);
    const currentContent = configEditor.getValue();

    if (!response.config.saved) {
      renderConfigMetadata(response.config);
      renderStatus(response.gateway);

      if (currentContent !== submittedContent) {
        renderConfigErrors([]);
        renderConfigStatus("Config changed after save started. Review current edits before saving again.");
        return;
      }

      renderConfigErrors(response.config.validation.issues);
      renderConfigStatus("Config validation failed. File was not changed.");
      return;
    }

    const savedContent = response.config.content;
    savedConfigContent = savedContent;
    renderConfigMetadata(response.config);
    renderConfigErrors(response.config.validation.issues);
    renderStatus(response.gateway);

    if (currentContent !== savedContent) {
      renderConfigStatus("Unsaved changes.");
      return;
    }

    renderConfigStatus(getRestartStatusMessage(response));
  } catch (cause: unknown) {
    renderConfigStatus(`Failed to save config: ${getErrorMessage(cause)}`);
  } finally {
    isSavingConfig = false;
    updateSaveButton();
  }
}

async function reloadConfigWithConfirmation(): Promise<void> {
  if (configLoaded && isConfigDirty() && !window.confirm("Discard unsaved config changes?")) {
    return;
  }

  await loadConfigFromDisk();
}

async function initializeConfigEditor(): Promise<void> {
  const container = document.querySelector<HTMLElement>("#config-editor");
  if (!container) {
    return;
  }

  try {
    const monaco = await loadMonaco();
    const editorInstance = monaco.editor.create(container, {
      value: "",
      language: "yaml",
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      scrollBeyondLastLine: false,
    });
    configEditor = editorInstance;

    const layoutEditorIfVisible = (): void => {
      if (container.offsetWidth < 2 || container.offsetHeight < 2) {
        return;
      }
      editorInstance.layout();
    };
    const resizeObserver = new ResizeObserver(() => {
      layoutEditorIfVisible();
    });
    resizeObserver.observe(container);
    const panel = container.closest<HTMLElement>('[role="tabpanel"]');
    if (panel) {
      const visibilityObserver = new MutationObserver(() => {
        layoutEditorIfVisible();
      });
      visibilityObserver.observe(panel, {
        attributes: true,
        attributeFilter: ["hidden", "style", "class", "data-state"],
      });
    }
    layoutEditorIfVisible();

    editorInstance.onDidChangeModelContent(() => {
      if (!configLoaded) {
        updateSaveButton();
        return;
      }

      renderConfigStatus(isConfigDirty() ? "Unsaved changes." : "No unsaved changes.");
      updateSaveButton();
    });

    document.querySelector<HTMLButtonElement>("#config-save")?.addEventListener("click", () => {
      void saveConfig();
    });
    document.querySelector<HTMLButtonElement>("#config-reload")?.addEventListener("click", () => {
      void reloadConfigWithConfirmation();
    });

    await loadConfigFromDisk();
  } catch (cause: unknown) {
    renderConfigStatus(`Failed to initialize config editor: ${getErrorMessage(cause)}`);
  }
}

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
  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existingScript) {
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

function isConfigDirty(): boolean {
  return savedConfigContent !== null && configEditor?.getValue() !== savedConfigContent;
}

async function fetchConfigSaveResponse(content: string): Promise<ConfigSaveResponse> {
  const response = await fetch(new URL("/config", window.location.origin), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok && response.status !== 422) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return response.json() as Promise<ConfigSaveResponse>;
}

function getRestartStatusMessage(response: ConfigSaveResponse): string {
  if (response.restart.attempted && response.restart.ok) {
    return "Config saved. Gateway restarted.";
  }

  if (response.restart.attempted) {
    return `Config saved. Gateway restart failed: ${response.restart.error ?? "Unknown error"}`;
  }

  return "Config saved. Gateway was stopped, so no restart was needed.";
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
  } catch {
    return body;
  }

  return body;
}

function isErrorResponse(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  );
}

function getErrorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause);
}

bindActions();
void refreshStatus();
void refreshLogs();
bindLogStream();
void initializeConfigEditor();
setInterval(() => {
  void refreshStatus();
}, 3000);
