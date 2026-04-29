import { Tabs } from "@base-ui/react";
import { useCallback, useState } from "react";
import type { GatewayStatus } from "../../server/types";
import { Card } from "../components/Card";
import { useGatewayStatus } from "../hooks/useGatewayStatus";
import { dispatchProfilesTabShown, dispatchSessionsTabShown } from "../lib/event";
import type { TabKey } from "../tabs";
import { ProfileProvider } from "./profile-context";
import { ConfigTab } from "./ui/ConfigTab";
import { ControlTab } from "./ui/ControlTab";
import { EnvTab } from "./ui/EnvTab";
import { MessagingPanel } from "./ui/MessagingPanel";
import { ModelProvidersPanel } from "./ui/ModelProvidersPanel";
import { ProfilesTab } from "./ui/ProfilesTab";
import { SessionsTab } from "./ui/SessionsTab";
import { ShellTab } from "./ui/ShellTab";
import { TabSection } from "./ui/TabSection";
import { WorkspaceProfileDialog } from "./ui/WorkspaceProfileDialog";
import { WorkspaceTabsHeader } from "./ui/WorkspaceTabsHeader";
import { Dot, SectionLabel, StatusChip } from "../components/UiPrimitives";

type AppProps = {
  initialStatus: GatewayStatus;
};

const STORAGE_KEY = "hermes.workspace.lastOpenTab";

function isTabKey(value: string): value is TabKey {
  return (
    value === "control" ||
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

function formatUptime(uptimeMs: number | null): string {
  if (uptimeMs === null || uptimeMs <= 0) {
    return "-";
  }

  const totalSeconds = Math.floor(uptimeMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}h`;
  }
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

export function App({ initialStatus }: AppProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(() => readInitialTab());
  const gateway = useGatewayStatus(initialStatus);
  const isGatewayOnline = gateway.status.state.toLowerCase() === "running";
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
    <main className="h-screen overflow-y-auto bg-[radial-gradient(circle_at_85%_-10%,rgba(0,122,255,0.16),transparent_38%),radial-gradient(circle_at_20%_-20%,rgba(98,129,199,0.2),transparent_45%),var(--color-background)] text-text">
      <section id="workspace" className="mx-auto flex h-full min-w-0 max-w-[1700px] p-3 lg:p-4">
        <ProfileProvider>
          <Tabs.Root
            value={activeTab}
            onValueChange={(value) => {
              onTabChange(value as TabKey);
            }}
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-4"
          >
            <WorkspaceTabsHeader activeTab={activeTab} profilePicker={<WorkspaceProfileDialog />} />
            <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
              <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <SectionLabel className="shrink-0">Gateway status</SectionLabel>
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                  <StatusChip className={isGatewayOnline ? "text-emerald-300" : "text-muted"}>
                    <Dot />
                    {isGatewayOnline ? "Gateway Online" : "Gateway Offline"}
                  </StatusChip>
                  <StatusChip>{`Uptime: ${formatUptime(gateway.status.uptimeMs)}`}</StatusChip>
                </div>
              </Card>
              <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4">
                <TabSection value="control">
                  <ControlTab initialStatus={initialStatus} />
                </TabSection>

                <TabSection value="shell" keepMounted>
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
              </Card>
            </section>
          </Tabs.Root>
        </ProfileProvider>
      </section>
    </main>
  );
}
