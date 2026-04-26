/** @jsxImportSource hono/jsx */

export function LogsTabPanel() {
  return (
    <section
      data-tab-panel="logs"
      hidden
      class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <p class="mb-2 shrink-0 text-xs uppercase text-muted">Gateway log</p>
      <pre
        id="log-lines"
        class="min-h-0 flex-1 overflow-auto rounded-lg bg-background p-3 text-xs text-muted"
      />
      <p id="log-error" class="mt-2 shrink-0 text-xs text-danger hidden" />
    </section>
  );
}
