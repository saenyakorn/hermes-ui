import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type {
  GatewayProfileSummary,
  GatewayStatus,
  GatewaysSummary,
  ProfileCreateMode,
  ProfileListResult,
  ProfileSummary,
} from "../../server/types";
import { ApiFetcher } from "../api-fetcher";
import { getErrorMessage } from "../lib/errors";
import {
  dispatchGatewayStatus,
  GATEWAY_STATUS_EVENT,
  GATEWAYS_SUMMARY_EVENT,
  PROFILES_TAB_SHOWN_EVENT,
} from "../lib/event";

type ProfilesState = {
  list: ProfileListResult;
  /** Map of profile slug ("default" for null) -> latest gateway status. */
  gatewaySummaries: Record<string, GatewayProfileSummary>;
  status: string;
  busyProfile: string | null;
};

const profileKey = (profile: string | null): string => (profile === null ? "default" : profile);

function buildInitialState(initialSummary?: GatewaysSummary): ProfilesState {
  return {
    list: { active: null, profiles: [], warning: null },
    gatewaySummaries: initialSummary ? summaryRecord(initialSummary) : {},
    status: "Ready.",
    busyProfile: null,
  };
}

export type ProfileWorkspaceApi = {
  list: ProfileListResult;
  /** All gateways' latest status, indexed by slug ("default" for null). */
  gatewaySummaries: Record<string, GatewayProfileSummary>;
  status: string;
  /** Profile slug currently mid-lifecycle action (UI disable hint). */
  busyProfile: string | null;
  refresh: () => Promise<void>;
  refreshGateways: () => Promise<void>;
  start: (profile: string | null) => Promise<GatewayStatus | null>;
  stop: (profile: string | null) => Promise<GatewayStatus | null>;
  restart: (profile: string | null) => Promise<GatewayStatus | null>;
  createProfile: (input: {
    name: string;
    mode: ProfileCreateMode;
    cloneFrom?: string;
  }) => Promise<void>;
  renameTo: (from: string, to: string) => Promise<void>;
  removeConfirmed: (name: string) => Promise<void>;
  pickerOptions: ProfileSummary[];
};

function summaryRecord(summary: GatewaysSummary): Record<string, GatewayProfileSummary> {
  return Object.fromEntries(summary.gateways.map((entry) => [profileKey(entry.profile), entry]));
}

export type UseProfilesTabOptions = {
  /** Server-rendered gateway summary used to seed first paint. */
  initialSummary?: GatewaysSummary;
};

export function useProfilesTab(options: UseProfilesTabOptions = {}): ProfileWorkspaceApi {
  const api = useMemo(() => new ApiFetcher(), []);
  const [state, setState] = useState<ProfilesState>(() => buildInitialState(options.initialSummary));

  const setStatus = useCallback((message: string) => {
    setState((prev) => ({ ...prev, status: message }));
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const list = await api.getProfiles();
      setState((prev) => ({ ...prev, list }));
    } catch (cause: unknown) {
      setStatus(`Failed to load profiles: ${getErrorMessage(cause)}`);
    }
  }, [api, setStatus]);

  const refreshGateways = useCallback(async () => {
    try {
      const summary = await api.getGateways();
      setState((prev) => ({ ...prev, gatewaySummaries: summaryRecord(summary) }));
      window.dispatchEvent(
        new CustomEvent<GatewaysSummary>(GATEWAYS_SUMMARY_EVENT, { detail: summary }),
      );
    } catch (cause: unknown) {
      setStatus(`Failed to load gateway status: ${getErrorMessage(cause)}`);
    }
  }, [api, setStatus]);

  const refresh = useCallback(async () => {
    await Promise.all([refreshList(), refreshGateways()]);
  }, [refreshList, refreshGateways]);

  useSyncExternalStore(
    useCallback(
      (onStoreChange) => {
        void refresh().finally(onStoreChange);
        const onTabShown = () => void refresh().finally(onStoreChange);
        const onGatewayStatus = (event: Event) => {
          const customEvent = event as CustomEvent<GatewayStatus>;
          const status = customEvent.detail;
          if (!status) return;
          // We don't know the profile from a bare GatewayStatus dispatch — so
          // schedule a summary refresh. This event is also fired by tab-local
          // mutations where the profile is implicit in the active view.
          void refreshGateways().finally(onStoreChange);
        };
        const interval = window.setInterval(() => {
          void refreshGateways();
        }, 3000);
        window.addEventListener(PROFILES_TAB_SHOWN_EVENT, onTabShown);
        window.addEventListener(GATEWAY_STATUS_EVENT, onGatewayStatus);
        return () => {
          window.clearInterval(interval);
          window.removeEventListener(PROFILES_TAB_SHOWN_EVENT, onTabShown);
          window.removeEventListener(GATEWAY_STATUS_EVENT, onGatewayStatus);
        };
      },
      [refresh, refreshGateways],
    ),
    () => 0,
    () => 0,
  );

  const runLifecycleAction = useCallback(
    async (
      profile: string | null,
      action: "start" | "stop" | "restart",
    ): Promise<GatewayStatus | null> => {
      const slug = profileKey(profile);
      setState((prev) => ({ ...prev, busyProfile: slug }));
      try {
        const next = await api.postGatewayAction(profile, action);
        dispatchGatewayStatus(next);
        await refreshGateways();
        const label = profile === null ? "default" : `"${profile}"`;
        setStatus(`Gateway ${action} for ${label} ok.`);
        return next;
      } catch (cause: unknown) {
        setStatus(`Gateway ${action} failed: ${getErrorMessage(cause)}`);
        return null;
      } finally {
        setState((prev) => (prev.busyProfile === slug ? { ...prev, busyProfile: null } : prev));
      }
    },
    [api, refreshGateways, setStatus],
  );

  const start = useCallback(
    (profile: string | null) => runLifecycleAction(profile, "start"),
    [runLifecycleAction],
  );
  const stop = useCallback(
    (profile: string | null) => runLifecycleAction(profile, "stop"),
    [runLifecycleAction],
  );
  const restart = useCallback(
    (profile: string | null) => runLifecycleAction(profile, "restart"),
    [runLifecycleAction],
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
        await refreshGateways();
      } catch (cause: unknown) {
        setStatus(`Failed to create: ${getErrorMessage(cause)}`);
      }
    },
    [api, refreshGateways, setStatus],
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
        await refreshGateways();
      } catch (cause: unknown) {
        setStatus(`Failed to rename: ${getErrorMessage(cause)}`);
      }
    },
    [api, refreshGateways, setStatus],
  );

  const removeConfirmed = useCallback(
    async (name: string) => {
      try {
        const result = await api.deleteProfile(name);
        setState((prev) => ({ ...prev, list: result.list, status: `Deleted profile "${name}".` }));
        await refreshGateways();
      } catch (cause: unknown) {
        setStatus(`Failed to delete: ${getErrorMessage(cause)}`);
      }
    },
    [api, refreshGateways, setStatus],
  );

  return useMemo(
    (): ProfileWorkspaceApi => ({
      list: state.list,
      gatewaySummaries: state.gatewaySummaries,
      status: state.status,
      busyProfile: state.busyProfile,
      refresh,
      refreshGateways,
      start,
      stop,
      restart,
      createProfile,
      renameTo,
      removeConfirmed,
      pickerOptions: state.list.profiles,
    }),
    [
      state.list,
      state.gatewaySummaries,
      state.status,
      state.busyProfile,
      refresh,
      refreshGateways,
      start,
      stop,
      restart,
      createProfile,
      renameTo,
      removeConfirmed,
    ],
  );
}
