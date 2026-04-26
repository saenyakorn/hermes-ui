import type { QueryClient } from "@tanstack/query-core";
import type {
  ConfigReadResult,
  ConfigSaveResponse,
  ConfigValidationIssue,
  GatewayStatus,
} from "../../server/types";
import type { ApiFetcher } from "../api-fetcher";
import { gatewayQueryKey } from "../app-query";
import { getErrorMessage } from "../lib/errors";
import { loadMonaco } from "../monaco-loader";

export type ConfigConfiguratorHooks = {
  queryClient: QueryClient;
  onGatewayStatus: (status: GatewayStatus) => void;
};

/** Monaco-backed `data/config.yaml` editor tab. */
export class ConfigConfigurator {
  private editor: import("monaco-editor").editor.IStandaloneCodeEditor | null = null;
  private savedContent: string | null = null;
  private loaded = false;
  private saving = false;

  constructor(
    private readonly api: ApiFetcher,
    private readonly hooks: ConfigConfiguratorHooks,
  ) {}

  getEditor(): import("monaco-editor").editor.IStandaloneCodeEditor | null {
    return this.editor;
  }

  layout(): void {
    this.editor?.layout();
  }

  isDirty(): boolean {
    if (!this.editor || this.savedContent === null) {
      return false;
    }
    return this.editor.getValue() !== this.savedContent;
  }

  private updateSaveState(): void {
    const save = document.getElementById("config-save");
    if (save instanceof HTMLButtonElement) {
      save.disabled = !this.loaded || this.saving || !this.isDirty();
    }
  }

  setStatus(message: string): void {
    const status = document.getElementById("config-status");
    if (status) {
      status.textContent = message;
    }
  }

  renderIssues(issues: ConfigValidationIssue[]): void {
    const host = document.getElementById("config-issues");
    if (!(host instanceof HTMLUListElement)) {
      return;
    }
    host.innerHTML = "";
    for (const issue of issues) {
      const row = document.createElement("li");
      row.textContent = issue.path ? `${issue.path}: ${issue.message}` : issue.message;
      host.append(row);
    }
  }

  renderMeta(config: ConfigReadResult): void {
    const path = document.getElementById("config-path");
    const updatedAt = document.getElementById("config-updated-at");
    if (path) {
      path.textContent = config.path;
    }
    if (updatedAt) {
      updatedAt.textContent = config.updatedAt ? `Updated ${config.updatedAt}` : "Not saved yet";
    }
  }

  private wireButtons(): void {
    const reload = document.getElementById("config-reload");
    const save = document.getElementById("config-save");
    if (reload instanceof HTMLButtonElement) {
      reload.addEventListener("click", () => {
        void this.reloadWithConfirmation();
      });
    }
    if (save instanceof HTMLButtonElement) {
      save.addEventListener("click", () => {
        void this.save();
      });
    }
  }

  async setup(): Promise<void> {
    const container = document.getElementById("config-editor");
    if (!(container instanceof HTMLDivElement)) {
      return;
    }
    this.setStatus("Loading editor...");
    try {
      const monaco = await loadMonaco();
      this.editor = monaco.editor.create(container, {
        value: "",
        language: "yaml",
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
      });
      this.editor.onDidChangeModelContent(() => {
        if (!this.loaded) {
          this.updateSaveState();
          return;
        }
        this.setStatus(this.isDirty() ? "Unsaved changes." : "No unsaved changes.");
        this.updateSaveState();
      });
      this.wireButtons();
      await this.loadFromServer();
    } catch (cause: unknown) {
      this.setStatus(`Failed to initialize config editor: ${getErrorMessage(cause)}`);
    }
  }

  async loadFromServer(): Promise<void> {
    if (!this.editor) {
      return;
    }
    this.loaded = false;
    this.setStatus("Loading config...");
    this.updateSaveState();
    try {
      const config = await this.api.getConfigRead();
      this.savedContent = config.content;
      this.editor.setValue(config.content);
      this.loaded = true;
      this.renderMeta(config);
      this.renderIssues(config.validation.issues);
      this.setStatus("No unsaved changes.");
    } catch (cause: unknown) {
      this.setStatus(`Failed to load config: ${getErrorMessage(cause)}`);
    } finally {
      this.updateSaveState();
    }
  }

  async reloadWithConfirmation(): Promise<void> {
    if (this.loaded && this.isDirty() && !window.confirm("Discard unsaved config changes?")) {
      return;
    }
    await this.loadFromServer();
  }

  async save(): Promise<void> {
    if (!this.editor || !this.loaded || !this.isDirty()) {
      this.updateSaveState();
      return;
    }
    this.saving = true;
    this.setStatus("Saving config...");
    this.updateSaveState();
    try {
      const submittedContent = this.editor.getValue();
      const response: ConfigSaveResponse = await this.api.postConfig(submittedContent);
      this.hooks.onGatewayStatus(response.gateway);
      this.hooks.queryClient.setQueryData(gatewayQueryKey, response.gateway);
      this.renderMeta(response.config);

      if (!response.config.saved) {
        this.renderIssues(response.config.validation.issues);
        this.setStatus("Config validation failed. File was not changed.");
        return;
      }

      this.savedContent = response.config.content;
      this.renderIssues(response.config.validation.issues);
      if (this.editor.getValue() !== response.config.content) {
        this.setStatus("Unsaved changes.");
        return;
      }

      if (response.restart.attempted && response.restart.ok) {
        this.setStatus("Config saved. Gateway restarted.");
      } else if (response.restart.attempted) {
        this.setStatus(
          `Config saved. Gateway restart failed: ${response.restart.error ?? "Unknown error"}`,
        );
      } else {
        this.setStatus("Config saved. Gateway was stopped, so no restart was needed.");
      }
    } catch (cause: unknown) {
      this.setStatus(`Failed to save config: ${getErrorMessage(cause)}`);
    } finally {
      this.saving = false;
      this.updateSaveState();
    }
  }

  async syncFromServerIfClean(): Promise<void> {
    if (!this.editor || !this.loaded || this.isDirty()) {
      return;
    }
    try {
      const config = await this.api.getConfigRead();
      this.savedContent = config.content;
      this.editor.setValue(config.content);
      this.renderMeta(config);
      this.renderIssues(config.validation.issues);
      this.setStatus("No unsaved changes.");
      this.updateSaveState();
    } catch {
      // User can reload from disk on the Hermes config tab if this fails.
    }
  }
}
