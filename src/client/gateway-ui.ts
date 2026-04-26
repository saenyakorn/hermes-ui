import type { QueryClient } from "@tanstack/query-core";
import type { GatewayStatus } from "../server/types";
import type { ApiFetcher } from "./api-fetcher";
import { gatewayQueryKey } from "./app-query";
import { getErrorMessage } from "./lib/errors";

type GatewayAction = "start" | "stop" | "restart";

export function renderGatewayError(message: string): void {
  const error = document.getElementById("gateway-error");
  if (!(error instanceof HTMLParagraphElement)) {
    return;
  }
  error.textContent = message;
  error.classList.remove("hidden");
}

export function renderGatewayStatus(status: GatewayStatus, error: string | null): void {
  const host = document.getElementById("gateway-status");
  if (host) {
    host.innerHTML = [
      `State: <span class="text-text">${status.state}</span>`,
      `Health: <span class="text-text">${status.health}</span>`,
      `PID: <span class="text-text">${status.pid ?? "-"}</span>`,
      `CWD: <span class="text-text">${status.cwd}</span>`,
      `Last error: <span class="text-text">${status.lastError ?? "-"}</span>`,
    ]
      .map((line) => `<div>${line}</div>`)
      .join("");
  }
  const errorNode = document.getElementById("gateway-error");
  if (errorNode instanceof HTMLParagraphElement) {
    errorNode.textContent = error ?? "";
    errorNode.classList.toggle("hidden", error === null);
  }
}

function setBusyButtons(disabled: boolean): void {
  for (const id of ["start-button", "stop-button", "restart-button"]) {
    const button = document.getElementById(id);
    if (button instanceof HTMLButtonElement) {
      button.disabled = disabled;
    }
  }
}

function mapButtonToAction(id: string): GatewayAction | null {
  if (id === "start-button") {
    return "start";
  }
  if (id === "stop-button") {
    return "stop";
  }
  if (id === "restart-button") {
    return "restart";
  }
  return null;
}

export function wireGatewayActions(): void {
  document.body.addEventListener("htmx:afterRequest", (event) => {
    const detail = (event as CustomEvent<{ elt?: Element; xhr?: XMLHttpRequest }>).detail;
    const elt = detail?.elt;
    if (!(elt instanceof HTMLElement)) {
      return;
    }
    const action = mapButtonToAction(elt.id);
    if (!action) {
      return;
    }
    setBusyButtons(false);
    if (!detail?.xhr) {
      return;
    }
    if (detail.xhr.status >= 400) {
      renderGatewayError(`Gateway ${action} failed (${detail.xhr.status}).`);
      return;
    }

    try {
      const status = JSON.parse(detail.xhr.responseText) as GatewayStatus;
      queryClient.setQueryData(gatewayQueryKey, status);
      renderGatewayStatus(status, null);
    } catch {
      renderGatewayError("Gateway action returned invalid JSON.");
    }
  });

  for (const id of ["start-button", "stop-button", "restart-button"]) {
    const button = document.getElementById(id);
    if (button instanceof HTMLButtonElement) {
      button.addEventListener("click", () => {
        setBusyButtons(true);
      });
    }
  }

  window.setInterval(() => {
    void refreshGatewayStatus(api, queryClient);
  }, 3000);
}

let api: ApiFetcher;
let queryClient: QueryClient;

export function initGatewayUi(fetcher: ApiFetcher, client: QueryClient): void {
  api = fetcher;
  queryClient = client;
}

export async function refreshGatewayStatus(
  fetcher: ApiFetcher,
  client: QueryClient,
): Promise<void> {
  try {
    const status = await client.fetchQuery({
      queryKey: gatewayQueryKey,
      queryFn: () => fetcher.getGatewayStatus(),
      staleTime: 0,
    });
    renderGatewayStatus(status, null);
  } catch (cause: unknown) {
    renderGatewayError(getErrorMessage(cause));
  }
}
