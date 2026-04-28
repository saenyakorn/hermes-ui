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
import { ProfileFilesUI } from "./profile-files-ui";
import { ProfilesUI } from "./profiles-ui";
import { SessionsUI } from "./sessions-ui";
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

  const profileFilesUI = new ProfileFilesUI(api);
  const sessionsUI = new SessionsUI(api);
  const profilesUI = new ProfilesUI({
    api,
    files: profileFilesUI,
    onProfileChanged: (detail) => {
      if (detail.result) {
        queryClient.setQueryData(gatewayQueryKey, detail.result.gateway);
        renderGatewayStatus(detail.result.gateway, null);
      }
      void configConfigurator.loadFromServer();
      void envConfigurator.loadEnvVars();
      void profileFilesUI.reloadAll();
      sessionsUI.setProfile(detail.active);
      void refreshGatewayStatus(api, queryClient);
      shellTerminal?.dispose();
      const terminalHost = document.getElementById("terminal");
      if (terminalHost instanceof HTMLDivElement) {
        terminalHost.innerHTML = "";
      }
      shellTerminal = setupTerminal(() => api.getBasicAuthToken());
    },
  });

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
  void profileFilesUI.setup();
  void profilesUI.setup();
  void sessionsUI.setup();
}

main();
