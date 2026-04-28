import type { ProfileFileKind } from "../server/types";
import type { ApiFetcher } from "./api-fetcher";
import { getErrorMessage } from "./lib/errors";
import { loadMonaco } from "./monaco-loader";

type MonacoEditor = import("monaco-editor").editor.IStandaloneCodeEditor;

const KINDS: readonly ProfileFileKind[] = ["soul", "memory", "user"];

type EditorState = {
  kind: ProfileFileKind;
  editor: MonacoEditor | null;
  loaded: boolean;
  saving: boolean;
  savedContent: string | null;
};

/**
 * Manages Monaco markdown editors for `SOUL.md`, `memories/MEMORY.md`, and
 * `memories/USER.md`. Always reads / writes the currently active profile.
 */
export class ProfileFilesUI {
  private readonly states = new Map<ProfileFileKind, EditorState>();
  private profile: string | null = null;

  constructor(private readonly api: ApiFetcher) {
    for (const kind of KINDS) {
      this.states.set(kind, {
        kind,
        editor: null,
        loaded: false,
        saving: false,
        savedContent: null,
      });
    }
  }

  /** Targets the supplied profile (null = default) for subsequent loads/saves. */
  setProfile(profile: string | null): void {
    this.profile = profile;
  }

  async setup(): Promise<void> {
    const monaco = await loadMonaco();
    for (const kind of KINDS) {
      const state = this.requireState(kind);
      const container = document.querySelector<HTMLDivElement>(
        `[data-profile-file-editor="${kind}"]`,
      );
      if (!container) {
        continue;
      }
      const editor = monaco.editor.create(container, {
        value: "",
        language: "markdown",
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
      });
      state.editor = editor;
      editor.onDidChangeModelContent(() => {
        if (!state.loaded) {
          return;
        }
        this.updateSaveButton(state);
        this.setStatus(state, this.isDirty(state) ? "Unsaved changes." : "No unsaved changes.");
      });

      this.wireButtons(kind);
    }

    await this.reloadAll();
  }

  /** Reloads every file from the server (typically after a profile switch). */
  async reloadAll(): Promise<void> {
    await Promise.all(KINDS.map((kind) => this.reload(kind)));
  }

  private wireButtons(kind: ProfileFileKind): void {
    const reload = document.querySelector<HTMLButtonElement>(
      `[data-profile-file-reload="${kind}"]`,
    );
    const save = document.querySelector<HTMLButtonElement>(`[data-profile-file-save="${kind}"]`);
    reload?.addEventListener("click", () => {
      void this.reloadWithConfirmation(kind);
    });
    save?.addEventListener("click", () => {
      void this.save(kind);
    });
  }

  private async reloadWithConfirmation(kind: ProfileFileKind): Promise<void> {
    const state = this.requireState(kind);
    if (state.loaded && this.isDirty(state) && !window.confirm("Discard unsaved changes?")) {
      return;
    }
    await this.reload(kind);
  }

  private async reload(kind: ProfileFileKind): Promise<void> {
    const state = this.requireState(kind);
    if (!state.editor) {
      return;
    }
    state.loaded = false;
    this.setStatus(state, "Loading...");
    this.updateSaveButton(state);
    try {
      const result = await this.api.getProfileFile(this.profile, kind);
      state.savedContent = result.content;
      state.editor.setValue(result.content);
      state.loaded = true;
      this.setPath(kind, result.path, result.updatedAt);
      this.setStatus(state, "No unsaved changes.");
    } catch (cause: unknown) {
      this.setStatus(state, `Failed to load: ${getErrorMessage(cause)}`);
    } finally {
      this.updateSaveButton(state);
    }
  }

  private async save(kind: ProfileFileKind): Promise<void> {
    const state = this.requireState(kind);
    if (!state.editor || !state.loaded || state.saving || !this.isDirty(state)) {
      return;
    }
    state.saving = true;
    this.setStatus(state, "Saving...");
    this.updateSaveButton(state);
    try {
      const submitted = state.editor.getValue();
      const result = await this.api.putProfileFile(this.profile, kind, submitted);
      state.savedContent = result.content;
      this.setPath(kind, result.path, result.updatedAt);
      if (state.editor.getValue() === result.content) {
        this.setStatus(state, "Saved.");
      } else {
        this.setStatus(state, "Unsaved changes.");
      }
    } catch (cause: unknown) {
      this.setStatus(state, `Failed to save: ${getErrorMessage(cause)}`);
    } finally {
      state.saving = false;
      this.updateSaveButton(state);
    }
  }

  private isDirty(state: EditorState): boolean {
    if (!state.editor || state.savedContent === null) {
      return false;
    }
    return state.editor.getValue() !== state.savedContent;
  }

  private updateSaveButton(state: EditorState): void {
    const save = document.querySelector<HTMLButtonElement>(
      `[data-profile-file-save="${state.kind}"]`,
    );
    if (!save) {
      return;
    }
    save.disabled = !state.loaded || state.saving || !this.isDirty(state);
  }

  private setStatus(state: EditorState, message: string): void {
    const status = document.querySelector<HTMLElement>(
      `[data-profile-file-status="${state.kind}"]`,
    );
    if (status) {
      status.textContent = message;
    }
  }

  private setPath(kind: ProfileFileKind, fullPath: string, updatedAt: string | null): void {
    const path = document.querySelector<HTMLElement>(`[data-profile-file-path="${kind}"]`);
    if (path) {
      path.textContent = updatedAt ? `${fullPath} (updated ${updatedAt})` : fullPath;
    }
  }

  private requireState(kind: ProfileFileKind): EditorState {
    const state = this.states.get(kind);
    if (!state) {
      throw new Error(`Unknown profile file kind: ${kind}`);
    }
    return state;
  }
}
