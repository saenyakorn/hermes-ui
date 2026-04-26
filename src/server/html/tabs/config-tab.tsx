/** @jsxImportSource hono/jsx */

export function ConfigTabPanel() {
  return (
    <section
      data-tab-panel="config"
      hidden
      class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div class="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase text-muted">Hermes Config</p>
          <p id="config-path" class="mt-1 text-sm text-text">
            data/config.yaml
          </p>
          <p id="config-updated-at" class="mt-1 text-xs text-muted">
            Loading config...
          </p>
        </div>
        <div class="flex gap-2">
          <button
            id="config-reload"
            type="button"
            class="rounded-full bg-frosted px-3 py-1 text-xs text-text"
          >
            Reload from disk
          </button>
          <button
            id="config-save"
            type="button"
            class="rounded-full bg-text px-3 py-1 text-xs text-background disabled:opacity-50"
            disabled
          >
            Save config
          </button>
        </div>
      </div>
      <div
        id="config-editor"
        class="min-h-[280px] flex-1 overflow-hidden rounded-lg border border-frosted bg-background"
      />
      <div
        id="config-status"
        class="mt-3 shrink-0 text-xs text-muted"
        role="status"
        aria-live="polite"
      >
        Waiting for editor...
      </div>
      <ul id="config-issues" class="mt-2 shrink-0 space-y-1 text-xs text-danger" />
    </section>
  );
}
