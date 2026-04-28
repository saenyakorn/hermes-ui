import { useLogs } from "../../hooks/useLogs";

export function LogsTab() {
  const logs = useLogs();

  return (
    <section data-tab-panel="logs" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <p className="mb-2 shrink-0 text-xs uppercase text-muted">Gateway log</p>
      <pre
        id="log-lines"
        className="min-h-0 flex-1 overflow-auto rounded-lg bg-background p-3 text-xs text-muted"
      >
        {logs.lines}
      </pre>
      <p
        id="log-error"
        className={`mt-2 shrink-0 text-xs text-danger ${logs.error ? "" : "hidden"}`}
      >
        {logs.error ?? ""}
      </p>
    </section>
  );
}
