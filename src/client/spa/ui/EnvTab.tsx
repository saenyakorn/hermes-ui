import type { EnvReadResult } from "../../../server/types";
import { useEnvTab } from "../../hooks/useEnvTab";

export function EnvTab() {
  const env = useEnvTab();

  return (
    <section data-tab-panel="env" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-muted">Environment Variables</p>
          <p id="env-path" className="mt-1 text-sm text-text">
            {env.path}
          </p>
          <p id="env-updated-at" className="mt-1 text-xs text-muted">
            {env.updatedAt ? `Updated ${env.updatedAt}` : "Not saved yet"}
          </p>
        </div>
        <button
          id="env-reload"
          type="button"
          className="rounded-full bg-frosted px-3 py-1 text-xs text-text"
          onClick={() => void env.reload()}
        >
          Reload
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
        <select
          id="env-list"
          size={12}
          className="min-h-[280px] w-full rounded-lg border border-frosted bg-background p-2 text-xs text-text"
          value={env.entries.some((entry) => entry.key === env.key) ? env.key : ""}
          onChange={(event) => env.setSelectedKey(event.target.value)}
        >
          {env.entries.map((entry: EnvReadResult["entries"][number]) => (
            <option key={entry.key} value={entry.key}>
              {`${entry.key}=${entry.maskedValue}`}
            </option>
          ))}
        </select>
        <div className="flex min-h-0 flex-col gap-2 rounded-lg border border-frosted bg-background p-3">
          <label className="text-xs text-muted" htmlFor="env-key-input">
            Key
          </label>
          <input
            id="env-key-input"
            type="text"
            placeholder="OPENAI_API_KEY"
            className="rounded-md border border-frosted bg-surface px-2 py-1 text-xs text-text outline-none"
            value={env.key}
            onChange={(event) => env.setKey(event.target.value)}
          />
          <label className="mt-2 text-xs text-muted" htmlFor="env-value-input">
            Value
          </label>
          <input
            id="env-value-input"
            type="password"
            placeholder="Enter value"
            className="rounded-md border border-frosted bg-surface px-2 py-1 text-xs text-text outline-none"
            value={env.value}
            onChange={(event) => env.setValue(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              id="env-save"
              type="button"
              className="rounded-full bg-text px-3 py-1 text-xs text-background"
              disabled={!env.canMutate}
              onClick={() => void env.upsert()}
            >
              Add / Update
            </button>
            <button
              id="env-remove"
              type="button"
              className="rounded-full bg-frosted px-3 py-1 text-xs text-text"
              disabled={!env.canMutate}
              onClick={() => void env.remove()}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
      <p
        id="env-status"
        className="mt-3 shrink-0 text-xs text-muted"
        role="status"
        aria-live="polite"
      >
        {env.status}
      </p>
    </section>
  );
}
