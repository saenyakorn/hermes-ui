import { hydrateRoot } from "react-dom/client";
import type { GatewayStatus } from "./api";
import { App } from "./components/app";

function parseInitialStatus(value: string | undefined): GatewayStatus {
  if (!value) {
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

  return JSON.parse(decodeURIComponent(value)) as GatewayStatus;
}

const rootElement = document.body.firstElementChild;
if (rootElement instanceof HTMLElement) {
  hydrateRoot(rootElement, <App initialStatus={parseInitialStatus(rootElement.dataset.initialStatus)} />);
}
