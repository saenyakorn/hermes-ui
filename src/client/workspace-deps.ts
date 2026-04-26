import type { QueryClient } from "@tanstack/query-core";
import type { GatewayStatus } from "../server/types";
import type { ApiFetcher } from "./api-fetcher";
import type { ConfigConfigurator } from "./configurator/config-configurator";
import type { EnvConfigurator } from "./configurator/env-configurator";
import type { WorkspaceIntegrationSync } from "./workspace-integration-sync";

/** Shared services passed into workspace tab modules (messaging, model providers, tabs). */
export type HermesWorkspaceDeps = {
  api: ApiFetcher;
  envConfigurator: EnvConfigurator;
  configConfigurator: ConfigConfigurator;
  integrationSync: WorkspaceIntegrationSync;
  queryClient: QueryClient;
  renderGatewayStatus: (status: GatewayStatus, error: string | null) => void;
};
