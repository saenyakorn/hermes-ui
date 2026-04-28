import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { EnvReadResult, GatewayStatus } from "../../server/types";
import { ApiFetcher } from "../api-fetcher";
import { getErrorMessage } from "../lib/errors";
import {
  dispatchGatewayStatus,
  ENV_RELOAD_REQUEST_EVENT,
  ENV_SNAPSHOT_EVENT,
  type EnvSnapshotDetail,
  PROFILE_CHANGED_EVENT,
} from "../lib/event";

type EnvState = {
  path: string;
  updatedAt: string | null;
  entries: EnvReadResult["entries"];
  selectedKey: string;
  key: string;
  value: string;
  status: string;
  busy: boolean;
  loaded: boolean;
};

const initialState: EnvState = {
  path: "data/.env",
  updatedAt: null,
  entries: [],
  selectedKey: "",
  key: "",
  value: "",
  status: "Loading env vars...",
  busy: false,
  loaded: false,
};

export function useEnvTab(): {
  path: string;
  updatedAt: string | null;
  entries: EnvReadResult["entries"];
  key: string;
  value: string;
  status: string;
  canMutate: boolean;
  setKey: (value: string) => void;
  setValue: (value: string) => void;
  setSelectedKey: (value: string) => void;
  reload: () => Promise<void>;
  upsert: () => Promise<void>;
  remove: () => Promise<void>;
} {
  const api = useMemo(() => new ApiFetcher(), []);
  const [state, setState] = useState<EnvState>(initialState);

  const applySnapshot = useCallback((env: EnvReadResult, gateway?: GatewayStatus) => {
    setState((prev) => {
      const selectedExists =
        prev.selectedKey && env.entries.some((entry) => entry.key === prev.selectedKey);
      const selectedKey = selectedExists ? prev.selectedKey : "";
      const nextKey = selectedExists ? prev.key : "";
      return {
        ...prev,
        path: env.path,
        updatedAt: env.updatedAt,
        entries: env.entries,
        selectedKey,
        key: nextKey,
        loaded: true,
      };
    });
    if (gateway) {
      dispatchGatewayStatus(gateway);
    }
  }, []);

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "Loading env vars..." }));
    try {
      const env = await api.getEnvRead();
      applySnapshot(env);
      setState((prev) => ({ ...prev, status: "Select key to update. Values are masked." }));
    } catch (cause: unknown) {
      setState((prev) => ({
        ...prev,
        status: `Failed to load env vars: ${getErrorMessage(cause)}`,
      }));
    }
  }, [api, applySnapshot]);

  useSyncExternalStore(
    useCallback(
      (onStoreChange) => {
        void reload().finally(onStoreChange);
        const onSnapshot = (event: Event) => {
          const customEvent = event as CustomEvent<EnvSnapshotDetail>;
          if (!customEvent.detail) {
            return;
          }
          applySnapshot(customEvent.detail.env, customEvent.detail.gateway);
          setState((prev) => ({ ...prev, status: "Env updated. Gateway restarted." }));
          onStoreChange();
        };
        const onReload = () => {
          void reload().finally(onStoreChange);
        };
        const onProfileChanged = () => {
          void reload().finally(onStoreChange);
        };
        window.addEventListener(ENV_SNAPSHOT_EVENT, onSnapshot);
        window.addEventListener(ENV_RELOAD_REQUEST_EVENT, onReload);
        window.addEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
        return () => {
          window.removeEventListener(ENV_SNAPSHOT_EVENT, onSnapshot);
          window.removeEventListener(ENV_RELOAD_REQUEST_EVENT, onReload);
          window.removeEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
        };
      },
      [applySnapshot, reload],
    ),
    () => 0,
    () => 0,
  );

  const upsert = useCallback(async () => {
    if (!state.loaded || state.busy) {
      return;
    }
    const key = state.key.trim().toUpperCase();
    const value = state.value;
    if (!key || !value) {
      setState((prev) => ({ ...prev, status: "Key and value required." }));
      return;
    }
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      setState((prev) => ({ ...prev, status: "Invalid key. Use A-Z, 0-9, and underscore." }));
      return;
    }
    setState((prev) => ({
      ...prev,
      busy: true,
      status: "Saving env var and restarting gateway...",
    }));
    try {
      const response = await api.postEnvUpsert(key, value);
      applySnapshot(response.env, response.gateway);
      setState((prev) => ({
        ...prev,
        value: "",
        busy: false,
        status: response.restart.ok
          ? "Env updated. Gateway restarted."
          : `Env updated. Gateway restart failed: ${response.restart.error ?? "Unknown error"}`,
      }));
    } catch (cause: unknown) {
      setState((prev) => ({
        ...prev,
        busy: false,
        status: `Failed to save env var: ${getErrorMessage(cause)}`,
      }));
    }
  }, [api, applySnapshot, state.busy, state.key, state.loaded, state.value]);

  const remove = useCallback(async () => {
    if (!state.loaded || state.busy) {
      return;
    }
    const key = state.key.trim().toUpperCase();
    if (!key) {
      setState((prev) => ({ ...prev, status: "Key required to remove." }));
      return;
    }
    if (!window.confirm(`Remove ${key}?`)) {
      return;
    }
    setState((prev) => ({
      ...prev,
      busy: true,
      status: "Removing env var and restarting gateway...",
    }));
    try {
      const response = await api.deleteEnvKey(key);
      applySnapshot(response.env, response.gateway);
      setState((prev) => ({
        ...prev,
        value: "",
        busy: false,
        status: response.restart.ok
          ? "Env updated. Gateway restarted."
          : `Env updated. Gateway restart failed: ${response.restart.error ?? "Unknown error"}`,
      }));
    } catch (cause: unknown) {
      setState((prev) => ({
        ...prev,
        busy: false,
        status: `Failed to remove env var: ${getErrorMessage(cause)}`,
      }));
    }
  }, [api, applySnapshot, state.busy, state.key, state.loaded]);

  return {
    path: state.path,
    updatedAt: state.updatedAt,
    entries: state.entries,
    key: state.key,
    value: state.value,
    status: state.status,
    canMutate: state.loaded && !state.busy,
    setKey: (value: string) => setState((prev) => ({ ...prev, key: value })),
    setValue: (value: string) => setState((prev) => ({ ...prev, value })),
    setSelectedKey: (value: string) =>
      setState((prev) => ({ ...prev, selectedKey: value, key: value, value: "" })),
    reload,
    upsert,
    remove,
  };
}
