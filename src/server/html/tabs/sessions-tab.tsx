/** @jsxImportSource hono/jsx */

export function SessionsTabPanel() {
  return (
    <section
      data-tab-panel="sessions"
      hidden
      class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div class="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase text-muted">Sessions</p>
          <p class="mt-1 text-sm text-text">Manage profile-scoped chat sessions</p>
          <p id="sessions-active" class="mt-1 text-xs text-muted">
            Loading sessions...
          </p>
        </div>
        <div class="flex gap-2">
          <button
            id="sessions-reload"
            type="button"
            class="rounded-full bg-frosted px-3 py-1 text-xs text-text"
          >
            Reload
          </button>
          <button
            id="sessions-create"
            type="button"
            class="rounded-full bg-text px-3 py-1 text-xs text-background"
          >
            New session
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto pr-1">
        <div class="rounded-lg border border-frosted bg-background">
          <table class="w-full text-left text-xs text-text">
            <thead class="text-muted">
              <tr class="border-b border-frosted">
                <th class="px-3 py-2 font-medium">Name</th>
                <th class="px-3 py-2 font-medium">ID</th>
                <th class="px-3 py-2 font-medium">Status</th>
                <th class="px-3 py-2 font-medium">Updated</th>
                <th class="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="sessions-list">
              <tr>
                <td class="px-3 py-3 text-muted" colSpan={5}>
                  Loading sessions...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p id="sessions-selection" class="mt-3 text-xs text-muted">
          Selected: none
        </p>
        <div class="mt-2 rounded-md border border-frosted bg-background p-3">
          <p class="mb-2 text-xs uppercase text-muted">Chat transcript</p>
          <pre
            id="sessions-transcript"
            class="max-h-[320px] overflow-auto whitespace-pre-wrap wrap-break-word text-xs text-text"
          >
            Click a session row to view its entire chat.
          </pre>
        </div>

        <p id="sessions-status" class="mt-2 text-xs text-muted" role="status" aria-live="polite">
          Ready.
        </p>
      </div>
    </section>
  );
}
