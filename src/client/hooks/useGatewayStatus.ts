import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GatewayStatus } from "../../server/types";
import { ApiFetcher } from "../api-fetcher";
import { getErrorMessage } from "../lib/errors";
import { dispatchGatewayStatus, GATEWAY_STATUS_EVENT } from "../lib/event";

let lastGatewayStatus: GatewayStatus | null = null;

export function useGatewayStatus(initialStatus: GatewayStatus): {
  status: GatewayStatus;
  error: string | null;
  busy: boolean;
  refresh: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
} {
  const api = useMemo(() => new ApiFetcher(), []);
  const queryClient = useQueryClient();

  const externalStatus = useSyncExternalStore(
    (onStoreChange) => {
      const onStatus = (event: Event) => {
        const customEvent = event as CustomEvent<GatewayStatus>;
        lastGatewayStatus = customEvent.detail ?? null;
        onStoreChange();
      };
      window.addEventListener(GATEWAY_STATUS_EVENT, onStatus);
      return () => window.removeEventListener(GATEWAY_STATUS_EVENT, onStatus);
    },
    () => lastGatewayStatus,
    () => null,
  );

  const statusQuery = useQuery({
    queryKey: ["gateway-status"],
    queryFn: () => api.getGatewayStatus(),
    initialData: initialStatus,
    refetchInterval: 3000,
  });

  const refresh = useCallback(async () => {
    await statusQuery.refetch();
  }, [statusQuery]);

  const actionMutation = useMutation({
    mutationFn: (action: "start" | "stop" | "restart") => api.postGatewayAction(action),
    onSuccess: (next) => {
      queryClient.setQueryData(["gateway-status"], next);
      dispatchGatewayStatus(next);
    },
  });

  const runAction = useCallback(
    async (action: "start" | "stop" | "restart") => {
      await actionMutation.mutateAsync(action);
    },
    [actionMutation],
  );

  return {
    status: externalStatus ?? statusQuery.data ?? initialStatus,
    error: statusQuery.error ? getErrorMessage(statusQuery.error) : null,
    busy: actionMutation.isPending,
    refresh,
    start: async () => runAction("start"),
    stop: async () => runAction("stop"),
    restart: async () => runAction("restart"),
  };
}
