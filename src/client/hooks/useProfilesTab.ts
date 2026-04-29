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
  PROFILE_CHANGED_EVENT,
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

export type ProfileWorkspaceApi = {
  list: ProfileListResult;
  /** Active profile slug; `null` = default profile at data root. */
  activeProfile: string | null;
  status: string;
  refresh: () => Promise<void>;
  activate: (name: string | null) => Promise<void>;
  createProfile: (input: {
    name: string;
    mode: ProfileCreateMode;
    cloneFrom?: string;
  }) => Promise<void>;
  renameTo: (from: string, to: string) => Promise<void>;
  removeConfirmed: (name: string) => Promise<void>;
  pickerValue: string;
  pickerOptions: ProfileSummary[];
};

export function useProfilesTab(): ProfileWorkspaceApi {
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
        const onProfileChanged = () => void refresh().finally(onStoreChange);
        window.addEventListener(PROFILES_TAB_SHOWN_EVENT, onTabShown);
        window.addEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
        return () => {
          window.removeEventListener(PROFILES_TAB_SHOWN_EVENT, onTabShown);
          window.removeEventListener(PROFILE_CHANGED_EVENT, onProfileChanged);
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

  const createProfile = useCallback(
    async (input: { name: string; mode: ProfileCreateMode; cloneFrom?: string }) => {
      const trimmed = input.name.trim();
      if (!trimmed) {
        setStatus("Profile name required.");
        return;
      }
      try {
        const payload: { name: string; mode: ProfileCreateMode; cloneFrom?: string } = {
          name: trimmed,
          mode: input.mode,
        };
        if (input.cloneFrom?.trim()) payload.cloneFrom = input.cloneFrom.trim();
        const result = await api.postProfile(payload);
        setState((prev) => ({
          ...prev,
          list: result.list,
          status: `Created profile "${trimmed}".`,
        }));
      } catch (cause: unknown) {
        setStatus(`Failed to create: ${getErrorMessage(cause)}`);
      }
    },
    [api, setStatus],
  );

  const renameTo = useCallback(
    async (from: string, to: string) => {
      const next = to.trim();
      if (!next) {
        setStatus("New name required.");
        return;
      }
      try {
        const result = await api.putProfileRename(from, next);
        setState((prev) => ({
          ...prev,
          list: result.list,
          status: `Renamed "${from}" -> "${next}".`,
        }));
      } catch (cause: unknown) {
        setStatus(`Failed to rename: ${getErrorMessage(cause)}`);
      }
    },
    [api, setStatus],
  );

  const removeConfirmed = useCallback(
    async (name: string) => {
      try {
        const result = await api.deleteProfile(name);
        setState((prev) => ({ ...prev, list: result.list, status: `Deleted profile "${name}".` }));
      } catch (cause: unknown) {
        setStatus(`Failed to delete: ${getErrorMessage(cause)}`);
      }
    },
    [api, setStatus],
  );

  return useMemo(
    (): ProfileWorkspaceApi => ({
      list: state.list,
      activeProfile: state.list.active,
      status: state.status,
      refresh,
      activate,
      createProfile,
      renameTo,
      removeConfirmed,
      pickerValue: state.list.active ?? "default",
      pickerOptions: state.list.profiles,
    }),
    [state.list, state.status, refresh, activate, createProfile, renameTo, removeConfirmed],
  );
}
