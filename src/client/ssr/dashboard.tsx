import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { GatewayStatus } from "../../server/types";
import { App } from "../components/app";

export function Dashboard({ status }: { status: GatewayStatus }) {
  const queryClient = new QueryClient();

  return (
    <main className="h-screen overflow-x-hidden overflow-y-hidden bg-background text-text">
      <div
        className="h-full min-w-0"
        data-initial-status={encodeURIComponent(JSON.stringify(status))}
      >
        <QueryClientProvider client={queryClient}>
          <App initialStatus={status} />
        </QueryClientProvider>
      </div>
    </main>
  );
}
