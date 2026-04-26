import { useLogTail } from "../hooks/use-log-tail";

export function LogsTab() {
  const { logs, error } = useLogTail();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <p className="mb-2 shrink-0 text-xs uppercase text-muted">
        Gateway log ASDSADA
      </p>
      <pre className="min-h-0 flex-1 overflow-auto rounded-lg bg-background p-3 text-xs text-muted">
        {logs.lines.join("\n")}
      </pre>
      {(error ?? logs.warning) && (
        <p className="mt-2 shrink-0 text-xs text-danger">
          {error ?? logs.warning}
        </p>
      )}
    </div>
  );
}
