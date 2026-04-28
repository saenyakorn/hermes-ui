import type { ProfileSession, ProfileSessionListResult } from "../server/types";
import type { ApiFetcher } from "./api-fetcher";
import { getErrorMessage } from "./lib/errors";

const STATUS_RESET_MS = 4_000;

export class SessionsUI {
  private profile: string | null = null;
  private list: ProfileSessionListResult = { profile: null, sessions: [] };
  private selectedSessionId: string | null = null;
  private statusTimer: number | null = null;

  constructor(private readonly api: ApiFetcher) {}

  async setup(): Promise<void> {
    this.wireActions();
    window.addEventListener("sessions:tab-shown", () => {
      void this.refresh();
    });
    await this.refresh();
  }

  setProfile(profile: string | null): void {
    this.profile = profile;
    void this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      this.list = await this.api.getProfileSessions(this.profile);
      this.render();
    } catch (cause: unknown) {
      this.setStatus(`Failed to load sessions: ${getErrorMessage(cause)}`, true);
    }
  }

  private wireActions(): void {
    const reload = document.getElementById("sessions-reload");
    reload?.addEventListener("click", () => void this.refresh());

    const create = document.getElementById("sessions-create");
    create?.addEventListener("click", () => void this.createSession());

    const list = document.getElementById("sessions-list");
    list?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.closest("button[data-session-action]")) {
        const row = target.closest<HTMLTableRowElement>("tr[data-session-id]");
        if (row?.dataset.sessionId) {
          void this.openSession(row.dataset.sessionId);
        }
        return;
      }
      const action = target.closest<HTMLButtonElement>("button[data-session-action]");
      if (!action) {
        return;
      }
      const id = action.dataset.sessionId;
      const kind = action.dataset.sessionAction;
      if (!id || !kind) {
        return;
      }
      if (kind === "open") {
        void this.openSession(id);
      } else if (kind === "rename") {
        void this.renameSession(id);
      } else if (kind === "delete") {
        void this.deleteSession(id);
      } else if (kind === "archive") {
        void this.archiveSession(id);
      } else if (kind === "restore") {
        void this.restoreSession(id);
      }
    });
  }

  private async createSession(): Promise<void> {
    const name = window.prompt("New session name");
    if (name === null) {
      return;
    }
    try {
      await this.api.postProfileSession(this.profile, { name });
      await this.refresh();
      this.setStatus("Session created.");
    } catch (cause: unknown) {
      this.setStatus(`Failed to create session: ${getErrorMessage(cause)}`, true);
    }
  }

  private async openSession(id: string): Promise<void> {
    try {
      const detail = await this.api.getProfileSession(this.profile, id);
      this.selectedSessionId = id;
      const pathLabel = document.getElementById("sessions-selection");
      if (pathLabel) {
        pathLabel.textContent = `Selected: ${detail.session.name} (${detail.session.id})`;
      }
      const transcript = document.getElementById("sessions-transcript");
      if (transcript) {
        transcript.textContent = detail.session.chat || "(No chat content found in this session)";
      }
      this.render();
      this.setStatus(`Opened "${detail.session.name}".`);
    } catch (cause: unknown) {
      this.setStatus(`Failed to open session: ${getErrorMessage(cause)}`, true);
    }
  }

  private async renameSession(id: string): Promise<void> {
    const nextName = window.prompt("Rename session to");
    if (nextName === null) {
      return;
    }
    try {
      await this.api.putProfileSessionRename(this.profile, id, { name: nextName });
      await this.refresh();
      this.setStatus("Session renamed.");
    } catch (cause: unknown) {
      this.setStatus(`Failed to rename session: ${getErrorMessage(cause)}`, true);
    }
  }

  private async deleteSession(id: string): Promise<void> {
    const confirmed = window.confirm("Delete this session?");
    if (!confirmed) {
      return;
    }
    try {
      await this.api.deleteProfileSession(this.profile, id);
      await this.refresh();
      this.setStatus("Session deleted.");
    } catch (cause: unknown) {
      this.setStatus(`Failed to delete session: ${getErrorMessage(cause)}`, true);
    }
  }

  private async archiveSession(id: string): Promise<void> {
    try {
      await this.api.postProfileSessionArchive(this.profile, id);
      await this.refresh();
      this.setStatus("Session archived.");
    } catch (cause: unknown) {
      this.setStatus(`Failed to archive session: ${getErrorMessage(cause)}`, true);
    }
  }

  private async restoreSession(id: string): Promise<void> {
    try {
      await this.api.postProfileSessionRestore(this.profile, id);
      await this.refresh();
      this.setStatus("Session restored.");
    } catch (cause: unknown) {
      this.setStatus(`Failed to restore session: ${getErrorMessage(cause)}`, true);
    }
  }

  private render(): void {
    const active = document.getElementById("sessions-active");
    if (active) {
      active.textContent = `Profile: ${this.profile ?? "default"} (${this.list.sessions.length} session${this.list.sessions.length === 1 ? "" : "s"})`;
    }
    const tbody = document.getElementById("sessions-list");
    if (!tbody) {
      return;
    }
    tbody.innerHTML = "";
    if (this.list.sessions.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "px-3 py-3 text-muted";
      cell.textContent = "No sessions yet.";
      row.append(cell);
      tbody.append(row);
      return;
    }
    for (const session of this.list.sessions) {
      tbody.append(this.renderRow(session));
    }
  }

  private renderRow(session: ProfileSession): HTMLTableRowElement {
    const row = document.createElement("tr");
    row.className =
      `border-b border-frosted last:border-b-0 cursor-pointer ${this.selectedSessionId === session.id ? "bg-frosted/40" : ""}`.trim();
    row.dataset.sessionId = session.id;

    row.append(this.makeCell(session.name, "px-3 py-2 text-text"));
    row.append(this.makeCell(session.id, "px-3 py-2 text-muted"));
    row.append(this.makeCell(session.archived ? "archived" : "active", "px-3 py-2 text-muted"));
    row.append(this.makeCell(session.updatedAt, "px-3 py-2 text-muted"));

    const actions = document.createElement("td");
    actions.className = "px-3 py-2 text-right";
    const wrap = document.createElement("div");
    wrap.className = "flex justify-end gap-1";
    wrap.append(this.makeAction("open", session.id, "Open"));
    wrap.append(this.makeAction("rename", session.id, "Rename"));
    wrap.append(
      this.makeAction(
        session.archived ? "restore" : "archive",
        session.id,
        session.archived ? "Restore" : "Archive",
      ),
    );
    wrap.append(this.makeAction("delete", session.id, "Delete", "text-danger"));
    actions.append(wrap);
    row.append(actions);
    return row;
  }

  private makeCell(content: string, className: string): HTMLTableCellElement {
    const cell = document.createElement("td");
    cell.className = className;
    cell.textContent = content;
    return cell;
  }

  private makeAction(
    action: "open" | "rename" | "archive" | "restore" | "delete",
    id: string,
    label: string,
    extraClass = "",
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.sessionAction = action;
    button.dataset.sessionId = id;
    button.className =
      `rounded-full bg-frosted px-2 py-1 text-[11px] text-text ${extraClass}`.trim();
    button.textContent = label;
    return button;
  }

  private setStatus(message: string, isError = false): void {
    const status = document.getElementById("sessions-status");
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
}
