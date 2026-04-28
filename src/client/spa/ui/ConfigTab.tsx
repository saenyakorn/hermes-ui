import type { ConfigValidationIssue } from "../../../server/types";
import { YamlEditor } from "../../components/YamlEditor";
import { useConfigTab } from "../../hooks/useConfigTab";

export function ConfigTab() {
  const config = useConfigTab();

  return (
    <section
      data-tab-panel="config"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-muted">Hermes Config</p>
          <p id="config-path" className="mt-1 text-sm text-text">
            {config.path}
          </p>
          <p id="config-updated-at" className="mt-1 text-xs text-muted">
            {config.updatedAt ? `Updated ${config.updatedAt}` : "Not saved yet"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            id="config-reload"
            type="button"
            className="rounded-full bg-frosted px-3 py-1 text-xs text-text"
            onClick={() => void config.reload()}
          >
            Reload from disk
          </button>
          <button
            id="config-save"
            type="button"
            className="rounded-full bg-text px-3 py-1 text-xs text-background disabled:opacity-50"
            disabled={!config.canSave}
            onClick={() => void config.save()}
          >
            Save config
          </button>
        </div>
      </div>
      <YamlEditor value={config.content} onChange={config.onChange} />
      <div
        id="config-status"
        className="mt-3 shrink-0 text-xs text-muted"
        role="status"
        aria-live="polite"
      >
        {config.status}
      </div>
      <ul id="config-issues" className="mt-2 shrink-0 space-y-1 text-xs text-danger">
        {config.issues.map((issue: ConfigValidationIssue) => (
          <li key={`${issue.path ?? "root"}-${issue.message}`}>
            {issue.path ? `${issue.path}: ${issue.message}` : issue.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
