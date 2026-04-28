/** @jsxImportSource hono/jsx */

export function WorkspaceTabStrip() {
  return (
    <div class="mb-3 flex shrink-0 flex-wrap items-center gap-2 border-b border-frosted pb-3">
      <label class="flex items-center gap-2 text-xs text-muted" for="profile-picker">
        Profile
        <select
          id="profile-picker"
          class="rounded-md border border-frosted bg-background px-2 py-1 text-xs text-text outline-none"
        >
          <option value="default">default</option>
        </select>
      </label>
      <span class="mx-1 h-5 w-px bg-frosted" aria-hidden="true" />
      <button
        type="button"
        data-tab-trigger="control"
        class="rounded-full bg-frosted px-4 py-2 text-sm text-text"
      >
        Control
      </button>
      <button
        type="button"
        data-tab-trigger="logs"
        class="rounded-full px-4 py-2 text-sm text-muted"
      >
        Live log
      </button>
      <button
        type="button"
        data-tab-trigger="shell"
        class="rounded-full px-4 py-2 text-sm text-muted"
      >
        Interactive shell
      </button>
      <button
        type="button"
        data-tab-trigger="config"
        class="rounded-full px-4 py-2 text-sm text-muted"
      >
        Hermes config
      </button>
      <button
        type="button"
        data-tab-trigger="env"
        class="rounded-full px-4 py-2 text-sm text-muted"
      >
        Env vars
      </button>
      <button
        type="button"
        data-tab-trigger="messaging"
        class="rounded-full px-4 py-2 text-sm text-muted"
      >
        Messaging Platform
      </button>
      <button
        type="button"
        data-tab-trigger="model-providers"
        class="rounded-full px-4 py-2 text-sm text-muted"
      >
        Model providers
      </button>
      <button
        type="button"
        data-tab-trigger="profiles"
        class="rounded-full px-4 py-2 text-sm text-muted"
      >
        Profiles
      </button>
    </div>
  );
}
