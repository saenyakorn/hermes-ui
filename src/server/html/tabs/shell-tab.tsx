/** @jsxImportSource hono/jsx */

export function ShellTabPanel() {
  return (
    <section
      data-tab-panel="shell"
      hidden
      class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div class="mb-3 flex shrink-0 items-center justify-between">
        <p class="text-sm text-muted">Interactive shell</p>
        <button
          id="shell-clear"
          type="button"
          class="rounded-full bg-frosted px-3 py-1 text-xs text-text"
        >
          Clear
        </button>
      </div>
      <div id="terminal" class="min-h-[320px] flex-1 rounded-lg bg-background" />
    </section>
  );
}
