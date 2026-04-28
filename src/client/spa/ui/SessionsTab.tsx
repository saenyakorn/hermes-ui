import { useSessionsTab } from "../../hooks/useSessionsTab";

export function SessionsTab() {
  const sessions = useSessionsTab();

  return (
    <section
      data-tab-panel="sessions"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p id="sessions-active" className="text-xs text-muted">
          {`Profile: ${sessions.profile ?? "default"} (${sessions.sessions.length} session${sessions.sessions.length === 1 ? "" : "s"})`}
        </p>
        <div className="flex gap-2">
          <button
            id="sessions-reload"
            type="button"
            className="rounded-full bg-frosted px-3 py-1 text-xs text-text"
            onClick={() => void sessions.refresh()}
          >
            Reload
          </button>
          <button
            id="sessions-create"
            type="button"
            className="rounded-full bg-text px-3 py-1 text-xs text-background"
            onClick={() => void sessions.createSession()}
          >
            New session
          </button>
        </div>
      </div>
      <tbody id="sessions-list">
        {sessions.sessions.length === 0 ? (
          <tr>
            <td className="px-3 py-3 text-muted" colSpan={5}>
              No sessions yet.
            </td>
          </tr>
        ) : (
          sessions.sessions.map((session) => (
            <tr
              key={session.id}
              className={`border-b border-frosted last:border-b-0 cursor-pointer ${sessions.selectedSessionId === session.id ? "bg-frosted/40" : ""}`.trim()}
              onClick={() => void sessions.openSession(session.id)}
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
                      void sessions.openSession(session.id);
                    }}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-frosted px-2 py-1 text-[11px] text-text"
                    onClick={(event) => {
                      event.stopPropagation();
                      void sessions.renameSession(session.id);
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
                        void sessions.restoreSession(session.id);
                      } else {
                        void sessions.archiveSession(session.id);
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
                      void sessions.deleteSession(session.id);
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
      <p id="sessions-selection" className="mt-3 text-xs text-muted">
        {sessions.selectedLabel}
      </p>
      <pre
        id="sessions-transcript"
        className="max-h-[320px] overflow-auto whitespace-pre-wrap wrap-break-word text-xs text-text"
      >
        {sessions.transcript}
      </pre>
      <p id="sessions-status" className="mt-2 text-xs text-muted" role="status" aria-live="polite">
        {sessions.status}
      </p>
    </section>
  );
}
