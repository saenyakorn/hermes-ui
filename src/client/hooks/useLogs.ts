import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiFetcher } from "../api-fetcher";
import { getErrorMessage } from "../lib/errors";

export function useLogs(): {
  lines: string;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const api = useMemo(() => new ApiFetcher(), []);
  const logsQuery = useQuery({
    queryKey: ["logs-tail"],
    queryFn: () => api.getLogTail(),
    refetchInterval: 1500,
  });

  const refresh = useCallback(async () => {
    await logsQuery.refetch();
  }, [logsQuery]);

  return {
    lines: (logsQuery.data?.lines ?? []).join("\n"),
    error: logsQuery.data?.warning ?? (logsQuery.error ? getErrorMessage(logsQuery.error) : null),
    refresh,
  };
}
