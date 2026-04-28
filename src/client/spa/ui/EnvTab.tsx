import type { EnvReadResult } from "../../../server/types";

type EnvTabProps = {
  path: string;
  updatedAt: string | null;
  entries: EnvReadResult["entries"];
  keyValue: string;
  valueValue: string;
  status: string;
  canMutate: boolean;
  onKeyChange: (value: string) => void;
  onValueChange: (value: string) => void;
  onSelectKey: (value: string) => void;
  onReload: () => Promise<void>;
  onSave: () => Promise<void>;
  onRemove: () => Promise<void>;
};

export function EnvTab({
  path,
  updatedAt,
  entries,
  keyValue,
  valueValue,
  status,
  canMutate,
  onKeyChange,
  onValueChange,
  onSelectKey,
  onReload,
  onSave,
  onRemove,
}: EnvTabProps) {
  return (
    <section data-tab-panel="env" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-muted">Environment Variables</p>
          <p id="env-path" className="mt-1 text-sm text-text">{path}</p>
          <p id="env-updated-at" className="mt-1 text-xs text-muted">
            {updatedAt ? `Updated ${updatedAt}` : "Not saved yet"}
          </p>
        </div>
        <button id="env-reload" type="button" className="rounded-full bg-frosted px-3 py-1 text-xs text-text" onClick={() => void onReload()}>
          Reload
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
        <select
          id="env-list"
          size={12}
          className="min-h-[280px] w-full rounded-lg border border-frosted bg-background p-2 text-xs text-text"
          value={entries.some((entry) => entry.key === keyValue) ? keyValue : ""}
          onChange={(event) => onSelectKey(event.target.value)}
        >
          {entries.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {`${entry.key}=${entry.maskedValue}`}
            </option>
          ))}
        </select>
        <div className="flex min-h-0 flex-col gap-2 rounded-lg border border-frosted bg-background p-3">
          <label className="text-xs text-muted" htmlFor="env-key-input">Key</label>
          <input
            id="env-key-input"
            type="text"
            placeholder="OPENAI_API_KEY"
            className="rounded-md border border-frosted bg-surface px-2 py-1 text-xs text-text outline-none"
            value={keyValue}
            onChange={(event) => onKeyChange(event.target.value)}
          />
          <label className="mt-2 text-xs text-muted" htmlFor="env-value-input">Value</label>
          <input
            id="env-value-input"
            type="password"
            placeholder="Enter value"
            className="rounded-md border border-frosted bg-surface px-2 py-1 text-xs text-text outline-none"
            value={valueValue}
            onChange={(event) => onValueChange(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button id="env-save" type="button" className="rounded-full bg-text px-3 py-1 text-xs text-background" disabled={!canMutate} onClick={() => void onSave()}>
              Add / Update
            </button>
            <button id="env-remove" type="button" className="rounded-full bg-frosted px-3 py-1 text-xs text-text" disabled={!canMutate} onClick={() => void onRemove()}>
              Remove
            </button>
          </div>
        </div>
      </div>
      <p id="env-status" className="mt-3 shrink-0 text-xs text-muted" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
