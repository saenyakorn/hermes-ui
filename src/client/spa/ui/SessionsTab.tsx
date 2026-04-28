import { useSessionsTab } from "../../hooks/useSessionsTab";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";

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
          <Button
            id="sessions-reload"
            type="button"
            variant="secondary"
            onClick={() => void sessions.refresh()}
          >
            Reload
          </Button>
          <Button
            id="sessions-create"
            type="button"
            variant="primary"
            onClick={() => void sessions.createSession()}
          >
            New session
          </Button>
        </div>
      </div>
      <Card variant="soft" className="mb-3 overflow-auto">
        <table className="w-full border-collapse text-xs">
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
                  <td className="px-3 py-2 text-muted">
                    {session.archived ? "archived" : "active"}
                  </td>
                  <td className="px-3 py-2 text-muted">{session.updatedAt}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2 py-1 text-[11px]"
                        onClick={(event) => {
                          event.stopPropagation();
                          void sessions.openSession(session.id);
                        }}
                      >
                        Open
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2 py-1 text-[11px]"
                        onClick={(event) => {
                          event.stopPropagation();
                          void sessions.renameSession(session.id);
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2 py-1 text-[11px]"
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
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        className="px-2 py-1 text-[11px]"
                        onClick={(event) => {
                          event.stopPropagation();
                          void sessions.deleteSession(session.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
      <p id="sessions-selection" className="mt-3 text-xs text-muted">
        {sessions.selectedLabel}
      </p>
      <pre
        id="sessions-transcript"
        className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-lg border border-frosted bg-background p-3 text-xs text-text wrap-break-word"
      >
        {sessions.transcript}
      </pre>
      <p id="sessions-status" className="mt-2 text-xs text-muted" role="status" aria-live="polite">
        {sessions.status}
      </p>
    </section>
  );
}
