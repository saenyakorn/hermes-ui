import { Tabs } from "@base-ui/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { TabKey } from "../../tabs";

type WorkspaceTabsHeaderProps = {
  activeTab: TabKey;
  profilePicker: ReactNode;
};

export function WorkspaceTabsHeader({ activeTab, profilePicker }: WorkspaceTabsHeaderProps) {
  const tabClass = (tab: TabKey): string =>
    cn("rounded-full px-4 py-2 text-sm", activeTab === tab ? "bg-frosted text-text" : "text-muted");

  return (
    <Tabs.List className="mb-3 flex shrink-0 flex-wrap items-center gap-2 border-b border-frosted pb-3">
      <div className="flex items-center gap-2 text-xs text-muted">
        Profile
        {profilePicker}
      </div>
      <span className="mx-1 h-5 w-px bg-frosted" aria-hidden="true" />
      <Tabs.Tab value="control" data-tab-trigger="control" className={tabClass("control")}>
        Control
      </Tabs.Tab>
      <Tabs.Tab value="logs" data-tab-trigger="logs" className={tabClass("logs")}>
        Live log
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
      <Tabs.Tab value="messaging" data-tab-trigger="messaging" className={tabClass("messaging")}>
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
    </Tabs.List>
  );
}
