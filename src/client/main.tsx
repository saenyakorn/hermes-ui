import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import type { GatewaysSummary } from "../server/types";
import { App } from "./spa/App";
import { queryClient } from "./query-client";

declare global {
  interface Window {
    __HERMES_INITIAL_GATEWAYS__?: GatewaysSummary & { legacyActive?: string | null };
    __HERMES_AUTHORIZATION__?: string;
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  const initial = window.__HERMES_INITIAL_GATEWAYS__;
  if (initial) {
    const initialLegacyActive = initial.legacyActive ?? null;
    createRoot(rootElement).render(
      <QueryClientProvider client={queryClient}>
        <App initialGateways={initial} initialLegacyActive={initialLegacyActive} />
      </QueryClientProvider>,
    );
  }
}
