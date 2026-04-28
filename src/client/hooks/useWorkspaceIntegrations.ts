import { useCallback, useMemo, useState } from "react";
import type { EnvReadResult, WorkspaceConfigHints } from "../../server/types";
import { ApiFetcher } from "../api-fetcher";
import {
  resolveAllWorkspaceIntegrationFieldValues,
  type IntegrationFieldValues,
} from "./useWorkspaceFieldSources";

export function useWorkspaceIntegrations(): {
  fieldValues: IntegrationFieldValues;
  refresh: () => Promise<{ env: EnvReadResult; hints: WorkspaceConfigHints | null } | null>;
  setFieldValue: (id: string, value: string) => void;
  setFieldValues: (values: IntegrationFieldValues) => void;
} {
  const api = useMemo(() => new ApiFetcher(), []);
  const [fieldValues, setFieldValuesState] = useState<IntegrationFieldValues>({});

  const setFieldValue = useCallback((id: string, value: string) => {
    setFieldValuesState((prev) => ({ ...prev, [id]: value }));
  }, []);

  const setFieldValues = useCallback((values: IntegrationFieldValues) => {
    setFieldValuesState((prev) => ({ ...prev, ...values }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const env = await api.getEnvRead();
      let hints: WorkspaceConfigHints | null = null;
      try {
        hints = await api.getWorkspaceConfigHints();
      } catch {
        // keep null hints
      }
      setFieldValuesState(resolveAllWorkspaceIntegrationFieldValues(env, hints));
      return { env, hints };
    } catch {
      return null;
    }
  }, [api]);

  return { fieldValues, refresh, setFieldValue, setFieldValues };
}
