import { Tabs } from "@base-ui/react";
import { useCallback, useState } from "react";
import type { GatewayStatus } from "../../server/types";
import {
  Select,
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { useProfilesTab } from "../hooks/useProfilesTab";
import { dispatchProfilesTabShown, dispatchSessionsTabShown } from "../lib/event";
import type { TabKey } from "../tabs";
import { ConfigTab } from "./ui/ConfigTab";
import { ControlTab } from "./ui/ControlTab";
import { EnvTab } from "./ui/EnvTab";
import { LogsTab } from "./ui/LogsTab";
import { ProfilesTab } from "./ui/ProfilesTab";
import { ShellTab } from "./ui/ShellTab";
import { SessionsTab } from "./ui/SessionsTab";
import { MessagingPanel } from "./ui/MessagingPanel";
import { ModelProvidersPanel } from "./ui/ModelProvidersPanel";
import { TabSection } from "./ui/TabSection";
import { WorkspaceTabsHeader } from "./ui/WorkspaceTabsHeader";

type AppProps = {
  initialStatus: GatewayStatus;
};

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

export function App({ initialStatus }: AppProps) {
  const profiles = useProfilesTab();
  const [activeTab, setActiveTab] = useState<TabKey>(() => readInitialTab());
  const onTabChange = useCallback((tab: TabKey) => {
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
  }, []);

  return (
    <main className="h-screen overflow-x-hidden overflow-y-hidden bg-background text-text">
      <section
        id="workspace"
        className="mx-auto flex h-full min-w-0 max-w-[1400px] flex-1 flex-col overflow-hidden rounded-xl border border-accent-border bg-surface p-3"
      >
        <Tabs.Root
          value={activeTab}
          onValueChange={(value) => {
            onTabChange(value as TabKey);
          }}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <WorkspaceTabsHeader
            activeTab={activeTab}
            profilePicker={
              <Select
                id="profile-picker"
                value={profiles.pickerValue}
                onValueChange={(value) => {
                  const nextValue = String(value ?? "default");
                  void profiles.activate(nextValue === "default" ? null : nextValue);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                  <SelectIcon aria-hidden>▾</SelectIcon>
                </SelectTrigger>
                <SelectContent>
                  {profiles.pickerOptions.length === 0 ? (
                    <SelectItem value="default">
                      <SelectItemText>default</SelectItemText>
                    </SelectItem>
                  ) : (
                    profiles.pickerOptions.map((profile) => (
                      <SelectItem key={profile.label} value={profile.name ?? "default"}>
                        <SelectItemText>{profile.label}</SelectItemText>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            }
          />

          <TabSection value="control">
            <ControlTab initialStatus={initialStatus} />
          </TabSection>

          <TabSection value="logs">
            <LogsTab />
          </TabSection>

          <TabSection value="shell">
            <ShellTab />
          </TabSection>

          <TabSection value="config">
            <ConfigTab />
          </TabSection>

          <TabSection value="env">
            <EnvTab />
          </TabSection>

          <TabSection value="messaging">
            <MessagingPanel />
          </TabSection>

          <TabSection value="model-providers">
            <ModelProvidersPanel />
          </TabSection>

          <TabSection value="profiles">
            <ProfilesTab />
          </TabSection>

          <TabSection value="sessions">
            <SessionsTab />
          </TabSection>
        </Tabs.Root>
      </section>
    </main>
  );
}
