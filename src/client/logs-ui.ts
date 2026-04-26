import type { QueryClient } from "@tanstack/query-core";
import type { ApiFetcher } from "./api-fetcher";
import { logsQueryKey } from "./app-query";
import { getErrorMessage } from "./lib/errors";

function setLogError(message: string | null): void {
  const node = document.getElementById("log-error");
  if (!(node instanceof HTMLParagraphElement)) {
    return;
  }
  node.textContent = message ?? "";
  node.classList.toggle("hidden", !message);
}

export async function refreshLogs(fetcher: ApiFetcher, client: QueryClient): Promise<void> {
  try {
    const logs = await client.fetchQuery({
      queryKey: logsQueryKey,
      queryFn: () => fetcher.getLogTail(),
      staleTime: 0,
    });
    const host = document.getElementById("log-lines");
    if (host) {
      host.textContent = logs.lines.join("\n");
    }
    setLogError(logs.warning);
  } catch (cause: unknown) {
    setLogError(getErrorMessage(cause));
  }
}

export async function setupLogs(fetcher: ApiFetcher, client: QueryClient): Promise<void> {
  await refreshLogs(fetcher, client);
  const source = new EventSource("/logs/stream");
  source.addEventListener("message", () => {
    void refreshLogs(fetcher, client);
  });
  source.addEventListener("error", () => {
    setLogError("Log stream disconnected.");
  });
}
