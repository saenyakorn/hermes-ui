import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { ConfigValidationIssue } from "../../server/types";
import { ApiFetcher } from "../api-fetcher";
import { getErrorMessage } from "../lib/errors";
import { dispatchGatewayStatus, PROFILE_CHANGED_EVENT } from "../lib/event";

type ConfigState = {
  path: string;
  updatedAt: string | null;
  content: string;
  savedContent: string;
  issues: ConfigValidationIssue[];
  status: string;
  saving: boolean;
  loaded: boolean;
};

const initialState: ConfigState = {
  path: "data/config.yaml",
  updatedAt: null,
  content: "",
  savedContent: "",
  issues: [],
  status: "Loading config...",
  saving: false,
  loaded: false,
};

export function useConfigTab(): {
  path: string;
  updatedAt: string | null;
  content: string;
  issues: ConfigValidationIssue[];
  status: string;
  canSave: boolean;
  onChange: (value: string) => void;
  reload: () => Promise<void>;
  save: () => Promise<void>;
  syncFromServerIfClean: () => Promise<void>;
} {
  const api = useMemo(() => new ApiFetcher(), []);
  const [state, setState] = useState<ConfigState>(initialState);

  const loadFromServer = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "Loading config..." }));
    try {
      const config = await api.getConfigRead();
      setState((prev) => ({
        ...prev,
        path: config.path,
        updatedAt: config.updatedAt,
        content: config.content,
        savedContent: config.content,
        issues: config.validation.issues,
        status: "No unsaved changes.",
        loaded: true,
      }));
    } catch (cause: unknown) {
      setState((prev) => ({ ...prev, status: `Failed to load config: ${getErrorMessage(cause)}` }));
    }
  }, [api]);

  useSyncExternalStore(
    useCallback(
      (onStoreChange) => {
        void loadFromServer().finally(onStoreChange);
        const onProfileChanged = () => {
          void loadFromServer().finally(onStoreChange);
        };
        window.addEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
        return () => window.removeEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
      },
      [loadFromServer],
    ),
    () => 0,
    () => 0,
  );

  const syncFromServerIfClean = useCallback(async () => {
    const dirty = state.content !== state.savedContent;
    if (dirty || !state.loaded) {
      return;
    }
    await loadFromServer();
  }, [loadFromServer, state.content, state.loaded, state.savedContent]);

  const onChange = useCallback((value: string) => {
    setState((prev) => {
      const dirty = value !== prev.savedContent;
      return {
        ...prev,
        content: value,
        status: dirty ? "Unsaved changes." : "No unsaved changes.",
      };
    });
  }, []);

  const reload = useCallback(async () => {
    const dirty = state.content !== state.savedContent;
    if (dirty && !window.confirm("Discard unsaved config changes?")) {
      return;
    }
    await loadFromServer();
  }, [loadFromServer, state.content, state.savedContent]);

  const save = useCallback(async () => {
    const dirty = state.content !== state.savedContent;
    if (!state.loaded || !dirty || state.saving) {
      return;
    }
    setState((prev) => ({ ...prev, saving: true, status: "Saving config..." }));
    try {
      const response = await api.postConfig(state.content);
      dispatchGatewayStatus(response.gateway);
      if (!response.config.saved) {
        setState((prev) => ({
          ...prev,
          path: response.config.path,
          updatedAt: response.config.updatedAt,
          issues: response.config.validation.issues,
          status: "Config validation failed. File was not changed.",
          saving: false,
        }));
        return;
      }

      const restartMessage =
        response.restart.attempted && response.restart.ok
          ? "Config saved. Gateway restarted."
          : response.restart.attempted
            ? `Config saved. Gateway restart failed: ${response.restart.error ?? "Unknown error"}`
            : "Config saved. Gateway was stopped, so no restart was needed.";

      setState((prev) => ({
        ...prev,
        path: response.config.path,
        updatedAt: response.config.updatedAt,
        content: response.config.content,
        savedContent: response.config.content,
        issues: response.config.validation.issues,
        status: restartMessage,
        saving: false,
      }));
    } catch (cause: unknown) {
      setState((prev) => ({
        ...prev,
        status: `Failed to save config: ${getErrorMessage(cause)}`,
        saving: false,
      }));
    }
  }, [api, state.content, state.loaded, state.savedContent, state.saving]);

  return {
    path: state.path,
    updatedAt: state.updatedAt,
    content: state.content,
    issues: state.issues,
    status: state.status,
    canSave: state.loaded && !state.saving && state.content !== state.savedContent,
    onChange,
    reload,
    save,
    syncFromServerIfClean,
  };
}
