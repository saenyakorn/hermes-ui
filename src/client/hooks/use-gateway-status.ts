import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  getErrorMessage,
  getGatewayStatus,
  runGatewayAction,
  type GatewayStatus,
} from "../api";

type GatewayAction = "start" | "stop" | "restart";

export function useGatewayStatus(initialStatus: GatewayStatus) {
  const queryClient = useQueryClient();
  const [busyAction, setBusyAction] = useState<GatewayAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["gateway-status"],
    queryFn: getGatewayStatus,
    initialData: initialStatus,
    refetchInterval: 3000,
  });

  const refresh = useCallback(async () => {
    await statusQuery.refetch();
  }, [statusQuery]);

  const runAction = useCallback(
    async (action: GatewayAction) => {
      setBusyAction(action);
      try {
        const nextStatus = await runGatewayAction(action);
        queryClient.setQueryData<GatewayStatus>(["gateway-status"], nextStatus);
        setActionError(null);
      } catch (cause: unknown) {
        setActionError(getErrorMessage(cause));
      } finally {
        setBusyAction(null);
      }
    },
    [queryClient],
  );

  const applyStatus = useCallback(
    (nextStatus: GatewayStatus) => {
      queryClient.setQueryData<GatewayStatus>(["gateway-status"], nextStatus);
      setActionError(null);
    },
    [queryClient],
  );

  const status = statusQuery.data ?? initialStatus;
  const queryError = statusQuery.error
    ? getErrorMessage(statusQuery.error)
    : null;
  const error = actionError ?? queryError;

  return {
    status,
    error,
    busyAction,
    refresh,
    runAction,
    applyStatus,
  };
}
