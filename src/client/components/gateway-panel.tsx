import { Button } from "@base-ui/react/button";
import type { GatewayStatus } from "../api";

function createStatusRow(label: string, value: string) {
  return (
    <div>
      {label}: <span className="text-text">{value}</span>
    </div>
  );
}

export function GatewayPanel({
  status,
  error,
  busyAction,
  onAction,
}: {
  status: GatewayStatus;
  error: string | null;
  busyAction: "start" | "stop" | "restart" | null;
  onAction: (action: "start" | "stop" | "restart") => Promise<void>;
}) {
  return (
    <aside className="min-w-0 shrink-0 overflow-auto rounded-xl border border-accent-border bg-surface p-5 xl:min-h-0">
      <p className="text-xs uppercase text-muted">Gateway</p>
      <h1 className="mt-2 text-4xl font-medium tracking-[-0.08em]">Hermes Agent</h1>
      <div className="mt-6 text-sm text-muted" data-state={status.state}>
        {createStatusRow("State", status.state)}
        {createStatusRow("Health", status.health)}
        {createStatusRow("PID", status.pid?.toString() ?? "-")}
        {createStatusRow("CWD", status.cwd)}
        {createStatusRow("Last error", status.lastError ?? "-")}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button
          disabled={busyAction !== null}
          onClick={() => {
            void onAction("start");
          }}
          className="rounded-full bg-text px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          Start
        </Button>
        <Button
          disabled={busyAction !== null}
          onClick={() => {
            void onAction("stop");
          }}
          className="rounded-full bg-frosted px-4 py-2 text-sm text-text disabled:opacity-50"
        >
          Stop
        </Button>
        <Button
          disabled={busyAction !== null}
          onClick={() => {
            void onAction("restart");
          }}
          className="rounded-full bg-frosted px-4 py-2 text-sm text-text disabled:opacity-50"
        >
          Restart
        </Button>
      </div>
    </aside>
  );
}
