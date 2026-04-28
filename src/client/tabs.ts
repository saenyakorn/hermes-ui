import type { Terminal } from "@xterm/xterm";
import type { HermesWorkspaceDeps } from "./workspace-deps";
import { refreshMessagingEnvHint } from "./messaging-ui";
import { refreshModelProvidersEnvHint } from "./model-providers-ui";

export type TabKey =
  | "control"
  | "logs"
  | "shell"
  | "config"
  | "env"
  | "messaging"
  | "model-providers"
  | "profiles"
  | "sessions";

const LAST_OPEN_TAB_STORAGE_KEY = "hermes.workspace.lastOpenTab";

function isTabKey(value: string): value is TabKey {
  return (
    value === "control" ||
    value === "logs" ||
    value === "shell" ||
    value === "config" ||
    value === "env" ||
    value === "messaging" ||
    value === "model-providers" ||
    value === "profiles" ||
    value === "sessions"
  );
}

function readLastOpenTabFromStorage(): TabKey | null {
  try {
    const raw = localStorage.getItem(LAST_OPEN_TAB_STORAGE_KEY);
    if (!raw || !isTabKey(raw)) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

function persistLastOpenTabToStorage(tab: TabKey): void {
  try {
    localStorage.setItem(LAST_OPEN_TAB_STORAGE_KEY, tab);
  } catch {
    // Quota, private mode, or storage disabled
  }
}

export type WireTabsDeps = {
  workspace: HermesWorkspaceDeps;
  getShellTerminal: () => Terminal | null;
  getConfigEditor: () => import("monaco-editor").editor.IStandaloneCodeEditor | null;
};

export function wireTabs(deps: WireTabsDeps): void {
  const setActiveTab = (tab: TabKey): void => {
    const triggers = document.querySelectorAll<HTMLButtonElement>("[data-tab-trigger]");
    const panels = document.querySelectorAll<HTMLElement>("[data-tab-panel]");

    for (const trigger of Array.from(triggers)) {
      const triggerKey = trigger.getAttribute("data-tab-trigger");
      const active = triggerKey === tab;
      trigger.classList.toggle("bg-frosted", active);
      trigger.classList.toggle("text-text", active);
      trigger.classList.toggle("text-muted", !active);
    }
    for (const panel of Array.from(panels)) {
      const panelKey = panel.getAttribute("data-tab-panel");
      if (!panelKey) {
        continue;
      }
      panel.hidden = panelKey !== tab;
    }

    persistLastOpenTabToStorage(tab);

    if (tab === "shell") {
      deps.getShellTerminal()?.focus();
    }
    if (tab === "config") {
      deps.getConfigEditor()?.layout();
    }
    if (tab === "env") {
      const keyInput = document.getElementById("env-key-input");
      if (keyInput instanceof HTMLInputElement) {
        keyInput.focus();
      }
    }
    if (tab === "messaging") {
      void refreshMessagingEnvHint(deps.workspace);
      const saveDiscord = document.getElementById("messaging-save-discord");
      if (saveDiscord instanceof HTMLButtonElement) {
        saveDiscord.focus();
      }
    }
    if (tab === "model-providers") {
      const first = document.getElementById("mp-yaml-default");
      if (first instanceof HTMLInputElement) {
        first.focus();
      }
      void refreshModelProvidersEnvHint(deps.workspace);
    }
    if (tab === "profiles") {
      window.dispatchEvent(new CustomEvent("profiles:tab-shown"));
    }
    if (tab === "sessions") {
      window.dispatchEvent(new CustomEvent("sessions:tab-shown"));
    }
  };

  const applyStoredOrDefaultTab = (): void => {
    const storedTab = readLastOpenTabFromStorage();
    setActiveTab(storedTab ?? "control");
  };

  applyStoredOrDefaultTab();

  window.addEventListener(
    "pageshow",
    (event) => {
      if (event.persisted) {
        applyStoredOrDefaultTab();
      }
    },
    { passive: true },
  );

  const onTabStripClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const workspace = document.getElementById("workspace");
    if (!workspace) {
      return;
    }
    const trigger = target.closest<HTMLButtonElement>("[data-tab-trigger]");
    if (!trigger || !workspace.contains(trigger)) {
      return;
    }
    const key = trigger.getAttribute("data-tab-trigger");
    if (
      key === "control" ||
      key === "logs" ||
      key === "shell" ||
      key === "config" ||
      key === "env" ||
      key === "messaging" ||
      key === "model-providers" ||
      key === "profiles" ||
      key === "sessions"
    ) {
      setActiveTab(key);
    }
  };

  document.body.addEventListener("click", onTabStripClick);
}
