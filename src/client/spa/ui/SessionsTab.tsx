import type { ProfileSession } from "../../../server/types";

type SessionsTabProps = {
  profile: string | null;
  sessions: ProfileSession[];
  selectedSessionId: string | null;
  selectedLabel: string;
  transcript: string;
  status: string;
  onReload: () => Promise<void>;
  onCreate: () => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  onRename: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function SessionsTab(props: SessionsTabProps) {
  return (
    <section data-tab-panel="sessions" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p id="sessions-active" className="text-xs text-muted">
          {`Profile: ${props.profile ?? "default"} (${props.sessions.length} session${props.sessions.length === 1 ? "" : "s"})`}
        </p>
        <div className="flex gap-2">
          <button id="sessions-reload" type="button" className="rounded-full bg-frosted px-3 py-1 text-xs text-text" onClick={() => void props.onReload()}>
            Reload
          </button>
          <button id="sessions-create" type="button" className="rounded-full bg-text px-3 py-1 text-xs text-background" onClick={() => void props.onCreate()}>
            New session
          </button>
        </div>
      </div>
      <tbody id="sessions-list">
        {props.sessions.length === 0 ? (
          <tr>
            <td className="px-3 py-3 text-muted" colSpan={5}>
              No sessions yet.
            </td>
          </tr>
        ) : (
          props.sessions.map((session) => (
            <tr
              key={session.id}
              className={`border-b border-frosted last:border-b-0 cursor-pointer ${props.selectedSessionId === session.id ? "bg-frosted/40" : ""}`.trim()}
              onClick={() => void props.onOpen(session.id)}
            >
              <td className="px-3 py-2 text-text">{session.name}</td>
              <td className="px-3 py-2 text-muted">{session.id}</td>
              <td className="px-3 py-2 text-muted">{session.archived ? "archived" : "active"}</td>
              <td className="px-3 py-2 text-muted">{session.updatedAt}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="rounded-full bg-frosted px-2 py-1 text-[11px] text-text"
                    onClick={(event) => {
                      event.stopPropagation();
                      void props.onOpen(session.id);
                    }}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-frosted px-2 py-1 text-[11px] text-text"
                    onClick={(event) => {
                      event.stopPropagation();
                      void props.onRename(session.id);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-frosted px-2 py-1 text-[11px] text-text"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (session.archived) {
                        void props.onRestore(session.id);
                      } else {
                        void props.onArchive(session.id);
                      }
                    }}
                  >
                    {session.archived ? "Restore" : "Archive"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-frosted px-2 py-1 text-[11px] text-danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      void props.onDelete(session.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
      <p id="sessions-selection" className="mt-3 text-xs text-muted">{props.selectedLabel}</p>
      <pre id="sessions-transcript" className="max-h-[320px] overflow-auto whitespace-pre-wrap wrap-break-word text-xs text-text">
        {props.transcript}
      </pre>
      <p id="sessions-status" className="mt-2 text-xs text-muted" role="status" aria-live="polite">
        {props.status}
      </p>
    </section>
  );
}
