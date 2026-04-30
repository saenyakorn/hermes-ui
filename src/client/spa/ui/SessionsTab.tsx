import { useMemo } from "react";
import { useSessionsTab } from "../../hooks/useSessionsTab";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";

const EMPTY_TRANSCRIPT_HINT = "Click session row to view entire chat.";
const MESSAGE_LINE_PATTERN = /^\[([^\]]+)\]\s*(.*)$/;

type TranscriptMessage = {
  role: string;
  content: string;
  fromAuthor: boolean;
};

function normalizeRole(rawRole: string): string {
  return rawRole.trim().toLowerCase();
}

function isAuthorRole(rawRole: string): boolean {
  const role = normalizeRole(rawRole);
  return role === "author" || role === "user" || role === "human";
}

function toTitleRole(rawRole: string): string {
  const role = normalizeRole(rawRole);
  if (role.length === 0) {
    return "Bot";
  }
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function parseTranscript(transcript: string): TranscriptMessage[] {
  const trimmed = transcript.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const lines = trimmed.split("\n");
  const messages: TranscriptMessage[] = [];
  for (const line of lines) {
    const match = MESSAGE_LINE_PATTERN.exec(line);
    if (match) {
      const role = match[1] ?? "bot";
      messages.push({
        role: toTitleRole(role),
        content: (match[2] ?? "").trim(),
        fromAuthor: isAuthorRole(role),
      });
      continue;
    }
    if (messages.length === 0) {
      messages.push({
        role: "Bot",
        content: line,
        fromAuthor: false,
      });
      continue;
    }
    messages[messages.length - 1]!.content += `\n${line}`;
  }
  return messages.filter((message) => message.content.trim().length > 0);
}

function extractDisplayNameAndContent(message: TranscriptMessage): {
  label: string;
  content: string;
} {
  if (!message.fromAuthor) {
    return { label: "Bot", content: message.content };
  }
  const match = /^\[([^\]]+)\]\s*(.*)$/s.exec(message.content.trim());
  if (match) {
    const name = match[1]?.trim();
    const content = match[2] ?? "";
    if (name && name.length > 0) {
      return { label: name, content };
    }
  }
  return { label: message.role, content: message.content };
}

type StructuredTaskResult = {
  task_index?: number;
  status?: string;
  summary?: string;
  duration_seconds?: number;
  model?: string;
  api_calls?: number;
};

type StructuredPayload = {
  results?: StructuredTaskResult[];
  total_duration_seconds?: number;
};

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function formatStructuredPayload(raw: string): string | null {
  const text = raw.trim();
  if (!text.startsWith("{") || !text.endsWith("}")) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const payload = parsed as StructuredPayload;
  if (!Array.isArray(payload.results) || payload.results.length === 0) {
    return null;
  }

  const lines: string[] = [];
  lines.push("Structured result");
  for (const result of payload.results) {
    if (typeof result !== "object" || result === null) {
      continue;
    }
    const taskIndex = typeof result.task_index === "number" ? result.task_index : null;
    const status = toText(result.status) ?? "unknown";
    lines.push("");
    lines.push(`Task ${taskIndex ?? "?"} - ${status}`);

    const summaryRaw = toText(result.summary);
    if (summaryRaw) {
      const summary = summaryRaw
        .replace(/<tool_response>[\s\S]*?<\/tool_response>/g, "")
        .replace(/\s+\n/g, "\n")
        .trim();
      lines.push(`Summary: ${summary.length > 700 ? `${summary.slice(0, 700)}...` : summary}`);
    }
    if (typeof result.duration_seconds === "number") {
      lines.push(`Duration: ${result.duration_seconds.toFixed(2)}s`);
    }
    if (toText(result.model)) {
      lines.push(`Model: ${result.model}`);
    }
    if (typeof result.api_calls === "number") {
      lines.push(`API calls: ${String(result.api_calls)}`);
    }
  }
  if (typeof payload.total_duration_seconds === "number") {
    lines.push("");
    lines.push(`Total duration: ${payload.total_duration_seconds.toFixed(2)}s`);
  }
  return lines.join("\n");
}

export function SessionsTab() {
  const sessions = useSessionsTab();
  const selectedSession = useMemo(
    () => sessions.sessions.find((s) => s.id === sessions.selectedSessionId) ?? null,
    [sessions.sessions, sessions.selectedSessionId],
  );
  const transcriptMessages = useMemo(
    () => parseTranscript(sessions.transcript),
    [sessions.transcript],
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
            transcriptMessages.length > 0 ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 pb-8">
                {transcriptMessages.map((message, index) => {
                  const formattedContent =
                    formatStructuredPayload(message.content) ?? message.content;
                  const display = extractDisplayNameAndContent({
                    ...message,
                    content: formattedContent,
                  });
                  const isLastMessage = index === transcriptMessages.length - 1;
                  return (
                    <div
                      key={`${message.role}-${String(index)}`}
                      className={`flex w-full ${message.fromAuthor ? "justify-end" : "justify-start"} ${isLastMessage ? "pb-6" : ""}`}
                    >
                      <article
                        className={`max-w-[85%] rounded-2xl border px-3 py-2 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${message.fromAuthor ? "border-accent/40 bg-accent/20 text-text" : "border-frosted bg-surface/70 text-text"}`}
                      >
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          {display.label}
                        </p>
                        <p className="m-0 whitespace-pre-wrap wrap-break-word">{display.content}</p>
                      </article>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <p className="max-w-sm text-center text-sm text-muted">
                  (No chat content found in this session)
                </p>
              </div>
            )
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
