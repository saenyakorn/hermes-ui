import type { GatewayStatus } from "../api";
import { useGatewayStatus } from "../hooks/use-gateway-status";
import { GatewayPanel } from "./gateway-panel";
import { WorkspaceTabs } from "./workspace-tabs";

export function App({ initialStatus }: { initialStatus: GatewayStatus }) {
  const { status, error, busyAction, runAction, refresh, applyStatus } = useGatewayStatus(initialStatus);

  return (
    <section className="mx-auto flex h-full min-w-0 max-w-[1400px] flex-col gap-4 p-4 xl:grid xl:grid-cols-[420px_minmax(0,1fr)] xl:grid-rows-1">
      <GatewayPanel status={status} error={error} busyAction={busyAction} onAction={runAction} />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-accent-border bg-surface p-3 xl:min-h-0">
        <WorkspaceTabs onGatewayRefresh={refresh} onGatewayStatus={applyStatus} />
      </section>
    </section>
  );
}
