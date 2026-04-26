import type { GatewayStatus } from "../../server/types";
import { App } from "../components/app";

export function Dashboard({ status }: { status: GatewayStatus }) {
  return (
    <main className="h-screen overflow-x-hidden overflow-y-hidden bg-background text-text">
      <div
        className="h-full min-w-0"
        data-initial-status={encodeURIComponent(JSON.stringify(status))}
      >
        <App initialStatus={status} />
      </div>
    </main>
  );
}
