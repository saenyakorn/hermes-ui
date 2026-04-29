import type { GatewayStatus } from "../../../server/types";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { useGatewayStatus } from "../../hooks/useGatewayStatus";
import { useLogs } from "../../hooks/useLogs";
import { useProfileWorkspace } from "../profile-context";
import { SectionLabel, StatusChip } from "../../components/UiPrimitives";

type ControlTabProps = {
  initialStatus: GatewayStatus;
};

export function ControlTab({ initialStatus }: ControlTabProps) {
  const profile = useProfileWorkspace();
  const gateway = useGatewayStatus(initialStatus, profile.activeProfile);
  const logs = useLogs();
  const isOnline = gateway.status.state.toLowerCase() === "running";
  const logLines = logs.lines
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const recentActivity = logLines.slice(-4).reverse();
  const errorLineCount = logLines.filter((line) => line.toLowerCase().includes("error")).length;

  return (
    <section
      id="gateway-panel"
      data-tab-panel="control"
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto pb-2"
    >
      <div className="grid min-h-0 shrink-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Process information</SectionLabel>
            <StatusChip className={isOnline ? "text-emerald-300" : "text-muted"}>
              {isOnline ? "Live" : "Idle"}
            </StatusChip>
          </div>
          <div
            id="gateway-status"
            data-state={gateway.status.state}
            className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3"
          >
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
          <p
            id="gateway-error"
            className={`mt-3 text-xs text-danger ${gateway.error ? "" : "hidden"}`}
          >
            {gateway.error ?? ""}
          </p>
        </Card>
        <Card className="h-fit p-4">
          <p className="text-xs uppercase tracking-[0.15em] text-muted">System controls</p>
          <div className="mt-3 flex flex-row gap-2">
            <Button
              id="start-button"
              variant="secondary"
              size="md"
              disabled={gateway.busy}
              onClick={() => void gateway.start()}
            >
              Start
            </Button>
            <Button
              id="stop-button"
              variant="danger"
              size="md"
              disabled={gateway.busy}
              onClick={() => void gateway.stop()}
            >
              Stop
            </Button>
            <Button
              id="restart-button"
              variant="primary"
              size="md"
              disabled={gateway.busy}
              onClick={() => void gateway.restart()}
            >
              Restart
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Note: active sessions terminate during restart.
          </p>
        </Card>
      </div>
      <Card className="shrink-0 p-4">
        <div className="mb-2">
          <SectionLabel>Recent system activity</SectionLabel>
        </div>
        <div className="space-y-2 rounded-lg border border-frosted bg-background p-3 font-mono text-xs text-muted">
          {recentActivity.length > 0 ? (
            recentActivity.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)
          ) : (
            <p>No activity yet. Start the gateway to stream logs.</p>
          )}
        </div>
      </Card>
      <section className="flex min-h-[1200px] min-w-0 shrink-0 gap-3 overflow-hidden">
        <Card className="flex min-h-[1200px] min-w-0 flex-1 flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-text">Live Log Streaming</p>
              <p className="text-xs text-muted">Real-time system orchestration and agent trace.</p>
            </div>
            <StatusChip>Streaming</StatusChip>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary">
              Autoscroll
            </Button>
            <Button type="button" variant="secondary">
              Wrap lines
            </Button>
            <Button type="button" variant="secondary">
              Clear logs
            </Button>
            <Button type="button" variant="primary">
              Export session
            </Button>
          </div>
          <pre
            id="log-lines"
            className="min-h-[220px] flex-1 overflow-auto rounded-lg border border-frosted bg-background p-3 text-xs text-muted"
          >
            {logs.lines}
          </pre>
          <p
            id="log-error"
            className={`mt-2 shrink-0 text-xs text-danger ${logs.error ? "" : "hidden"}`}
          >
            {logs.error ?? ""}
          </p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
            <span>{`Lines: ${logLines.length} • Errors: ${errorLineCount}`}</span>
          </div>
        </Card>
        <Card className="hidden w-[280px] shrink-0 p-4 xl:block">
          <SectionLabel>Log metadata</SectionLabel>
          <div className="mt-3 space-y-2 text-xs text-muted">
            <div className="rounded-lg border border-frosted bg-background p-2">
              <p className="text-[10px] uppercase">Stream source</p>
              <p className="mt-1 text-text">Live log tail</p>
            </div>
            <div className="rounded-lg border border-frosted bg-background p-2">
              <p className="text-[10px] uppercase">Gateway state</p>
              <p className="mt-1 break-all text-text">{gateway.status.state}</p>
            </div>
            <div className="rounded-lg border border-frosted bg-background p-2">
              <p className="text-[10px] uppercase">Last fetch status</p>
              <p className="mt-1 break-all text-text">{logs.error ? "Warning" : "Healthy"}</p>
            </div>
          </div>
        </Card>
      </section>
    </section>
  );
}
