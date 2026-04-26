import type { QueryClient } from "@tanstack/query-core";
import type { EnvMutationResponse, EnvReadResult, GatewayStatus } from "../../server/types";
import type { ApiFetcher } from "../api-fetcher";
import { gatewayQueryKey } from "../app-query";
import { getErrorMessage } from "../lib/errors";

export type EnvConfiguratorHooks = {
  queryClient: QueryClient;
  onGatewayStatus: (status: GatewayStatus) => void;
  onEnvSnapshot: (env: EnvReadResult) => void;
};

/** Hermes `.env` editor tab: load, upsert, remove, list rendering. */
export class EnvConfigurator {
  private loaded = false;
  private busy = false;

  constructor(
    private readonly api: ApiFetcher,
    private readonly hooks: EnvConfiguratorHooks,
  ) {}

  renderMeta(env: EnvReadResult): void {
    const path = document.getElementById("env-path");
    const updatedAt = document.getElementById("env-updated-at");
    if (path) {
      path.textContent = env.path;
    }
    if (updatedAt) {
      updatedAt.textContent = env.updatedAt ? `Updated ${env.updatedAt}` : "Not saved yet";
    }
  }

  renderList(entries: EnvReadResult["entries"]): void {
    const list = document.getElementById("env-list");
    if (!(list instanceof HTMLSelectElement)) {
      return;
    }
    const selectedKey = list.value;
    list.innerHTML = "";
    for (const entry of entries) {
      const option = document.createElement("option");
      option.value = entry.key;
      option.textContent = `${entry.key}=${entry.maskedValue}`;
      list.append(option);
    }
    if (selectedKey && entries.some((entry) => entry.key === selectedKey)) {
      list.value = selectedKey;
    }
  }

  setStatus(message: string): void {
    const status = document.getElementById("env-status");
    if (status) {
      status.textContent = message;
    }
  }

  private updateButtons(): void {
    const save = document.getElementById("env-save");
    const remove = document.getElementById("env-remove");
    if (save instanceof HTMLButtonElement) {
      save.disabled = !this.loaded || this.busy;
    }
    if (remove instanceof HTMLButtonElement) {
      remove.disabled = !this.loaded || this.busy;
    }
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.updateButtons();
  }

  private getEnvInput(): { key: string; value: string } | null {
    const keyInput = document.getElementById("env-key-input");
    const valueInput = document.getElementById("env-value-input");
    if (!(keyInput instanceof HTMLInputElement) || !(valueInput instanceof HTMLInputElement)) {
      return null;
    }
    const key = keyInput.value.trim().toUpperCase();
    const value = valueInput.value;
    return { key, value };
  }

  /** Updates env list/meta, gateway cache, and workspace integration populates (no env tab status line). */
  reflectGatewayAndEnvSnapshot(env: EnvReadResult, gateway: GatewayStatus): void {
    this.renderMeta(env);
    this.renderList(env.entries);
    this.hooks.onGatewayStatus(gateway);
    this.hooks.queryClient.setQueryData(gatewayQueryKey, gateway);
    this.hooks.onEnvSnapshot(env);
  }

  applyMutationResponse(response: EnvMutationResponse): void {
    this.reflectGatewayAndEnvSnapshot(response.env, response.gateway);
    if (response.restart.ok) {
      this.setStatus("Env updated. Gateway restarted.");
      return;
    }
    this.setStatus(
      `Env updated. Gateway restart failed: ${response.restart.error ?? "Unknown error"}`,
    );
  }

  wireButtons(): void {
    const reload = document.getElementById("env-reload");
    const save = document.getElementById("env-save");
    const remove = document.getElementById("env-remove");
    const list = document.getElementById("env-list");
    const keyInput = document.getElementById("env-key-input");
    const valueInput = document.getElementById("env-value-input");

    if (reload instanceof HTMLButtonElement) {
      reload.addEventListener("click", () => {
        void this.loadEnvVars();
      });
    }
    if (save instanceof HTMLButtonElement) {
      save.addEventListener("click", () => {
        void this.upsertEnvVar();
      });
    }
    if (remove instanceof HTMLButtonElement) {
      remove.addEventListener("click", () => {
        void this.removeEnvVar();
      });
    }
    if (
      list instanceof HTMLSelectElement &&
      keyInput instanceof HTMLInputElement &&
      valueInput instanceof HTMLInputElement
    ) {
      list.addEventListener("change", () => {
        keyInput.value = list.value;
        valueInput.value = "";
      });
    }
  }

  async loadEnvVars(): Promise<void> {
    this.loaded = false;
    this.setStatus("Loading env vars...");
    this.updateButtons();
    try {
      const env = await this.api.getEnvRead();
      this.renderMeta(env);
      this.renderList(env.entries);
      this.hooks.onEnvSnapshot(env);
      this.loaded = true;
      this.setStatus("Select key to update. Values are masked.");
    } catch (cause: unknown) {
      this.setStatus(`Failed to load env vars: ${getErrorMessage(cause)}`);
    } finally {
      this.updateButtons();
    }
  }

  async upsertEnvVar(): Promise<void> {
    if (!this.loaded || this.busy) {
      return;
    }
    const input = this.getEnvInput();
    if (!input) {
      return;
    }
    if (!input.key || !input.value) {
      this.setStatus("Key and value required.");
      return;
    }
    if (!/^[A-Z_][A-Z0-9_]*$/.test(input.key)) {
      this.setStatus("Invalid key. Use A-Z, 0-9, and underscore.");
      return;
    }
    this.setBusy(true);
    this.setStatus("Saving env var and restarting gateway...");
    try {
      const response = await this.api.postEnvUpsert(input.key, input.value);
      this.applyMutationResponse(response);
      const valueInput = document.getElementById("env-value-input");
      if (valueInput instanceof HTMLInputElement) {
        valueInput.value = "";
      }
    } catch (cause: unknown) {
      this.setStatus(`Failed to save env var: ${getErrorMessage(cause)}`);
    } finally {
      this.setBusy(false);
    }
  }

  async removeEnvVar(): Promise<void> {
    if (!this.loaded || this.busy) {
      return;
    }
    const input = this.getEnvInput();
    if (!input || !input.key) {
      this.setStatus("Key required to remove.");
      return;
    }
    if (!window.confirm(`Remove ${input.key}?`)) {
      return;
    }
    this.setBusy(true);
    this.setStatus("Removing env var and restarting gateway...");
    try {
      const response = await this.api.deleteEnvKey(input.key);
      this.applyMutationResponse(response);
      const valueInput = document.getElementById("env-value-input");
      if (valueInput instanceof HTMLInputElement) {
        valueInput.value = "";
      }
    } catch (cause: unknown) {
      this.setStatus(`Failed to remove env var: ${getErrorMessage(cause)}`);
    } finally {
      this.setBusy(false);
    }
  }

  async setup(): Promise<void> {
    this.wireButtons();
    await this.loadEnvVars();
  }
}
