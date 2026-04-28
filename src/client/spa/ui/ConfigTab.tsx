import type { ConfigValidationIssue } from "../../../server/types";
import { YamlEditor } from "../../components/YamlEditor";

type ConfigTabProps = {
  path: string;
  updatedAt: string | null;
  content: string;
  issues: ConfigValidationIssue[];
  status: string;
  canSave: boolean;
  onChange: (value: string) => void;
  onReload: () => Promise<void>;
  onSave: () => Promise<void>;
};

export function ConfigTab({
  path,
  updatedAt,
  content,
  issues,
  status,
  canSave,
  onChange,
  onReload,
  onSave,
}: ConfigTabProps) {
  return (
    <section data-tab-panel="config" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-muted">Hermes Config</p>
          <p id="config-path" className="mt-1 text-sm text-text">{path}</p>
          <p id="config-updated-at" className="mt-1 text-xs text-muted">
            {updatedAt ? `Updated ${updatedAt}` : "Not saved yet"}
          </p>
        </div>
        <div className="flex gap-2">
          <button id="config-reload" type="button" className="rounded-full bg-frosted px-3 py-1 text-xs text-text" onClick={() => void onReload()}>
            Reload from disk
          </button>
          <button id="config-save" type="button" className="rounded-full bg-text px-3 py-1 text-xs text-background disabled:opacity-50" disabled={!canSave} onClick={() => void onSave()}>
            Save config
          </button>
        </div>
      </div>
      <YamlEditor value={content} onChange={onChange} />
      <div id="config-status" className="mt-3 shrink-0 text-xs text-muted" role="status" aria-live="polite">
        {status}
      </div>
      <ul id="config-issues" className="mt-2 shrink-0 space-y-1 text-xs text-danger">
        {issues.map((issue) => (
          <li key={`${issue.path ?? "root"}-${issue.message}`}>
            {issue.path ? `${issue.path}: ${issue.message}` : issue.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
