import type { GatewayStatus } from "../../../server/types";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { useGatewayStatus } from "../../hooks/useGatewayStatus";
import { useLogs } from "../../hooks/useLogs";
import { SectionLabel, StatusChip } from "../../components/UiPrimitives";

type ControlTabProps = {
  initialStatus: GatewayStatus;
};

export function ControlTab({ initialStatus }: ControlTabProps) {
  const gateway = useGatewayStatus(initialStatus);
  const logs = useLogs();
  const isOnline = gateway.status.state.toLowerCase() === "running";

  return (
    <section id="gateway-panel" data-tab-panel="control" className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-auto">
      <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Process information</SectionLabel>
            <StatusChip className={isOnline ? "text-emerald-300" : "text-muted"}>
              {isOnline ? "Live" : "Idle"}
            </StatusChip>
          </div>
          <div id="gateway-status" data-state={gateway.status.state} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-frosted bg-background p-3">
              <p className="text-[11px] uppercase text-muted">State</p>
              <p className="mt-2 text-xl font-semibold text-text">{gateway.status.state}</p>
            </div>
            <div className="rounded-lg border border-frosted bg-background p-3">
              <p className="text-[11px] uppercase text-muted">Health</p>
              <p className="mt-2 text-xl font-semibold text-text">{gateway.status.health}</p>
            </div>
            <div className="rounded-lg border border-frosted bg-background p-3">
              <p className="text-[11px] uppercase text-muted">PID</p>
              <p className="mt-2 text-xl font-semibold text-text">{gateway.status.pid ?? "-"}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-frosted bg-background p-3">
              <p className="text-[11px] uppercase text-muted">Current working directory</p>
              <p className="mt-2 text-xs text-text">{gateway.status.cwd}</p>
            </div>
            <div className="rounded-lg border border-frosted bg-background p-3">
              <p className="text-[11px] uppercase text-muted">Last error</p>
              <p className="mt-2 text-xs text-text">{gateway.status.lastError ?? "-"}</p>
            </div>
          </div>
          <p id="gateway-error" className={`mt-3 text-xs text-danger ${gateway.error ? "" : "hidden"}`}>
            {gateway.error ?? ""}
          </p>
        </Card>
        <Card className="h-fit p-4">
          <p className="text-xs uppercase tracking-[0.15em] text-muted">System controls</p>
          <div className="mt-3 flex flex-col gap-2">
            <Button id="start-button" variant="secondary" size="md" disabled={gateway.busy} onClick={() => void gateway.start()}>
              Start
            </Button>
            <Button id="stop-button" variant="danger" size="md" disabled={gateway.busy} onClick={() => void gateway.stop()}>
              Stop
            </Button>
            <Button id="restart-button" variant="primary" size="md" disabled={gateway.busy} onClick={() => void gateway.restart()}>
              Restart
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-muted">Note: active sessions terminate during restart.</p>
        </Card>
      </div>
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>Recent system activity</SectionLabel>
          <Button type="button" variant="ghost" className="px-0 py-0 text-xs">View all logs</Button>
        </div>
        <div className="space-y-2 rounded-lg border border-frosted bg-background p-3 font-mono text-xs text-muted">
          <p>[INFO] Heartbeat received from node us-east-gateway-01. Response time 12ms.</p>
          <p>[SYS] Hermes core configuration reloaded successfully.</p>
          <p>[INFO] Agent session initialized. Model GPT-4-Turbo.</p>
          <p>[WARN] Token threshold approaching for profile default.</p>
        </div>
      </Card>
      <section className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden">
        <Card className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-text">Live Log Streaming</p>
              <p className="text-xs text-muted">Real-time system orchestration and agent trace.</p>
            </div>
            <StatusChip>Streaming</StatusChip>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary">Autoscroll</Button>
            <Button type="button" variant="secondary">Wrap lines</Button>
            <Button type="button" variant="secondary">Clear logs</Button>
            <Button type="button" variant="primary">Export session</Button>
          </div>
          <pre
            id="log-lines"
            className="min-h-0 flex-1 overflow-auto rounded-lg border border-frosted bg-background p-3 text-xs text-muted"
          >
            {logs.lines}
          </pre>
          <p id="log-error" className={`mt-2 shrink-0 text-xs text-danger ${logs.error ? "" : "hidden"}`}>
            {logs.error ?? ""}
          </p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
            <span>Lines: 1,848 • Errors: 1 • Memory: 244MB</span>
            <span>Region: US-EAST-1</span>
          </div>
        </Card>
        <Card className="hidden w-[280px] shrink-0 p-4 xl:block">
          <SectionLabel>Log metadata</SectionLabel>
          <div className="mt-3 space-y-2 text-xs text-muted">
            <div className="rounded-lg border border-frosted bg-background p-2">
              <p className="text-[10px] uppercase">Source agent</p>
              <p className="mt-1 text-text">hermes-worker-v4-029</p>
            </div>
            <div className="rounded-lg border border-frosted bg-background p-2">
              <p className="text-[10px] uppercase">Trace id</p>
              <p className="mt-1 break-all text-text">550e8400-e29b-41d4-a716-446655440000</p>
            </div>
            <div className="rounded-lg border border-frosted bg-background p-2">
              <p className="text-[10px] uppercase">Execution payload</p>
              <p className="mt-1 break-all text-text">{`{"action":"router-failover","priority":"critical"}`}</p>
            </div>
          </div>
        </Card>
      </section>
    </section>
  );
}
