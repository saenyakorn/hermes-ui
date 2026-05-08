import { Tabs } from "@base-ui/react";
import { useCallback, useMemo, useState } from "react";
import { Toaster } from "../lib/sonner";
import type { GatewaysSummary } from "../../server/types";
import { Card } from "../components/Card";
import { dispatchProfilesTabShown, dispatchSessionsTabShown } from "../lib/event";
import type { TabKey } from "../tabs";
import { ProfileProvider, useProfileWorkspace } from "./profile-context";
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
import { WorkspaceProfileProvider, useWorkspaceProfile } from "./workspace-profile";
import { WorkspaceTabsHeader } from "./ui/WorkspaceTabsHeader";
import { Dot, SectionLabel, StatusChip } from "../components/UiPrimitives";

type AppProps = {
  initialGateways: GatewaysSummary;
  initialLegacyActive: string | null;
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

export function App({ initialGateways, initialLegacyActive }: AppProps) {
  return (
    <WorkspaceProfileProvider initialProfile={initialLegacyActive}>
      <ProfileProvider initialGateways={initialGateways}>
        <WorkspaceContent initialGateways={initialGateways} />
      </ProfileProvider>
    </WorkspaceProfileProvider>
  );
}

type WorkspaceContentProps = {
  initialGateways: GatewaysSummary;
};

function WorkspaceContent({ initialGateways }: WorkspaceContentProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(() => readInitialTab());
  const workspaceProfile = useWorkspaceProfile();
  const profilesApi = useProfileWorkspace();

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

  const summaryEntries = useMemo(
    () => Object.values(profilesApi.gatewaySummaries),
    [profilesApi.gatewaySummaries],
  );
  const totalGateways = summaryEntries.length;
  const runningGateways = summaryEntries.filter(
    (entry) => entry.status.state === "running",
  ).length;
  const summaryLabel =
    totalGateways === 0
      ? "Gateways: -"
      : `Gateways: ${runningGateways}/${totalGateways} running`;
  const summaryChipClass =
    runningGateways > 0 ? "text-emerald-300" : totalGateways > 0 ? "text-muted" : "text-muted";
  const currentProfileLabel = workspaceProfile.profile ?? "default";

  return (
    <main className="h-screen overflow-y-auto bg-[radial-gradient(circle_at_85%_-10%,rgba(0,122,255,0.16),transparent_38%),radial-gradient(circle_at_20%_-20%,rgba(98,129,199,0.2),transparent_45%),var(--color-background)] text-text">
      <Toaster richColors position="top-right" />
      <section id="workspace" className="mx-auto flex h-full min-w-0 max-w-[1700px] p-3 lg:p-4">
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
              <SectionLabel className="shrink-0">Gateway summary</SectionLabel>
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <button
                  type="button"
                  onClick={() => onTabChange("profiles")}
                  className="cursor-pointer outline-none focus:ring-2 focus:ring-accent/50 rounded-full"
                  aria-label="Open profiles tab"
                >
                  <StatusChip className={summaryChipClass}>
                    <Dot />
                    {summaryLabel}
                  </StatusChip>
                </button>
                <StatusChip>{`Viewing: ${currentProfileLabel}`}</StatusChip>
              </div>
            </Card>
            <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4">
              <TabSection value="control">
                <ControlTab initialGateways={initialGateways} />
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
      </section>
    </main>
  );
}
