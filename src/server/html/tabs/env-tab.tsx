/** @jsxImportSource hono/jsx */

export function EnvTabPanel() {
  return (
    <section
      data-tab-panel="env"
      hidden
      class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div class="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase text-muted">Environment Variables</p>
          <p id="env-path" class="mt-1 text-sm text-text">
            data/.env
          </p>
          <p id="env-updated-at" class="mt-1 text-xs text-muted">
            Loading env...
          </p>
        </div>
        <button
          id="env-reload"
          type="button"
          class="rounded-full bg-frosted px-3 py-1 text-xs text-text"
        >
          Reload
        </button>
      </div>
      <div class="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
        <select
          id="env-list"
          size={12}
          class="min-h-[280px] w-full rounded-lg border border-frosted bg-background p-2 text-xs text-text"
        />
        <div class="flex min-h-0 flex-col gap-2 rounded-lg border border-frosted bg-background p-3">
          <label class="text-xs text-muted" for="env-key-input">
            Key
          </label>
          <input
            id="env-key-input"
            type="text"
            placeholder="OPENAI_API_KEY"
            class="rounded-md border border-frosted bg-surface px-2 py-1 text-xs text-text outline-none"
          />
          <label class="mt-2 text-xs text-muted" for="env-value-input">
            Value
          </label>
          <input
            id="env-value-input"
            type="password"
            placeholder="Enter value"
            class="rounded-md border border-frosted bg-surface px-2 py-1 text-xs text-text outline-none"
          />
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              id="env-save"
              type="button"
              class="rounded-full bg-text px-3 py-1 text-xs text-background"
            >
              Add / Update
            </button>
            <button
              id="env-remove"
              type="button"
              class="rounded-full bg-frosted px-3 py-1 text-xs text-text"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
      <p
        id="env-status"
        class="mt-3 shrink-0 text-xs text-muted"
        role="status"
        aria-live="polite"
      >
        Waiting for env editor...
      </p>
    </section>
  );
}
