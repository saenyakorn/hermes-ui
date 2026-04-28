import { useCallback, useState } from "react";
import type { TabKey } from "../tabs";
import { dispatchProfilesTabShown, dispatchSessionsTabShown } from "../lib/event";

const STORAGE_KEY = "hermes.workspace.lastOpenTab";

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

function readInitialTab(): TabKey {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isTabKey(raw)) {
      return raw;
    }
  } catch {
    // ignore storage errors
  }
  return "control";
}

export function useWorkspaceTabs(): {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  triggerClass: (tab: TabKey) => string;
} {
  const [activeTab, setActiveTab] = useState<TabKey>(() => readInitialTab());
  const selectTab = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    try {
      localStorage.setItem(STORAGE_KEY, tab);
    } catch {
      // ignore storage errors
    }
    if (tab === "profiles") {
      dispatchProfilesTabShown();
    }
    if (tab === "sessions") {
      dispatchSessionsTabShown();
    }
    if (tab === "shell") {
      const terminalHost = document.getElementById("terminal");
      if (terminalHost instanceof HTMLElement) {
        terminalHost.focus();
      }
    }
    if (tab === "env") {
      const keyInput = document.getElementById("env-key-input");
      if (keyInput instanceof HTMLInputElement) {
        keyInput.focus();
      }
    }
    if (tab === "model-providers") {
      const first = document.getElementById("mp-yaml-default");
      if (first instanceof HTMLInputElement) {
        first.focus();
      }
    }
  }, []);

  const triggerClass = (tab: TabKey): string =>
    `rounded-full px-4 py-2 text-sm ${activeTab === tab ? "bg-frosted text-text" : "text-muted"}`;

  return { activeTab, setActiveTab: selectTab, triggerClass };
}
