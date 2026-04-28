import type { GatewayStatus } from "../../../server/types";
import { useGatewayStatus } from "../../hooks/useGatewayStatus";

type ControlTabProps = {
  initialStatus: GatewayStatus;
};

export function ControlTab({ initialStatus }: ControlTabProps) {
  const gateway = useGatewayStatus(initialStatus);

  return (
    <section
      id="gateway-panel"
      data-tab-panel="control"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"
    >
      <div className="flex min-h-full w-full flex-1 flex-col items-center justify-center p-2">
        <p className="text-center text-xs uppercase text-muted">Gateway</p>
        <h1 className="mt-2 text-center text-4xl font-medium tracking-[-0.08em]">Hermes Agent</h1>
        <div
          className="mt-6 text-center text-sm text-muted"
          id="gateway-status"
          data-state={gateway.status.state}
        >
          <div>{`State: ${gateway.status.state}`}</div>
          <div>{`Health: ${gateway.status.health}`}</div>
          <div>{`PID: ${gateway.status.pid ?? "-"}`}</div>
          <div>{`CWD: ${gateway.status.cwd}`}</div>
          <div>{`Last error: ${gateway.status.lastError ?? "-"}`}</div>
        </div>
        <p
          id="gateway-error"
          className={`mt-2 text-center text-xs text-danger ${gateway.error ? "" : "hidden"}`}
        >
          {gateway.error ?? ""}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            id="start-button"
            className="rounded-full bg-text px-4 py-2 text-sm text-background"
            disabled={gateway.busy}
            onClick={() => void gateway.start()}
          >
            Start
          </button>
          <button
            id="stop-button"
            className="rounded-full bg-frosted px-4 py-2 text-sm text-text"
            disabled={gateway.busy}
            onClick={() => void gateway.stop()}
          >
            Stop
          </button>
          <button
            id="restart-button"
            className="rounded-full bg-frosted px-4 py-2 text-sm text-text"
            disabled={gateway.busy}
            onClick={() => void gateway.restart()}
          >
            Restart
          </button>
        </div>
      </div>
    </section>
  );
}
