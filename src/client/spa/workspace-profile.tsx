import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { dispatchProfileChanged, PROFILE_CHANGED_EVENT } from "../lib/event";

const WORKSPACE_PROFILE_STORAGE_KEY = "hermes.workspace.activeProfile";
const DEFAULT_PROFILE_TOKEN = "__default__";

function readStoredProfile(): string | null {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_PROFILE_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    if (raw === DEFAULT_PROFILE_TOKEN) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

function writeStoredProfile(profile: string | null): void {
  try {
    window.localStorage.setItem(
      WORKSPACE_PROFILE_STORAGE_KEY,
      profile === null ? DEFAULT_PROFILE_TOKEN : profile,
    );
  } catch {
    // Storage is best-effort — UI will fall back to default on next reload.
  }
}

export type WorkspaceProfileApi = {
  /**
   * The profile slug the workspace is currently *viewing*. This is purely a
   * client-side selection — it does not change any server state, and other
   * profiles' gateways are unaffected when it changes.
   */
  profile: string | null;
  /** Updates the viewed profile and persists it to localStorage. */
  setProfile: (next: string | null) => void;
};

const WorkspaceProfileContext = createContext<WorkspaceProfileApi | null>(null);

export type WorkspaceProfileProviderProps = {
  children: ReactNode;
  /**
   * Optional initial profile (e.g. seeded from the server-side legacy
   * `data/.active_profile` marker for upgrade UX continuity).
   */
  initialProfile?: string | null;
};

export function WorkspaceProfileProvider({
  children,
  initialProfile = null,
}: WorkspaceProfileProviderProps) {
  // Defer reading localStorage to a lazy initializer so SSR / non-browser
  // entry points still work. Fall back to the seeded initial value when
  // localStorage hasn't been written yet.
  const [profile, setProfileState] = useState<string | null>(() => {
    const stored = typeof window === "undefined" ? null : readStoredProfile();
    if (stored !== null) {
      return stored;
    }
    if (initialProfile !== null && typeof window !== "undefined") {
      writeStoredProfile(initialProfile);
    }
    return initialProfile;
  });

  const setProfile = useCallback((next: string | null) => {
    setProfileState((prev) => {
      if (prev === next) {
        return prev;
      }
      writeStoredProfile(next);
      dispatchProfileChanged(next);
      return next;
    });
  }, []);

  const value = useMemo<WorkspaceProfileApi>(
    () => ({
      profile,
      setProfile,
    }),
    [profile, setProfile],
  );

  return (
    <WorkspaceProfileContext.Provider value={value}>{children}</WorkspaceProfileContext.Provider>
  );
}

export function useWorkspaceProfile(): WorkspaceProfileApi {
  const ctx = useContext(WorkspaceProfileContext);
  if (!ctx) {
    throw new Error("useWorkspaceProfile must be used within WorkspaceProfileProvider");
  }
  return ctx;
}

/** Hook variant that also reacts to cross-tab `PROFILE_CHANGED_EVENT` events. */
export function useWorkspaceProfileSubscribed(): WorkspaceProfileApi {
  const api = useWorkspaceProfile();
  // We re-render on the same custom event other tabs already dispatch, so a
  // tab firing `dispatchProfileChanged` updates the entire UI consistently.
  useSyncExternalStore(
    useCallback((onStoreChange) => {
      const onChanged = () => onStoreChange();
      window.addEventListener(PROFILE_CHANGED_EVENT, onChanged);
      return () => window.removeEventListener(PROFILE_CHANGED_EVENT, onChanged);
    }, []),
    () => api.profile,
    () => null,
  );
  return api;
}
