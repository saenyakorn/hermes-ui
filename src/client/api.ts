import { hc } from "hono/client";
import type { AppType } from "../server/app";
import type {
  ConfigReadResult,
  ConfigSaveResponse,
  ConfigValidationIssue,
  GatewayStatus,
  LogTail,
} from "../server/types";

export type {
  ConfigReadResult,
  ConfigSaveResponse,
  ConfigValidationIssue,
  GatewayStatus,
  LogTail,
};

type RpcClient = ReturnType<typeof hc<AppType>>;

let rpcClient: RpcClient | null = null;

function getRpcClient(): RpcClient {
  if (rpcClient) {
    return rpcClient;
  }

  const baseUrl =
    typeof window === "undefined" ? "http://localhost" : window.location.origin;
  rpcClient = hc<AppType>(baseUrl);
  return rpcClient;
}

export async function getGatewayStatus(): Promise<GatewayStatus> {
  const response = await getRpcClient().gateway.status.$get();
  return parseJsonResponse<GatewayStatus>(response);
}

export async function runGatewayAction(action: "start" | "stop" | "restart"): Promise<GatewayStatus> {
  if (action === "start") {
    return parseJsonResponse<GatewayStatus>(await getRpcClient().gateway.start.$post());
  }
  if (action === "stop") {
    return parseJsonResponse<GatewayStatus>(await getRpcClient().gateway.stop.$post());
  }
  return parseJsonResponse<GatewayStatus>(await getRpcClient().gateway.restart.$post());
}

export async function getLogTail(): Promise<LogTail> {
  return parseJsonResponse<LogTail>(await getRpcClient().logs.tail.$get());
}

export async function getConfigRead(): Promise<ConfigReadResult> {
  return parseJsonResponse<ConfigReadResult>(await getRpcClient().config.$get());
}

export async function fetchConfigSaveResponse(content: string): Promise<ConfigSaveResponse> {
  const response = await getRpcClient().config.$post({
    json: { content },
  });
  if (!response.ok && response.status !== 422) {
    throw new Error(await getResponseErrorMessage(response));
  }
  return response.json() as Promise<ConfigSaveResponse>;
}

export function getRestartStatusMessage(response: ConfigSaveResponse): string {
  if (response.restart.attempted && response.restart.ok) {
    return "Config saved. Gateway restarted.";
  }

  if (response.restart.attempted) {
    return `Config saved. Gateway restart failed: ${response.restart.error ?? "Unknown error"}`;
  }

  return "Config saved. Gateway was stopped, so no restart was needed.";
}

export function getErrorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause);
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  const body = await response.text();
  if (!body) {
    return `${response.status} ${response.statusText}`;
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    if (isErrorResponse(parsed)) {
      return parsed.error;
    }
  } catch {
    return body;
  }

  return body;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }
  return response.json() as Promise<T>;
}

function isErrorResponse(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  );
}
