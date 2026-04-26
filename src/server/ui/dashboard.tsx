import { Button } from "@base-ui/react/button";
import type { GatewayStatus } from "../types";
import { WorkspaceTabs } from "./workspace-tabs";

export function Dashboard({ status }: { status: GatewayStatus }) {
  return (
    <main className="h-screen overflow-x-hidden overflow-y-hidden bg-background text-text">
      <section className="mx-auto flex h-full min-w-0 max-w-[1400px] flex-col gap-4 p-4 xl:grid xl:grid-cols-[420px_minmax(0,1fr)] xl:grid-rows-1">
        <aside className="min-w-0 shrink-0 overflow-auto rounded-xl border border-accent-border bg-surface p-5 xl:min-h-0">
          <p className="text-xs uppercase text-muted">Gateway</p>
          <h1 className="mt-2 text-4xl font-medium tracking-[-0.08em]">Hermes Agent</h1>
          <div
            id="gateway-status"
            className="mt-6 text-sm text-muted"
            data-state={status.state}
          >
            State: <span className="text-text">{status.state}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              data-action="start"
              className="rounded-full bg-text px-4 py-2 text-sm text-background"
            >
              Start
            </Button>
            <Button
              data-action="stop"
              className="rounded-full bg-frosted px-4 py-2 text-sm text-text"
            >
              Stop
            </Button>
            <Button
              data-action="restart"
              className="rounded-full bg-frosted px-4 py-2 text-sm text-text"
            >
              Restart
            </Button>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-accent-border bg-surface p-3 xl:min-h-0">
          <div id="workspace-tabs-root" className="flex min-h-0 min-w-0 flex-1 flex-col">
            <WorkspaceTabs />
          </div>
        </section>
      </section>
    </main>
  );
}
