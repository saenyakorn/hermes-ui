import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type {
  ProfileActivateResult,
  ProfileCreateMode,
  ProfileListResult,
  ProfileSummary,
} from "../../server/types";
import { ApiFetcher } from "../api-fetcher";
import { getErrorMessage } from "../lib/errors";
import {
  dispatchGatewayStatus,
  dispatchProfileChanged,
  PROFILES_TAB_SHOWN_EVENT,
} from "../lib/event";

type ProfilesState = {
  list: ProfileListResult;
  status: string;
};

const initialState: ProfilesState = {
  list: { active: null, profiles: [], warning: null },
  status: "Ready.",
};

export function useProfilesTab(): {
  list: ProfileListResult;
  status: string;
  refresh: () => Promise<void>;
  activate: (name: string | null) => Promise<void>;
  create: () => Promise<void>;
  rename: (name: string) => Promise<void>;
  remove: (name: string) => Promise<void>;
  pickerValue: string;
  pickerOptions: ProfileSummary[];
} {
  const api = useMemo(() => new ApiFetcher(), []);
  const [state, setState] = useState<ProfilesState>(initialState);

  const setStatus = useCallback((message: string) => {
    setState((prev) => ({ ...prev, status: message }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await api.getProfiles();
      setState((prev) => ({ ...prev, list }));
    } catch (cause: unknown) {
      setStatus(`Failed to load profiles: ${getErrorMessage(cause)}`);
    }
  }, [api, setStatus]);

  useSyncExternalStore(
    useCallback(
      (onStoreChange) => {
        void refresh().finally(onStoreChange);
        const onTabShown = () => void refresh().finally(onStoreChange);
        window.addEventListener(PROFILES_TAB_SHOWN_EVENT, onTabShown);
        return () => {
          window.removeEventListener(PROFILES_TAB_SHOWN_EVENT, onTabShown);
        };
      },
      [refresh],
    ),
    () => 0,
    () => 0,
  );

  const formatActivateMessage = (result: ProfileActivateResult): string => {
    const label = result.active === null ? "default" : `"${result.active}"`;
    if (result.restart.attempted && result.restart.ok) {
      return `Activated ${label}. Gateway restarted.`;
    }
    if (result.restart.attempted) {
      return `Activated ${label}. Gateway restart failed: ${result.restart.error ?? "unknown error"}`;
    }
    return `Activated ${label}.`;
  };

  const activate = useCallback(
    async (name: string | null) => {
      if (name === state.list.active) return;
      try {
        const result = await api.postProfileActivate(name);
        dispatchGatewayStatus(result.gateway);
        setState((prev) => ({ ...prev, list: result.list }));
        dispatchProfileChanged(result.active);
        setStatus(formatActivateMessage(result));
      } catch (cause: unknown) {
        setStatus(`Failed to activate: ${getErrorMessage(cause)}`);
      }
    },
    [api, setStatus, state.list.active],
  );

  const create = useCallback(async () => {
    const name = window.prompt("New profile name");
    if (name === null) return;
    const mode = (window.prompt('Mode: "blank" | "clone" | "clone-all"', "blank") ??
      "blank") as ProfileCreateMode;
    const cloneFrom = window.prompt("Clone from (optional)");
    try {
      const payload: { name: string; mode: ProfileCreateMode; cloneFrom?: string } = {
        name: name.trim(),
        mode,
      };
      if (cloneFrom && cloneFrom.trim()) payload.cloneFrom = cloneFrom.trim();
      const result = await api.postProfile(payload);
      setState((prev) => ({
        ...prev,
        list: result.list,
        status: `Created profile "${name.trim()}".`,
      }));
    } catch (cause: unknown) {
      setStatus(`Failed to create: ${getErrorMessage(cause)}`);
    }
  }, [api, setStatus]);

  const rename = useCallback(
    async (name: string) => {
      const to = window.prompt(`Rename "${name}" to`);
      if (to === null) return;
      try {
        const result = await api.putProfileRename(name, to.trim());
        setState((prev) => ({
          ...prev,
          list: result.list,
          status: `Renamed "${name}" -> "${to.trim()}".`,
        }));
      } catch (cause: unknown) {
        setStatus(`Failed to rename: ${getErrorMessage(cause)}`);
      }
    },
    [api, setStatus],
  );

  const remove = useCallback(
    async (name: string) => {
      const typed = window.prompt(`Type profile name "${name}" to confirm delete.`);
      if (typed === null || typed.trim() !== name) {
        setStatus("Profile name mismatch. Delete cancelled.");
        return;
      }
      try {
        const result = await api.deleteProfile(name);
        setState((prev) => ({ ...prev, list: result.list, status: `Deleted profile "${name}".` }));
      } catch (cause: unknown) {
        setStatus(`Failed to delete: ${getErrorMessage(cause)}`);
      }
    },
    [api, setStatus],
  );

  return {
    list: state.list,
    status: state.status,
    refresh,
    activate,
    create,
    rename,
    remove,
    pickerValue: state.list.active ?? "default",
    pickerOptions: state.list.profiles,
  };
}
