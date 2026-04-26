import { Button } from "@base-ui/react/button";
import type { GatewayStatus } from "../types";
import { WorkspaceTabs } from "./workspace-tabs";

export function Dashboard({ status }: { status: GatewayStatus }) {
  return (
    <main className="min-h-screen bg-background text-text">
      <section className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-4 px-4 py-4 xl:grid xl:min-h-screen xl:grid-cols-[420px_1fr] xl:grid-rows-1">
        <aside className="shrink-0 rounded-xl border border-accent-border bg-surface p-5 xl:min-h-0">
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

        <section className="flex min-h-0 min-h-[min(560px,calc(100vh-8rem))] flex-1 flex-col rounded-xl border border-accent-border bg-surface p-3 xl:min-h-0">
          <div id="workspace-tabs-root" className="flex min-h-0 flex-1 flex-col">
            <WorkspaceTabs />
          </div>
        </section>
      </section>
    </main>
  );
}
