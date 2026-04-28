import type {
  ProfileActivateResult,
  ProfileCreateMode,
  ProfileListResult,
  ProfileSummary,
} from "../server/types";
import type { ApiFetcher } from "./api-fetcher";
import { getErrorMessage } from "./lib/errors";
import type { ProfileFilesUI } from "./profile-files-ui";

const STATUS_RESET_MS = 4_000;

export type ProfilesChangedDetail = {
  active: string | null;
  result?: ProfileActivateResult;
};

type ProfilesUIDeps = {
  api: ApiFetcher;
  files: ProfileFilesUI;
  /** Called after a successful activate so the rest of the workspace can re-fetch. */
  onProfileChanged: (detail: ProfilesChangedDetail) => void;
};

/**
 * Owns the Profiles tab list, the profile picker dropdown, and the create /
 * rename modals. Profile activation is fanned out via {@link ProfilesUIDeps.onProfileChanged}.
 */
export class ProfilesUI {
  private list: ProfileListResult = {
    active: null,
    profiles: [],
    warning: null,
  };
  private statusTimer: number | null = null;

  constructor(private readonly deps: ProfilesUIDeps) {}

  async setup(): Promise<void> {
    this.wireListClicks();
    this.wirePicker();
    this.wireReload();
    this.wireCreateDialog();
    this.wireRenameDialog();
    window.addEventListener("profiles:tab-shown", () => {
      void this.refresh();
    });
    await this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      this.list = await this.deps.api.getProfiles();
      this.deps.files.setProfile(this.list.active);
      this.render();
    } catch (cause: unknown) {
      this.setStatus(`Failed to load profiles: ${getErrorMessage(cause)}`, true);
    }
  }

  private wireReload(): void {
    const reload = document.getElementById("profiles-reload");
    reload?.addEventListener("click", () => {
      void this.refresh();
    });
  }

  private wirePicker(): void {
    const picker = document.getElementById("profile-picker");
    if (!(picker instanceof HTMLSelectElement)) {
      return;
    }
    picker.addEventListener("change", () => {
      void this.activate(this.parsePickerValue(picker.value));
    });
  }

  private parsePickerValue(value: string): string | null {
    return value === "default" ? null : value;
  }

  private wireListClicks(): void {
    const tbody = document.getElementById("profiles-list");
    tbody?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const action = target.closest<HTMLButtonElement>("button[data-profile-action]");
      if (!action) {
        return;
      }
      const kind = action.dataset.profileAction;
      const name = action.dataset.profileName ?? "";
      const profile = name === "default" ? null : name;
      if (kind === "activate") {
        void this.activate(profile);
      } else if (kind === "rename") {
        if (profile === null) {
          this.setStatus("Default profile cannot be renamed.", true);
          return;
        }
        this.openRenameDialog(profile);
      } else if (kind === "delete") {
        if (profile === null) {
          this.setStatus("Default profile cannot be deleted.", true);
          return;
        }
        void this.confirmDelete(profile);
      }
    });
  }

  private async activate(name: string | null): Promise<void> {
    if (name === this.list.active) {
      return;
    }
    this.setStatus(
      name === null ? "Activating default profile..." : `Activating profile "${name}"...`,
    );
    try {
      const result = await this.deps.api.postProfileActivate(name);
      this.list = result.list;
      this.deps.files.setProfile(result.active);
      this.render();
      this.deps.onProfileChanged({ active: result.active, result });
      this.setStatus(this.formatActivateMessage(result));
    } catch (cause: unknown) {
      this.setStatus(`Failed to activate: ${getErrorMessage(cause)}`, true);
      this.render();
    }
  }

  private formatActivateMessage(result: ProfileActivateResult): string {
    const label = result.active === null ? "default" : `"${result.active}"`;
    if (result.restart.attempted && result.restart.ok) {
      return `Activated ${label}. Gateway restarted.`;
    }
    if (result.restart.attempted) {
      return `Activated ${label}. Gateway restart failed: ${result.restart.error ?? "unknown error"}`;
    }
    return `Activated ${label}.`;
  }

  private wireCreateDialog(): void {
    const newButton = document.getElementById("profiles-new");
    const dialog = this.requireDialog("profiles-create-dialog");
    const cancel = document.querySelector<HTMLButtonElement>(
      "[data-profiles-create-cancel]",
    );
    const form = document.getElementById("profiles-create-form");

    newButton?.addEventListener("click", () => {
      this.openCreateDialog();
    });
    cancel?.addEventListener("click", () => {
      dialog.close();
    });
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submitCreate();
    });
  }

  private wireRenameDialog(): void {
    const dialog = this.requireDialog("profiles-rename-dialog");
    const cancel = document.querySelector<HTMLButtonElement>(
      "[data-profiles-rename-cancel]",
    );
    const form = document.getElementById("profiles-rename-form");

    cancel?.addEventListener("click", () => {
      dialog.close();
    });
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submitRename();
    });
  }

  private openCreateDialog(): void {
    const dialog = this.requireDialog("profiles-create-dialog");
    const error = document.getElementById("profiles-create-error");
    if (error) {
      error.classList.add("hidden");
      error.textContent = "";
    }
    const form = document.getElementById("profiles-create-form");
    if (form instanceof HTMLFormElement) {
      form.reset();
    }
    this.populateCloneFromOptions();
    dialog.showModal();
    const nameInput = document.getElementById("profiles-create-name");
    if (nameInput instanceof HTMLInputElement) {
      nameInput.focus();
    }
  }

  private populateCloneFromOptions(): void {
    const select = document.getElementById("profiles-create-clone-from");
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }
    const previous = select.value;
    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "(active profile)";
    select.append(placeholder);
    for (const profile of this.list.profiles) {
      if (profile.name === null) {
        continue;
      }
      const option = document.createElement("option");
      option.value = profile.name;
      option.textContent = profile.name;
      select.append(option);
    }
    if (previous && Array.from(select.options).some((option) => option.value === previous)) {
      select.value = previous;
    }
  }

  private async submitCreate(): Promise<void> {
    const form = document.getElementById("profiles-create-form");
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    const error = document.getElementById("profiles-create-error");
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const mode = String(formData.get("mode") ?? "blank") as ProfileCreateMode;
    const cloneFromValue = String(formData.get("cloneFrom") ?? "").trim();

    if (!name) {
      this.showDialogError(error, "Name is required.");
      return;
    }

    const payload: { name: string; mode: ProfileCreateMode; cloneFrom?: string } = {
      name,
      mode,
    };
    if (cloneFromValue.length > 0) {
      payload.cloneFrom = cloneFromValue;
    }

    try {
      const result = await this.deps.api.postProfile(payload);
      this.list = result.list;
      this.render();
      this.requireDialog("profiles-create-dialog").close();
      this.setStatus(`Created profile "${name}".`);
    } catch (cause: unknown) {
      this.showDialogError(error, getErrorMessage(cause));
    }
  }

  private openRenameDialog(name: string): void {
    const dialog = this.requireDialog("profiles-rename-dialog");
    const current = document.getElementById("profiles-rename-current");
    const input = document.getElementById("profiles-rename-to");
    const error = document.getElementById("profiles-rename-error");
    if (current) {
      current.textContent = name;
    }
    if (input instanceof HTMLInputElement) {
      input.value = name;
      input.dataset.profileFrom = name;
    }
    if (error) {
      error.classList.add("hidden");
      error.textContent = "";
    }
    dialog.showModal();
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  }

  private async submitRename(): Promise<void> {
    const input = document.getElementById("profiles-rename-to");
    const error = document.getElementById("profiles-rename-error");
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const from = input.dataset.profileFrom ?? "";
    const to = input.value.trim();
    if (!from || !to) {
      this.showDialogError(error, "Both names are required.");
      return;
    }
    if (from === to) {
      this.showDialogError(error, "New name must differ from current name.");
      return;
    }
    try {
      const result = await this.deps.api.putProfileRename(from, to);
      this.list = result.list;
      this.render();
      this.requireDialog("profiles-rename-dialog").close();
      this.setStatus(`Renamed "${from}" -> "${to}".`);
    } catch (cause: unknown) {
      this.showDialogError(error, getErrorMessage(cause));
    }
  }

  private async confirmDelete(name: string): Promise<void> {
    const typed = window.prompt(
      `Type the profile name "${name}" to confirm deletion. This cannot be undone.`,
    );
    if (typed === null) {
      return;
    }
    if (typed.trim() !== name) {
      this.setStatus("Profile name did not match. Delete cancelled.", true);
      return;
    }
    try {
      const result = await this.deps.api.deleteProfile(name);
      this.list = result.list;
      this.render();
      this.setStatus(`Deleted profile "${name}".`);
    } catch (cause: unknown) {
      this.setStatus(`Failed to delete: ${getErrorMessage(cause)}`, true);
    }
  }

  private render(): void {
    this.renderPicker();
    this.renderActiveLabel();
    this.renderTable();
  }

  private renderPicker(): void {
    const picker = document.getElementById("profile-picker");
    if (!(picker instanceof HTMLSelectElement)) {
      return;
    }
    const previous = picker.value;
    picker.innerHTML = "";
    for (const profile of this.list.profiles) {
      const option = document.createElement("option");
      option.value = profile.name ?? "default";
      option.textContent = profile.label;
      picker.append(option);
    }
    const desired = this.list.active ?? "default";
    picker.value = Array.from(picker.options).some((option) => option.value === desired)
      ? desired
      : previous;
  }

  private renderActiveLabel(): void {
    const label = document.getElementById("profiles-active");
    if (!label) {
      return;
    }
    const active = this.list.active;
    label.textContent = `Active: ${active === null ? "default" : `"${active}"`} (${this.list.profiles.length} profile${this.list.profiles.length === 1 ? "" : "s"})`;
  }

  private renderTable(): void {
    const tbody = document.getElementById("profiles-list");
    if (!tbody) {
      return;
    }
    tbody.innerHTML = "";
    if (this.list.profiles.length === 0) {
      const empty = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.className = "px-3 py-3 text-muted";
      cell.textContent = "No profiles yet.";
      empty.append(cell);
      tbody.append(empty);
      return;
    }
    for (const profile of this.list.profiles) {
      tbody.append(this.renderRow(profile));
    }
  }

  private renderRow(profile: ProfileSummary): HTMLTableRowElement {
    const row = document.createElement("tr");
    row.className = "border-b border-frosted last:border-b-0";

    const nameCell = document.createElement("td");
    nameCell.className = "px-3 py-2 text-text";
    const nameSpan = document.createElement("span");
    nameSpan.textContent = profile.label;
    nameCell.append(nameSpan);
    if (profile.active) {
      const badge = document.createElement("span");
      badge.className = "ml-2 rounded-full bg-text px-2 py-0.5 text-[10px] text-background";
      badge.textContent = "active";
      nameCell.append(badge);
    }
    row.append(nameCell);

    const pathCell = document.createElement("td");
    pathCell.className = "px-3 py-2 text-muted";
    pathCell.textContent = profile.dataDir;
    row.append(pathCell);

    const updatedCell = document.createElement("td");
    updatedCell.className = "px-3 py-2 text-muted";
    updatedCell.textContent = profile.updatedAt ?? "-";
    row.append(updatedCell);

    const actionsCell = document.createElement("td");
    actionsCell.className = "px-3 py-2 text-right";
    const actionWrap = document.createElement("div");
    actionWrap.className = "flex justify-end gap-1";

    const profileKey = profile.name ?? "default";
    if (!profile.active) {
      actionWrap.append(this.makeActionButton("activate", profileKey, "Activate"));
    }
    if (profile.name !== null) {
      actionWrap.append(this.makeActionButton("rename", profileKey, "Rename"));
      actionWrap.append(
        this.makeActionButton("delete", profileKey, "Delete", "text-danger"),
      );
    }
    actionsCell.append(actionWrap);
    row.append(actionsCell);

    return row;
  }

  private makeActionButton(
    action: "activate" | "rename" | "delete",
    name: string,
    label: string,
    extraClass = "",
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.profileAction = action;
    button.dataset.profileName = name;
    button.className = `rounded-full bg-frosted px-2 py-1 text-[11px] text-text ${extraClass}`.trim();
    button.textContent = label;
    return button;
  }

  private showDialogError(element: HTMLElement | null, message: string): void {
    if (!element) {
      return;
    }
    element.textContent = message;
    element.classList.remove("hidden");
  }

  private setStatus(message: string, isError = false): void {
    const status = document.getElementById("profiles-status");
    if (!status) {
      return;
    }
    status.textContent = message;
    status.classList.toggle("text-danger", isError);
    status.classList.toggle("text-muted", !isError);
    if (this.statusTimer !== null) {
      window.clearTimeout(this.statusTimer);
    }
    if (!isError) {
      this.statusTimer = window.setTimeout(() => {
        status.textContent = "Ready.";
      }, STATUS_RESET_MS);
    }
  }

  private requireDialog(id: string): HTMLDialogElement {
    const dialog = document.getElementById(id);
    if (!(dialog instanceof HTMLDialogElement)) {
      throw new Error(`Missing dialog element #${id}`);
    }
    return dialog;
  }
}
