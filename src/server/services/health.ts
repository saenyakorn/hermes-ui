import type { GatewayHealthState } from "../types";

export const GATEWAY_HEALTH_URL = "http://127.0.0.1:8080/health";

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export async function checkGatewayHealth(
  gatewayRunning: boolean,
  fetcher: Fetcher = fetch,
): Promise<GatewayHealthState> {
  if (!gatewayRunning) {
    return "unknown";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetcher(GATEWAY_HEALTH_URL, {
      method: "GET",
      signal: controller.signal,
    });

    return response.ok ? "healthy" : "unhealthy";
  } catch {
    return "unreachable";
  } finally {
    clearTimeout(timeout);
  }
}
