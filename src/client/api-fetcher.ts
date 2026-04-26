import { hc } from "hono/client";
import type { AppType } from "../server/app";
import type {
  ConfigReadResult,
  ConfigSaveResponse,
  EnvMutationResponse,
  EnvReadResult,
  GatewayStatus,
  LogTail,
  ModelProvidersMutationResponse,
  ModelYamlPatch,
  WorkspaceConfigHints,
} from "../server/types";
import { getErrorMessage, getResponseErrorMessage, isErrorResponse } from "./lib/errors";

export type ModelProvidersSavePayload = {
  model?: ModelYamlPatch;
  env?: { set?: Record<string, string>; remove?: string[] };
  discord?: { allowed_users: string };
};

function getBasicAuthTokenFromLocation(): string | undefined {
  const url = new URL(window.location.href);
  if (!url.username || !url.password) {
    return undefined;
  }
  return `Basic ${btoa(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`)}`;
}

/**
 * HTTP + typed Hono client with URL-embedded Basic Auth support (common on PaaS).
 */
export class ApiFetcher {
  readonly origin: string;
  readonly rpc: ReturnType<typeof hc<AppType>>;

  constructor(origin: string = window.location.origin) {
    this.origin = origin;
    this.rpc = hc<AppType>(origin, { fetch: (input, init) => this.authenticatedFetch(input, init) });
  }

  authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    const token = getBasicAuthTokenFromLocation();
    if (token !== undefined && !headers.has("Authorization")) {
      headers.set("Authorization", token);
    }
    return fetch(input, {
      ...init,
      credentials: "include",
      headers,
    });
  }

  getBasicAuthToken(): string | undefined {
    return getBasicAuthTokenFromLocation();
  }

  async getGatewayStatus(): Promise<GatewayStatus> {
    const response = await this.rpc.gateway.status.$get();
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<GatewayStatus>;
  }

  async getLogTail(): Promise<LogTail> {
    const response = await this.rpc.logs.tail.$get();
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<LogTail>;
  }

  async getConfigRead(): Promise<ConfigReadResult> {
    const response = await this.rpc.config.$get();
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ConfigReadResult>;
  }

  async getEnvRead(): Promise<EnvReadResult> {
    const response = await this.rpc.env.$get();
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<EnvReadResult>;
  }

  async getWorkspaceConfigHints(): Promise<WorkspaceConfigHints> {
    const response = await this.authenticatedFetch(`${this.origin}/settings/workspace-hints`, {
      credentials: "include",
    });
    const raw = await response.text();
    if (!response.ok) {
      let message = `${String(response.status)} ${response.statusText}`;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "error" in parsed &&
            typeof (parsed as { error: unknown }).error === "string"
          ) {
            message = (parsed as { error: string }).error;
          } else {
            message = raw;
          }
        } catch {
          message = raw;
        }
      }
      throw new Error(message);
    }
    if (!raw) {
      throw new Error("Empty response from server.");
    }
    return JSON.parse(raw) as WorkspaceConfigHints;
  }

  async postEnvUpsert(key: string, value: string): Promise<EnvMutationResponse> {
    const response = await this.rpc.env.$post({ json: { key, value } });
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<EnvMutationResponse>;
  }

  async postEnvBatch(body: {
    set?: Record<string, string>;
    remove?: string[];
  }): Promise<EnvMutationResponse> {
    const response = await this.rpc.env.batch.$post({ json: body });
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<EnvMutationResponse>;
  }

  async deleteEnvKey(key: string): Promise<EnvMutationResponse> {
    const response = await this.rpc.env[":key"].$delete({ param: { key } });
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<EnvMutationResponse>;
  }

  async postConfig(content: string): Promise<ConfigSaveResponse> {
    const response = await this.rpc.config.$post({ json: { content } });
    if (!response.ok && response.status !== 422) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ConfigSaveResponse>;
  }

  async postModelProvidersSettings(body: ModelProvidersSavePayload): Promise<ModelProvidersMutationResponse> {
    const response = await this.authenticatedFetch(`${this.origin}/settings/model-providers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = await response.text();
    if (!response.ok) {
      let message = `${String(response.status)} ${response.statusText}`;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "error" in parsed &&
            typeof (parsed as { error: unknown }).error === "string"
          ) {
            message = (parsed as { error: string }).error;
          } else {
            message = raw;
          }
        } catch {
          message = raw;
        }
      }
      throw new Error(message);
    }
    if (!raw) {
      throw new Error("Empty response from server.");
    }
    return JSON.parse(raw) as ModelProvidersMutationResponse;
  }

  static parseJsonErrorBody(raw: string, fallback: string): string {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isErrorResponse(parsed)) {
        return parsed.error;
      }
      return raw;
    } catch {
      return raw;
    }
  }

  static wrapFetchError(response: Response, raw: string): Error {
    let message = `${String(response.status)} ${response.statusText}`;
    if (raw) {
      message = ApiFetcher.parseJsonErrorBody(raw, message);
    }
    return new Error(message);
  }

  static fromUnknown(cause: unknown): Error {
    return new Error(getErrorMessage(cause));
  }
}
