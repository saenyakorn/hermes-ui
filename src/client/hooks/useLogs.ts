import { useMemo, useSyncExternalStore } from "react";
import { ApiFetcher } from "../api-fetcher";
import { getErrorMessage } from "../lib/errors";

type LogsSnapshot = {
  lines: string[];
  streamError: string | null;
  warning: string | null;
  queryError: string | null;
};

function createLogsStore(api: ApiFetcher) {
  let snapshot: LogsSnapshot = {
    lines: [],
    streamError: null,
    warning: null,
    queryError: null,
  };
  const listeners = new Set<() => void>();
  let unsubscribeStream: (() => void) | null = null;
  let bootstrapPromise: Promise<void> | null = null;

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const startStream = () => {
    if (unsubscribeStream) {
      return;
    }
    unsubscribeStream = api.subscribeLogStream(
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
      const data = await api.getLogTail();
      snapshot = {
        ...snapshot,
        lines: data.lines,
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
    subscribe: (onStoreChange: () => void) => {
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
  };
}

export function useLogs(): {
  lines: string;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const api = useMemo(() => new ApiFetcher(), []);
  const store = useMemo(() => createLogsStore(api), [api]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  return {
    lines: snapshot.lines.join("\n"),
    error: snapshot.streamError ?? snapshot.warning ?? snapshot.queryError,
    refresh: store.refresh,
  };
}
