/** @jsxImportSource hono/jsx */

export function ProfilesTabPanel() {
  return (
    <section
      data-tab-panel="profiles"
      hidden
      class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div class="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase text-muted">Profiles</p>
          <p class="mt-1 text-sm text-text">Manage Hermes profiles &amp; identity files</p>
          <p id="profiles-active" class="mt-1 text-xs text-muted">
            Loading profiles...
          </p>
        </div>
        <div class="flex gap-2">
          <button
            id="profiles-reload"
            type="button"
            class="rounded-full bg-frosted px-3 py-1 text-xs text-text"
          >
            Reload
          </button>
          <button
            id="profiles-new"
            type="button"
            class="rounded-full bg-text px-3 py-1 text-xs text-background"
          >
            New profile
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto pr-1">
        <div class="rounded-lg border border-frosted bg-background">
          <table class="w-full text-left text-xs text-text">
            <thead class="text-muted">
              <tr class="border-b border-frosted">
                <th class="px-3 py-2 font-medium">Profile</th>
                <th class="px-3 py-2 font-medium">Path</th>
                <th class="px-3 py-2 font-medium">Updated</th>
                <th class="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="profiles-list">
              <tr>
                <td class="px-3 py-3 text-muted" colSpan={4}>
                  Loading profiles...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p id="profiles-status" class="mt-3 text-xs text-muted" role="status" aria-live="polite">
          Ready.
        </p>

        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <ProfileFileCard kind="soul" title="SOUL.md" subtitle="Identity & tone" />
          <ProfileFileCard kind="memory" title="MEMORY.md" subtitle="Agent observations" />
          <ProfileFileCard kind="user" title="USER.md" subtitle="User profile memory" />
        </div>
      </div>

      <ProfileCreateDialog />
      <ProfileRenameDialog />
    </section>
  );
}

type ProfileFileCardProps = {
  kind: "soul" | "memory" | "user";
  title: string;
  subtitle: string;
};

function ProfileFileCard({ kind, title, subtitle }: ProfileFileCardProps) {
  return (
    <div class="flex min-h-[260px] flex-col rounded-lg border border-frosted bg-background p-3">
      <div class="mb-2 flex items-start justify-between gap-2">
        <div>
          <p class="text-sm text-text">{title}</p>
          <p class="text-xs text-muted">{subtitle}</p>
          <p data-profile-file-path={kind} class="mt-1 text-[11px] text-muted">
            -
          </p>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            data-profile-file-reload={kind}
            class="rounded-full bg-frosted px-2 py-1 text-[11px] text-text"
          >
            Reload
          </button>
          <button
            type="button"
            data-profile-file-save={kind}
            class="rounded-full bg-text px-2 py-1 text-[11px] text-background disabled:opacity-50"
            disabled
          >
            Save
          </button>
        </div>
      </div>
      <div
        data-profile-file-editor={kind}
        class="min-h-[180px] flex-1 overflow-hidden rounded-md border border-frosted bg-background"
      />
      <p
        data-profile-file-status={kind}
        class="mt-2 text-[11px] text-muted"
        role="status"
        aria-live="polite"
      >
        Loading editor...
      </p>
    </div>
  );
}

function ProfileCreateDialog() {
  return (
    <dialog
      id="profiles-create-dialog"
      class="rounded-xl border border-accent-border bg-surface p-0 text-text backdrop:bg-black/60"
    >
      <form id="profiles-create-form" class="flex w-[420px] max-w-full flex-col gap-3 p-4">
        <div>
          <p class="text-xs uppercase text-muted">New profile</p>
          <p class="mt-1 text-sm text-text">Create a new Hermes profile</p>
        </div>
        <label class="flex flex-col gap-1 text-xs text-muted">
          Name
          <input
            id="profiles-create-name"
            name="name"
            type="text"
            required
            placeholder="coder"
            pattern="[a-z0-9][a-z0-9_-]{0,31}"
            class="rounded-md border border-frosted bg-background px-2 py-1 text-xs text-text outline-none"
          />
          <span class="text-[10px] text-muted">
            Lowercase letters, digits, dash, underscore. Max 32 chars.
          </span>
        </label>
        <fieldset class="flex flex-col gap-2 text-xs text-text">
          <legend class="text-xs text-muted">Mode</legend>
          <label class="flex items-start gap-2">
            <input type="radio" name="mode" value="blank" checked class="mt-0.5" />
            <span>
              <span class="block text-text">Blank</span>
              <span class="block text-[11px] text-muted">
                Fresh config, .env, SOUL.md, and bundled skills.
              </span>
            </span>
          </label>
          <label class="flex items-start gap-2">
            <input type="radio" name="mode" value="clone" class="mt-0.5" />
            <span>
              <span class="block text-text">Clone config (--clone)</span>
              <span class="block text-[11px] text-muted">
                Copy config.yaml, .env, and SOUL.md only.
              </span>
            </span>
          </label>
          <label class="flex items-start gap-2">
            <input type="radio" name="mode" value="clone-all" class="mt-0.5" />
            <span>
              <span class="block text-text">Clone everything (--clone-all)</span>
              <span class="block text-[11px] text-muted">
                Full snapshot including memories and sessions.
              </span>
            </span>
          </label>
        </fieldset>
        <label class="flex flex-col gap-1 text-xs text-muted">
          Clone from (optional)
          <select
            id="profiles-create-clone-from"
            name="cloneFrom"
            class="rounded-md border border-frosted bg-background px-2 py-1 text-xs text-text outline-none"
          >
            <option value="">(active profile)</option>
          </select>
        </label>
        <p id="profiles-create-error" class="hidden text-[11px] text-danger" role="alert" />
        <div class="mt-1 flex justify-end gap-2">
          <button
            type="button"
            data-profiles-create-cancel
            class="rounded-full bg-frosted px-3 py-1 text-xs text-text"
          >
            Cancel
          </button>
          <button type="submit" class="rounded-full bg-text px-3 py-1 text-xs text-background">
            Create
          </button>
        </div>
      </form>
    </dialog>
  );
}

function ProfileRenameDialog() {
  return (
    <dialog
      id="profiles-rename-dialog"
      class="rounded-xl border border-accent-border bg-surface p-0 text-text backdrop:bg-black/60"
    >
      <form id="profiles-rename-form" class="flex w-[360px] max-w-full flex-col gap-3 p-4">
        <div>
          <p class="text-xs uppercase text-muted">Rename profile</p>
          <p id="profiles-rename-current" class="mt-1 text-sm text-text">
            -
          </p>
        </div>
        <label class="flex flex-col gap-1 text-xs text-muted">
          New name
          <input
            id="profiles-rename-to"
            name="to"
            type="text"
            required
            pattern="[a-z0-9][a-z0-9_-]{0,31}"
            class="rounded-md border border-frosted bg-background px-2 py-1 text-xs text-text outline-none"
          />
        </label>
        <p id="profiles-rename-error" class="hidden text-[11px] text-danger" role="alert" />
        <div class="mt-1 flex justify-end gap-2">
          <button
            type="button"
            data-profiles-rename-cancel
            class="rounded-full bg-frosted px-3 py-1 text-xs text-text"
          >
            Cancel
          </button>
          <button type="submit" class="rounded-full bg-text px-3 py-1 text-xs text-background">
            Rename
          </button>
        </div>
      </form>
    </dialog>
  );
}
