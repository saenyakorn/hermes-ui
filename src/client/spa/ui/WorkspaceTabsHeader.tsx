import { Tabs } from "@base-ui/react";
import type { ReactNode } from "react";
import { Card } from "../../components/Card";
import { cn } from "../../lib/cn";
import type { TabKey } from "../../tabs";
import { SectionLabel } from "../../components/UiPrimitives";

type WorkspaceTabsHeaderProps = {
  activeTab: TabKey;
  profilePicker: ReactNode;
};

export function WorkspaceTabsHeader({ activeTab, profilePicker }: WorkspaceTabsHeaderProps) {
  const tabClass = (tab: TabKey): string =>
    cn(
      "w-full rounded-md border px-3 py-2 text-left text-[15px] transition",
      activeTab === tab
        ? "border-accent/70 bg-accent/20 text-text"
        : "border-transparent text-muted hover:border-accent-border hover:bg-surface",
    );

  return (
    <Tabs.List className="w-full shrink-0 lg:min-h-0 lg:w-[232px]">
      <Card className="flex h-auto min-h-0 flex-col p-4 lg:h-full">
        <div className="border-b border-frosted pb-3">
          <p className="text-[34px]/[1] font-semibold tracking-[-0.03em] text-text">Hermes Agent</p>
          <SectionLabel className="mt-1">AI Gateway Control</SectionLabel>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span>Profile</span>
          <div className="min-w-0 flex-1">{profilePicker}</div>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-1 overflow-auto pr-1 lg:pr-0">
          <Tabs.Tab value="control" data-tab-trigger="control" className={tabClass("control")}>
            Control
          </Tabs.Tab>
          <Tabs.Tab value="shell" data-tab-trigger="shell" className={tabClass("shell")}>
            Interactive shell
          </Tabs.Tab>
          <Tabs.Tab value="config" data-tab-trigger="config" className={tabClass("config")}>
            Hermes config
          </Tabs.Tab>
          <Tabs.Tab value="env" data-tab-trigger="env" className={tabClass("env")}>
            Env vars
          </Tabs.Tab>
          <SectionLabel className="mb-1 mt-3">Infrastructure</SectionLabel>
          <Tabs.Tab
            value="messaging"
            data-tab-trigger="messaging"
            className={tabClass("messaging")}
          >
            Messaging Platform
          </Tabs.Tab>
          <Tabs.Tab
            value="model-providers"
            data-tab-trigger="model-providers"
            className={tabClass("model-providers")}
          >
            Model providers
          </Tabs.Tab>
          <Tabs.Tab value="profiles" data-tab-trigger="profiles" className={tabClass("profiles")}>
            Profiles
          </Tabs.Tab>
          <Tabs.Tab value="sessions" data-tab-trigger="sessions" className={tabClass("sessions")}>
            Sessions
          </Tabs.Tab>
        </div>
      </Card>
    </Tabs.List>
  );
}
