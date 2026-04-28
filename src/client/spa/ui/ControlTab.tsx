import type { GatewayStatus } from "../../../server/types";

type ControlTabProps = {
  status: GatewayStatus;
  error: string | null;
  busy: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onRestart: () => Promise<void>;
};

export function ControlTab({ status, error, busy, onStart, onStop, onRestart }: ControlTabProps) {
  return (
    <section id="gateway-panel" data-tab-panel="control" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex min-h-full w-full flex-1 flex-col items-center justify-center p-2">
        <p className="text-center text-xs uppercase text-muted">Gateway</p>
        <h1 className="mt-2 text-center text-4xl font-medium tracking-[-0.08em]">Hermes Agent</h1>
        <div className="mt-6 text-center text-sm text-muted" id="gateway-status" data-state={status.state}>
          <div>{`State: ${status.state}`}</div>
          <div>{`Health: ${status.health}`}</div>
          <div>{`PID: ${status.pid ?? "-"}`}</div>
          <div>{`CWD: ${status.cwd}`}</div>
          <div>{`Last error: ${status.lastError ?? "-"}`}</div>
        </div>
        <p id="gateway-error" className={`mt-2 text-center text-xs text-danger ${error ? "" : "hidden"}`}>
          {error ?? ""}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button id="start-button" className="rounded-full bg-text px-4 py-2 text-sm text-background" disabled={busy} onClick={() => void onStart()}>
            Start
          </button>
          <button id="stop-button" className="rounded-full bg-frosted px-4 py-2 text-sm text-text" disabled={busy} onClick={() => void onStop()}>
            Stop
          </button>
          <button id="restart-button" className="rounded-full bg-frosted px-4 py-2 text-sm text-text" disabled={busy} onClick={() => void onRestart()}>
            Restart
          </button>
        </div>
      </div>
    </section>
  );
}
