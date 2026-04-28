import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import type { GatewayStatus } from "../server/types";
import { App } from "./spa/App";
import { queryClient } from "./query-client";

declare global {
  interface Window {
    __HERMES_INITIAL_STATUS__?: GatewayStatus;
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  const initialStatus = window.__HERMES_INITIAL_STATUS__;
  if (initialStatus) {
    createRoot(rootElement).render(
      <QueryClientProvider client={queryClient}>
        <App initialStatus={initialStatus} />
      </QueryClientProvider>,
    );
  }
}
