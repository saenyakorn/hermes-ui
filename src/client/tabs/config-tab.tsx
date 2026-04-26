import { Button } from "@base-ui/react/button";
import type { GatewayStatus } from "../api";
import { useConfigEditor } from "../hooks/use-config-editor";

export function ConfigTab({
  onGatewayStatus,
}: {
  onGatewayStatus: (status: GatewayStatus) => void;
}) {
  const {
    containerRef,
    path,
    updatedAt,
    status,
    issues,
    isSaveEnabled,
    reloadConfigWithConfirmation,
    saveConfig,
  } = useConfigEditor(onGatewayStatus);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-muted">Hermes Config</p>
          <p className="mt-1 text-sm text-text">{path}</p>
          <p className="mt-1 text-xs text-muted">{updatedAt}</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              void reloadConfigWithConfirmation();
            }}
            className="rounded-full bg-frosted px-3 py-1 text-xs text-text"
          >
            Reload from disk
          </Button>
          <Button
            disabled={!isSaveEnabled}
            onClick={() => {
              void saveConfig();
            }}
            className="rounded-full bg-text px-3 py-1 text-xs text-background disabled:opacity-50"
          >
            Save config
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="min-h-[280px] flex-1 overflow-hidden rounded-lg border border-frosted bg-background"
      />
      <div className="mt-3 shrink-0 text-xs text-muted" role="status" aria-live="polite">
        {status}
      </div>
      {issues.length > 0 && (
        <ul className="mt-2 shrink-0 space-y-1 text-xs text-danger" role="alert">
          {issues.map((issue, index) => {
            const text = issue.path ? `${issue.path}: ${issue.message}` : issue.message;
            return <li key={`${text}-${index}`}>{text}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
