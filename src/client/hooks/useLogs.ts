import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { ApiFetcher } from "../api-fetcher";
import { getErrorMessage } from "../lib/errors";

type LogsSnapshot = {
  lines: string[];
  streamError: string | null;
  warning: string | null;
  queryError: string | null;
};

type LogsStore = {
  getSnapshot: () => LogsSnapshot;
  subscribe: (onStoreChange: () => void) => () => void;
  refresh: () => Promise<void>;
  rebind: (profile: string | null) => void;
};

function createLogsStore(api: ApiFetcher): LogsStore {
  let snapshot: LogsSnapshot = {
    lines: [],
    streamError: null,
    warning: null,
    queryError: null,
  };
  let activeProfile: string | null = null;
  const listeners = new Set<() => void>();
  let unsubscribeStream: (() => void) | null = null;
  let bootstrapPromise: Promise<void> | null = null;

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const startStream = () => {
    unsubscribeStream?.();
    unsubscribeStream = api.subscribeLogStream(
      activeProfile,
      (line) => {
        snapshot = {
          ...snapshot,
          streamError: null,
          lines: [...snapshot.lines, line],
        };
        notify();
      },
      (message) => {
        snapshot = { ...snapshot, streamError: message };
        notify();
      },
    );
  };

  const loadTail = async () => {
    try {
      const data = await api.getLogTail(activeProfile);
      snapshot = {
        lines: data.lines,
        streamError: snapshot.streamError,
        warning: data.warning ?? null,
        queryError: null,
      };
      notify();
    } catch (cause: unknown) {
      snapshot = { ...snapshot, queryError: getErrorMessage(cause) };
      notify();
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (onStoreChange) => {
      listeners.add(onStoreChange);
      if (listeners.size === 1) {
        startStream();
      }
      if (!bootstrapPromise) {
        bootstrapPromise = loadTail();
      }
      return () => {
        listeners.delete(onStoreChange);
        if (listeners.size === 0 && unsubscribeStream) {
          unsubscribeStream();
          unsubscribeStream = null;
        }
      };
    },
    refresh: async () => {
      await loadTail();
    },
    rebind: (profile: string | null) => {
      if (profile === activeProfile) {
        return;
      }
      activeProfile = profile;
      snapshot = { lines: [], streamError: null, warning: null, queryError: null };
      bootstrapPromise = loadTail();
      if (listeners.size > 0) {
        startStream();
      }
      notify();
    },
  };
}

export function useLogs(profile: string | null): {
  lines: string;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const api = useMemo(() => new ApiFetcher(), []);
  const storeRef = useRef<LogsStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createLogsStore(api);
    storeRef.current.rebind(profile);
  }
  const store = storeRef.current;

  // The active profile binding for the singleton-per-hook store updates on
  // every render via an effect — we don't want a useEffect-shaped behavior
  // mid-render. This rebinds when the profile changes. (Profile switches are
  // a relatively rare user action.)
  useEffect(() => {
    store.rebind(profile);
  }, [profile, store]);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  return {
    lines: snapshot.lines.join("\n"),
    error: snapshot.streamError ?? snapshot.warning ?? snapshot.queryError,
    refresh: store.refresh,
  };
}
