/** @jsxImportSource hono/jsx */

export function ControlTabPanel() {
  return (
    <section
      id="gateway-panel"
      data-tab-panel="control"
      class="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"
    >
      <div class="flex min-h-full w-full flex-1 flex-col items-center justify-center p-2">
        <p class="text-center text-xs uppercase text-muted">Gateway</p>
        <h1 class="mt-2 text-center text-4xl font-medium tracking-[-0.08em]">Hermes Agent</h1>
        <div class="mt-6 text-center text-sm text-muted" id="gateway-status" data-state="stopped" />
        <p id="gateway-error" class="mt-2 text-center text-xs text-danger hidden" />
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <button
            id="start-button"
            class="rounded-full bg-text px-4 py-2 text-sm text-background"
            hx-post="/gateway/start"
            hx-trigger="click"
            hx-swap="none"
          >
            Start
          </button>
          <button
            id="stop-button"
            class="rounded-full bg-frosted px-4 py-2 text-sm text-text"
            hx-post="/gateway/stop"
            hx-trigger="click"
            hx-swap="none"
          >
            Stop
          </button>
          <button
            id="restart-button"
            class="rounded-full bg-frosted px-4 py-2 text-sm text-text"
            hx-post="/gateway/restart"
            hx-trigger="click"
            hx-swap="none"
          >
            Restart
          </button>
        </div>
      </div>
    </section>
  );
}
