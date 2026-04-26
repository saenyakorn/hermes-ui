import type { EnvReadResult, WorkspaceConfigHints } from "../server/types";
import type { ApiFetcher } from "./api-fetcher";
import {
  populateMessagingIntegrationFields,
  populateModelProvidersIntegrationFields,
} from "./workspace-field-sources";

/**
 * Syncs messaging + model-provider form fields from .env + config hints (two-pass for password managers).
 */
export class WorkspaceIntegrationSync {
  constructor(private readonly api: ApiFetcher) {}

  populateAllFromEnv(env: EnvReadResult, hints: WorkspaceConfigHints | null): void {
    populateMessagingIntegrationFields(env, hints);
    populateModelProvidersIntegrationFields(env, hints);
  }

  schedulePopulateAfterEnv(env: EnvReadResult): void {
    void (async () => {
      let hints: WorkspaceConfigHints | null = null;
      try {
        hints = await this.api.getWorkspaceConfigHints();
      } catch {
        // Leave hints null; do not overwrite config-driven fields without server data.
      }
      this.populateAllFromEnv(env, hints);
      requestAnimationFrame(() => {
        this.populateAllFromEnv(env, hints);
      });
    })();
  }
}
