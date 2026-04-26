import { Tabs } from "@base-ui/react/tabs";
import type { GatewayStatus } from "../api";
import { ConfigTab } from "../tabs/config-tab";
import { LogsTab } from "../tabs/logs-tab";
import { ShellTab } from "../tabs/shell-tab";

const tabClass =
  "rounded-full px-4 py-2 text-sm text-muted outline-none transition-colors hover:text-text data-[active]:bg-frosted data-[active]:text-text";

export function WorkspaceTabs({
  onGatewayRefresh,
  onGatewayStatus,
}: {
  onGatewayRefresh: () => Promise<void>;
  onGatewayStatus: (status: GatewayStatus) => void;
}) {
  return (
    <Tabs.Root defaultValue="logs" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Tabs.List className="mb-3 flex shrink-0 gap-2 overflow-x-auto border-b border-frosted pb-3">
        <Tabs.Tab value="logs" className={tabClass}>
          Live log
        </Tabs.Tab>
        <Tabs.Tab value="shell" className={tabClass}>
          Interactive shell
        </Tabs.Tab>
        <Tabs.Tab value="config" className={tabClass}>
          Hermes config
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel
        value="logs"
        keepMounted
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <LogsTab />
      </Tabs.Panel>

      <Tabs.Panel
        value="shell"
        keepMounted
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <ShellTab />
      </Tabs.Panel>

      <Tabs.Panel
        value="config"
        keepMounted
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <ConfigTab
          onGatewayStatus={(status) => {
            onGatewayStatus(status);
            void onGatewayRefresh();
          }}
        />
      </Tabs.Panel>
    </Tabs.Root>
  );
}
