import { useCallback, useEffect, useMemo, useState } from "react";
import { getErrorMessage, getGatewayStatus, runGatewayAction, type GatewayStatus } from "../api";

type GatewayAction = "start" | "stop" | "restart";

export function useGatewayStatus(initialStatus: GatewayStatus) {
  const [status, setStatus] = useState<GatewayStatus>(initialStatus);
  const [busyAction, setBusyAction] = useState<GatewayAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getGatewayStatus());
      setError(null);
    } catch (cause: unknown) {
      setError(getErrorMessage(cause));
    }
  }, []);

  const runAction = useCallback(
    async (action: GatewayAction) => {
      setBusyAction(action);
      try {
        setStatus(await runGatewayAction(action));
        setError(null);
      } catch (cause: unknown) {
        setError(getErrorMessage(cause));
      } finally {
        setBusyAction(null);
      }
    },
    [],
  );

  const applyStatus = useCallback((nextStatus: GatewayStatus) => {
    setStatus(nextStatus);
    setError(null);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return useMemo(
    () => ({ status, error, busyAction, refresh, runAction, applyStatus }),
    [applyStatus, busyAction, error, refresh, runAction, status],
  );
}
