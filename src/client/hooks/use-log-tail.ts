import { useCallback, useEffect, useMemo, useState } from "react";
import { getErrorMessage, getLogTail, type LogTail } from "../api";

export function useLogTail() {
  const [logs, setLogs] = useState<LogTail>({ lines: [], warning: null });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLogs(await getLogTail());
      setError(null);
    } catch (cause: unknown) {
      setError(getErrorMessage(cause));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const source = new EventSource(new URL("/logs/stream", window.location.origin));
    source.addEventListener("message", () => {
      void refresh();
    });
    source.addEventListener("error", () => {
      setError("Log stream disconnected.");
    });
    return () => {
      source.close();
    };
  }, [refresh]);

  return useMemo(() => ({ logs, error, refresh }), [error, logs, refresh]);
}
