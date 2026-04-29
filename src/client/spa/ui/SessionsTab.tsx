import { useMemo } from "react";
import { useSessionsTab } from "../../hooks/useSessionsTab";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";

const EMPTY_TRANSCRIPT_HINT = "Click session row to view entire chat.";

export function SessionsTab() {
  const sessions = useSessionsTab();
  const selectedSession = useMemo(
    () => sessions.sessions.find((s) => s.id === sessions.selectedSessionId) ?? null,
    [sessions.sessions, sessions.selectedSessionId],
  );

  return (
    <section
      data-tab-panel="sessions"
      className="flex min-h-0 min-w-0 flex-1 flex-row gap-3 overflow-hidden"
    >
      <Card
        variant="soft"
        className="flex h-full min-h-0 w-full max-w-[280px] shrink-0 flex-col overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <div className="shrink-0 space-y-3 border-b border-frosted p-3">
          <p id="sessions-active" className="text-xs text-muted">
            {`Profile: ${sessions.profile ?? "default"} (${sessions.sessions.length} session${sessions.sessions.length === 1 ? "" : "s"})`}
          </p>
          <div className="flex flex-wrap gap-2">
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
        <div
          id="sessions-list"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
          role="list"
        >
          {sessions.sessions.length === 0 ? (
            <p className="p-3 text-xs text-muted">No sessions yet.</p>
          ) : (
            sessions.sessions.map((session) => {
              const selected = sessions.selectedSessionId === session.id;
              return (
                <button
                  key={session.id}
                  type="button"
                  role="listitem"
                  className={`w-full border-b border-l-2 border-frosted border-l-transparent py-2.5 pr-3 pl-3 text-left text-xs transition-colors last:border-b-0 hover:bg-frosted/25 ${selected ? "border-l-accent bg-frosted/40" : ""}`}
                  onClick={() => void sessions.openSession(session.id)}
                >
                  <div className="font-medium text-text">{session.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                    <span>{session.updatedAt}</span>
                    {session.archived ? (
                      <span className="rounded-md bg-frosted/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                        archived
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Card>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-frosted bg-surface/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-frosted px-4 py-3">
          {selectedSession ? (
            <>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-text">{selectedSession.name}</h2>
                <p id="sessions-selection" className="mt-0.5 text-xs text-muted">
                  {sessions.selectedLabel}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2 py-1 text-[11px]"
                  onClick={() => void sessions.renameSession(selectedSession.id)}
                >
                  Rename
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2 py-1 text-[11px]"
                  onClick={() =>
                    void (selectedSession.archived
                      ? sessions.restoreSession(selectedSession.id)
                      : sessions.archiveSession(selectedSession.id))
                  }
                >
                  {selectedSession.archived ? "Restore" : "Archive"}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="px-2 py-1 text-[11px]"
                  onClick={() => void sessions.deleteSession(selectedSession.id)}
                >
                  Delete
                </Button>
              </div>
            </>
          ) : (
            <div className="min-w-0">
              <p className="text-sm text-muted">Select a session</p>
              <p id="sessions-selection" className="mt-0.5 text-xs text-muted">
                {sessions.selectedLabel}
              </p>
            </div>
          )}
        </header>

        <div
          id="sessions-transcript"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
          role="region"
          aria-label="Session transcript"
        >
          {selectedSession ? (
            <pre className="m-0 min-h-0 flex-1 whitespace-pre-wrap p-4 text-xs text-text wrap-break-word">
              {sessions.transcript}
            </pre>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <p className="max-w-sm text-center text-sm text-muted">{EMPTY_TRANSCRIPT_HINT}</p>
            </div>
          )}
        </div>

        <p
          id="sessions-status"
          className="shrink-0 border-t border-frosted px-4 py-2 text-xs text-muted"
          role="status"
          aria-live="polite"
        >
          {sessions.status}
        </p>
      </div>
    </section>
  );
}
