import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { ProfileSession, ProfileSessionListResult } from "../../server/types";
import { ApiFetcher } from "../api-fetcher";
import { getErrorMessage } from "../lib/errors";
import { PROFILE_CHANGED_EVENT, SESSIONS_TAB_SHOWN_EVENT } from "../lib/event";

type SessionsState = {
  list: ProfileSessionListResult;
  selectedSessionId: string | null;
  selectedLabel: string;
  transcript: string;
  status: string;
};

const initialState = (profile: string | null): SessionsState => ({
  list: { profile, sessions: [] },
  selectedSessionId: null,
  selectedLabel: "Selected: none",
  transcript: "Click session row to view entire chat.",
  status: "Ready.",
});

export function useSessionsTab(profile: string | null): {
  profile: string | null;
  sessions: ProfileSession[];
  selectedSessionId: string | null;
  selectedLabel: string;
  transcript: string;
  status: string;
  refresh: () => Promise<void>;
  createSession: () => Promise<void>;
  openSession: (id: string) => Promise<void>;
  renameSession: (id: string) => Promise<void>;
  archiveSession: (id: string) => Promise<void>;
  restoreSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
} {
  const api = useMemo(() => new ApiFetcher(), []);
  const [state, setState] = useState<SessionsState>(() => initialState(profile));

  const setStatus = useCallback((message: string) => {
    setState((prev) => ({ ...prev, status: message }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await api.getProfileSessions(profile);
      setState((prev) => ({ ...prev, list }));
    } catch (cause: unknown) {
      setStatus(`Failed to load sessions: ${getErrorMessage(cause)}`);
    }
  }, [api, profile, setStatus]);

  useSyncExternalStore(
    useCallback(
      (onStoreChange) => {
        setState(() => initialState(profile));
        void refresh().finally(onStoreChange);
        const onProfileChanged = () => void refresh().finally(onStoreChange);
        const onTabShown = () => void refresh().finally(onStoreChange);
        window.addEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
        window.addEventListener(SESSIONS_TAB_SHOWN_EVENT, onTabShown);
        return () => {
          window.removeEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
          window.removeEventListener(SESSIONS_TAB_SHOWN_EVENT, onTabShown);
        };
      },
      [profile, refresh],
    ),
    () => profile ?? "default",
    () => "default",
  );

  const createSession = useCallback(async () => {
    const name = window.prompt("New session name");
    if (name === null) return;
    try {
      await api.postProfileSession(profile, { name });
      await refresh();
      setStatus("Session created.");
    } catch (cause: unknown) {
      setStatus(`Failed to create session: ${getErrorMessage(cause)}`);
    }
  }, [api, profile, refresh, setStatus]);

  const openSession = useCallback(
    async (id: string) => {
      try {
        const detail = await api.getProfileSession(profile, id);
        setState((prev) => ({
          ...prev,
          selectedSessionId: id,
          selectedLabel: `Selected: ${detail.session.name} (${detail.session.id})`,
          transcript: detail.session.chat || "(No chat content found in this session)",
        }));
        setStatus(`Opened "${detail.session.name}".`);
      } catch (cause: unknown) {
        setStatus(`Failed to open session: ${getErrorMessage(cause)}`);
      }
    },
    [api, profile, setStatus],
  );

  const renameSession = useCallback(
    async (id: string) => {
      const nextName = window.prompt("Rename session to");
      if (nextName === null) return;
      try {
        await api.putProfileSessionRename(profile, id, { name: nextName });
        await refresh();
        setStatus("Session renamed.");
      } catch (cause: unknown) {
        setStatus(`Failed to rename session: ${getErrorMessage(cause)}`);
      }
    },
    [api, profile, refresh, setStatus],
  );

  const archiveSession = useCallback(
    async (id: string) => {
      try {
        await api.postProfileSessionArchive(profile, id);
        await refresh();
        setStatus("Session archived.");
      } catch (cause: unknown) {
        setStatus(`Failed to archive session: ${getErrorMessage(cause)}`);
      }
    },
    [api, profile, refresh, setStatus],
  );

  const restoreSession = useCallback(
    async (id: string) => {
      try {
        await api.postProfileSessionRestore(profile, id);
        await refresh();
        setStatus("Session restored.");
      } catch (cause: unknown) {
        setStatus(`Failed to restore session: ${getErrorMessage(cause)}`);
      }
    },
    [api, profile, refresh, setStatus],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this session?")) return;
      try {
        await api.deleteProfileSession(profile, id);
        await refresh();
        setState((prev) => {
          if (prev.selectedSessionId !== id) return prev;
          return {
            ...prev,
            selectedSessionId: null,
            selectedLabel: "Selected: none",
            transcript: "Click session row to view entire chat.",
          };
        });
        setStatus("Session deleted.");
      } catch (cause: unknown) {
        setStatus(`Failed to delete session: ${getErrorMessage(cause)}`);
      }
    },
    [api, profile, refresh, setStatus],
  );

  return {
    profile,
    sessions: state.list.sessions,
    selectedSessionId: state.selectedSessionId,
    selectedLabel: state.selectedLabel,
    transcript: state.transcript,
    status: state.status,
    refresh,
    createSession,
    openSession,
    renameSession,
    archiveSession,
    restoreSession,
    deleteSession,
  };
}
