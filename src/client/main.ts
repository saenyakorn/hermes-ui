import type { Terminal } from "@xterm/xterm";
import type { GatewayStatus } from "../server/types";
import { ApiFetcher } from "./api-fetcher";
import { gatewayQueryKey, queryClient } from "./app-query";
import { ConfigConfigurator } from "./configurator/config-configurator";
import { EnvConfigurator } from "./configurator/env-configurator";
import { refreshGatewayStatus, renderGatewayStatus, wireGatewayActions } from "./gateway-ui";
import { setupLogs } from "./logs-ui";
import { renderMessagingEnvHint, setupMessagingPlatform } from "./messaging-ui";
import { setupModelProviders } from "./model-providers-ui";
import { setupTerminal } from "./terminal-ui";
import { wireTabs } from "./tabs";
import type { HermesWorkspaceDeps } from "./workspace-deps";
import { WorkspaceIntegrationSync } from "./workspace-integration-sync";

let shellTerminal: Terminal | null = null;

function parseInitialStatus(): GatewayStatus {
  const script = document.querySelector<HTMLScriptElement>("script[data-initial-status]");
  const raw = script?.dataset.initialStatus;
  if (!raw) {
    return {
      state: "stopped",
      health: "unknown",
      pid: null,
      cwd: "-",
      startedAt: null,
      uptimeMs: null,
      exitCode: null,
      lastError: null,
      logWarning: null,
    };
  }

  return JSON.parse(decodeURIComponent(raw)) as GatewayStatus;
}

function main(): void {
  const api = new ApiFetcher();
  const integrationSync = new WorkspaceIntegrationSync(api);

  const envConfigurator = new EnvConfigurator(api, {
    queryClient,
    onGatewayStatus: (status) => {
      renderGatewayStatus(status, null);
    },
    onEnvSnapshot: (env) => {
      renderMessagingEnvHint(env);
      integrationSync.schedulePopulateAfterEnv(env);
    },
  });

  const configConfigurator = new ConfigConfigurator(api, {
    queryClient,
    onGatewayStatus: (status) => {
      renderGatewayStatus(status, null);
    },
  });

  const workspace: HermesWorkspaceDeps = {
    api,
    envConfigurator,
    configConfigurator,
    integrationSync,
    queryClient,
    renderGatewayStatus,
  };

  const initialStatus = parseInitialStatus();
  queryClient.setQueryData(gatewayQueryKey, initialStatus);
  renderGatewayStatus(initialStatus, null);

  wireTabs({
    workspace,
    getShellTerminal: () => shellTerminal,
    getConfigEditor: () => configConfigurator.getEditor(),
  });
  wireGatewayActions(api, queryClient);
  void refreshGatewayStatus(api, queryClient);
  void setupLogs(api, queryClient);
  void configConfigurator.setup();
  shellTerminal = setupTerminal(() => api.getBasicAuthToken());
  void envConfigurator.setup();
  void setupMessagingPlatform(workspace);
  setupModelProviders(workspace);
}

main();
