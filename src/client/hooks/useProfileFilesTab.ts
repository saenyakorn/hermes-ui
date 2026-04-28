import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { ProfileFileKind } from "../../server/types";
import { ApiFetcher } from "../api-fetcher";
import { getErrorMessage } from "../lib/errors";

export type ProfileFileState = {
  path: string;
  updatedAt: string | null;
  content: string;
  savedContent: string;
  loaded: boolean;
  saving: boolean;
  status: string;
};

export type ProfileFilesState = Record<ProfileFileKind, ProfileFileState>;

const initialFileState = (): ProfileFileState => ({
  path: "",
  updatedAt: null,
  content: "",
  savedContent: "",
  loaded: false,
  saving: false,
  status: "Loading...",
});

const initialState: ProfileFilesState = {
  soul: initialFileState(),
  memory: initialFileState(),
  user: initialFileState(),
};

const KINDS: readonly ProfileFileKind[] = ["soul", "memory", "user"];

export function useProfileFilesTab(activeProfile: string | null): {
  files: ProfileFilesState;
  setContent: (kind: ProfileFileKind, content: string) => void;
  reload: (kind: ProfileFileKind) => Promise<void>;
  save: (kind: ProfileFileKind) => Promise<void>;
} {
  const api = useMemo(() => new ApiFetcher(), []);
  const [files, setFiles] = useState<ProfileFilesState>(initialState);

  const setContent = useCallback((kind: ProfileFileKind, content: string) => {
    setFiles((prev) => ({
      ...prev,
      [kind]: {
        ...prev[kind],
        content,
        status: content === prev[kind].savedContent ? "No unsaved changes." : "Unsaved changes.",
      },
    }));
  }, []);

  const reload = useCallback(
    async (kind: ProfileFileKind) => {
      setFiles((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], loaded: false, status: "Loading..." },
      }));
      try {
        const result = await api.getProfileFile(activeProfile, kind);
        setFiles((prev) => ({
          ...prev,
          [kind]: {
            ...prev[kind],
            path: result.path,
            updatedAt: result.updatedAt,
            content: result.content,
            savedContent: result.content,
            loaded: true,
            status: "No unsaved changes.",
          },
        }));
      } catch (cause: unknown) {
        setFiles((prev) => ({
          ...prev,
          [kind]: {
            ...prev[kind],
            loaded: true,
            status: `Failed to load: ${getErrorMessage(cause)}`,
          },
        }));
      }
    },
    [activeProfile, api],
  );

  const save = useCallback(
    async (kind: ProfileFileKind) => {
      const current = files[kind];
      if (!current.loaded || current.saving || current.content === current.savedContent) {
        return;
      }
      setFiles((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], saving: true, status: "Saving..." },
      }));
      try {
        const result = await api.putProfileFile(activeProfile, kind, current.content);
        setFiles((prev) => {
          const hasNewChanges = prev[kind].content !== result.content;
          return {
            ...prev,
            [kind]: {
              ...prev[kind],
              path: result.path,
              updatedAt: result.updatedAt,
              content: result.content,
              savedContent: result.content,
              saving: false,
              status: hasNewChanges ? "Unsaved changes." : "Saved.",
            },
          };
        });
      } catch (cause: unknown) {
        setFiles((prev) => ({
          ...prev,
          [kind]: {
            ...prev[kind],
            saving: false,
            status: `Failed to save: ${getErrorMessage(cause)}`,
          },
        }));
      }
    },
    [activeProfile, api, files],
  );

  const reloadAll = useCallback(async () => {
    await Promise.all(KINDS.map(async (kind) => reload(kind)));
  }, [reload]);

  useSyncExternalStore(
    useCallback(
      (onStoreChange) => {
        void reloadAll().finally(onStoreChange);
        return () => undefined;
      },
      [reloadAll],
    ),
    () => activeProfile ?? "default",
    () => "default",
  );

  return {
    files,
    setContent,
    reload,
    save,
  };
}
