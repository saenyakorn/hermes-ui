import type {
  ConfigReadResult,
  ConfigSaveResponse,
  DiscordSettingsPatch,
  EnvMutationResponse,
  EnvReadResult,
  GatewayStatus,
  GatewaysSummary,
  LogTail,
  ModelProvidersMutationResponse,
  ModelYamlPatch,
  ProfileCreateInput,
  ProfileFileKind,
  ProfileFileReadResult,
  ProfileFileWriteResult,
  ProfileListResult,
  ProfileMutationResult,
  ProfileSessionCreateInput,
  ProfileSessionDeleteResult,
  ProfileSessionGetResult,
  ProfileSessionListResult,
  ProfileSessionRenameInput,
  WorkspaceConfigHints,
} from "../server/types";
import { getResponseErrorMessage, isErrorResponse } from "./lib/errors";

function profileSegment(profile: string | null): string {
  return encodeURIComponent(profile ?? "default");
}

function messageFromJsonErrorBody(raw: string, fallback: string): string {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isErrorResponse(parsed)) {
      return parsed.error;
    }
    return fallback;
  } catch {
    return raw.length > 0 ? raw : fallback;
  }
}

export function parseLogStreamFrames(frame: string): string[] {
  const dataLines = frame
    .split("\n")
    .filter((line) => line.startsWith("data:") && line.length > "data:".length);
  const out: string[] = [];
  for (const dataLine of dataLines) {
    const payload = dataLine.slice("data:".length).trim();
    try {
      const parsed = JSON.parse(payload) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "line" in parsed &&
        typeof parsed.line === "string"
      ) {
        out.push(parsed.line);
      }
    } catch {
      // Ignore malformed stream payloads and keep streaming.
    }
  }
  return out;
}

export type ModelProvidersSavePayload = {
  model?: ModelYamlPatch;
  env?: { set?: Record<string, string>; remove?: string[] };
  discord?: DiscordSettingsPatch;
};

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getBasicAuthTokenFromLocation(): string | undefined {
  const url = new URL(window.location.href);
  if (!url.username && !url.password) {
    return undefined;
  }
  const username = safeDecodeURIComponent(url.username);
  const password = safeDecodeURIComponent(url.password);
  return `Basic ${toBase64Utf8(`${username}:${password}`)}`;
}

function getBasicAuthTokenFromBootstrap(): string | undefined {
  const token = window.__HERMES_AUTHORIZATION__;
  if (typeof token !== "string" || !token.startsWith("Basic ")) {
    return undefined;
  }
  return token;
}

/**
 * HTTP client with URL-embedded Basic Auth support (common on PaaS) and
 * profile-scoped accessors. All gateway/config/env/logs/sessions calls take an
 * explicit profile (`null` = default), reflecting that the server no longer
 * has a global "active profile".
 */
export class ApiFetcher {
  readonly origin: string;

  constructor(origin: string = window.location.origin) {
    this.origin = origin;
  }

  authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    const token = this.getBasicAuthToken();
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
    return getBasicAuthTokenFromLocation() ?? getBasicAuthTokenFromBootstrap();
  }

  async getJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.authenticatedFetch(`${this.origin}${path}`, init);
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    const raw = await response.text();
    if (raw.length === 0) {
      throw new Error("Empty response from server.");
    }
    return JSON.parse(raw) as T;
  }

  async postJson<T>(
    path: string,
    body: unknown,
    init?: RequestInit & { allow422?: boolean },
  ): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    const response = await this.authenticatedFetch(`${this.origin}${path}`, {
      ...init,
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok && !(init?.allow422 && response.status === 422)) {
      throw new Error(await getResponseErrorMessage(response));
    }
    const raw = await response.text();
    return JSON.parse(raw) as T;
  }

  async putJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    const response = await this.authenticatedFetch(`${this.origin}${path}`, {
      ...init,
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    const raw = await response.text();
    return JSON.parse(raw) as T;
  }

  async deleteJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.authenticatedFetch(`${this.origin}${path}`, {
      ...init,
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    const raw = await response.text();
    return JSON.parse(raw) as T;
  }

  async getGateways(): Promise<GatewaysSummary> {
    return this.getJson<GatewaysSummary>("/gateways");
  }

  async getGatewayStatus(profile: string | null): Promise<GatewayStatus> {
    return this.getJson<GatewayStatus>(`/profiles/${profileSegment(profile)}/gateway/status`);
  }

  async postGatewayAction(
    profile: string | null,
    action: "start" | "stop" | "restart",
  ): Promise<GatewayStatus> {
    const response = await this.authenticatedFetch(
      `${this.origin}/profiles/${profileSegment(profile)}/gateway/${action}`,
      { method: "POST" },
    );
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<GatewayStatus>;
  }

  async getLogTail(profile: string | null): Promise<LogTail> {
    return this.getJson<LogTail>(`/profiles/${profileSegment(profile)}/logs/tail`);
  }

  subscribeLogStream(
    profile: string | null,
    onLine: (line: string) => void,
    onError: (message: string) => void,
  ): () => void {
    const abortController = new AbortController();

    const consume = async () => {
      try {
        const response = await this.authenticatedFetch(
          `${this.origin}/profiles/${profileSegment(profile)}/logs/stream`,
          {
            headers: { accept: "text/event-stream" },
            signal: abortController.signal,
          },
        );
        if (!response.ok) {
          onError(await getResponseErrorMessage(response));
          return;
        }
        if (response.body === null) {
          onError("Log stream unavailable.");
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            for (const line of parseLogStreamFrames(frame)) {
              onLine(line);
            }
          }
        }
      } catch (cause: unknown) {
        if (!abortController.signal.aborted) {
          onError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    };

    void consume();

    return () => {
      abortController.abort();
    };
  }

  async getConfigRead(profile: string | null): Promise<ConfigReadResult> {
    return this.getJson<ConfigReadResult>(`/profiles/${profileSegment(profile)}/config`);
  }

  async getEnvRead(profile: string | null): Promise<EnvReadResult> {
    return this.getJson<EnvReadResult>(`/profiles/${profileSegment(profile)}/env`);
  }

  async getWorkspaceConfigHints(profile: string | null): Promise<WorkspaceConfigHints> {
    return this.getJson<WorkspaceConfigHints>(
      `/profiles/${profileSegment(profile)}/settings/workspace-hints`,
    );
  }

  async postEnvUpsert(
    profile: string | null,
    key: string,
    value: string,
  ): Promise<EnvMutationResponse> {
    return this.postJson<EnvMutationResponse>(`/profiles/${profileSegment(profile)}/env`, {
      key,
      value,
    });
  }

  async postEnvBatch(
    profile: string | null,
    body: { set?: Record<string, string>; remove?: string[] },
  ): Promise<EnvMutationResponse> {
    return this.postJson<EnvMutationResponse>(
      `/profiles/${profileSegment(profile)}/env/batch`,
      body,
    );
  }

  async deleteEnvKey(profile: string | null, key: string): Promise<EnvMutationResponse> {
    return this.deleteJson<EnvMutationResponse>(
      `/profiles/${profileSegment(profile)}/env/${encodeURIComponent(key)}`,
    );
  }

  async postConfig(profile: string | null, content: string): Promise<ConfigSaveResponse> {
    return this.postJson<ConfigSaveResponse>(
      `/profiles/${profileSegment(profile)}/config`,
      { content },
      { allow422: true },
    );
  }

  async postModelProvidersSettings(
    profile: string | null,
    body: ModelProvidersSavePayload,
  ): Promise<ModelProvidersMutationResponse> {
    const response = await this.authenticatedFetch(
      `${this.origin}/profiles/${profileSegment(profile)}/settings/model-providers`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const raw = await response.text();
    if (!response.ok) {
      const fallback = `${String(response.status)} ${response.statusText}`;
      throw new Error(raw ? messageFromJsonErrorBody(raw, fallback) : fallback);
    }
    if (!raw) {
      throw new Error("Empty response from server.");
    }
    return JSON.parse(raw) as ModelProvidersMutationResponse;
  }

  async getProfiles(): Promise<ProfileListResult> {
    return this.getJson<ProfileListResult>("/profiles");
  }

  async postProfile(input: ProfileCreateInput): Promise<ProfileMutationResult> {
    return this.postJson<ProfileMutationResult>("/profiles", input);
  }

  async putProfileRename(name: string, to: string): Promise<ProfileMutationResult> {
    return this.putJson<ProfileMutationResult>(`/profiles/${encodeURIComponent(name)}`, { to });
  }

  async deleteProfile(name: string): Promise<ProfileMutationResult> {
    return this.deleteJson<ProfileMutationResult>(`/profiles/${encodeURIComponent(name)}`);
  }

  async getProfileFile(
    profile: string | null,
    kind: ProfileFileKind,
  ): Promise<ProfileFileReadResult> {
    return this.getJson<ProfileFileReadResult>(
      `/profiles/${profileSegment(profile)}/files/${encodeURIComponent(kind)}`,
    );
  }

  async putProfileFile(
    profile: string | null,
    kind: ProfileFileKind,
    content: string,
  ): Promise<ProfileFileWriteResult> {
    return this.putJson<ProfileFileWriteResult>(
      `/profiles/${profileSegment(profile)}/files/${encodeURIComponent(kind)}`,
      { content },
    );
  }

  async getProfileSessions(profile: string | null): Promise<ProfileSessionListResult> {
    return this.getJson<ProfileSessionListResult>(`/profiles/${profileSegment(profile)}/sessions`);
  }

  async getProfileSession(profile: string | null, id: string): Promise<ProfileSessionGetResult> {
    return this.getJson<ProfileSessionGetResult>(
      `/profiles/${profileSegment(profile)}/sessions/${encodeURIComponent(id)}`,
    );
  }

  async postProfileSession(
    profile: string | null,
    input: ProfileSessionCreateInput,
  ): Promise<ProfileSessionGetResult> {
    return this.postJson<ProfileSessionGetResult>(
      `/profiles/${profileSegment(profile)}/sessions`,
      input,
    );
  }

  async putProfileSessionRename(
    profile: string | null,
    id: string,
    input: ProfileSessionRenameInput,
  ): Promise<ProfileSessionGetResult> {
    return this.putJson<ProfileSessionGetResult>(
      `/profiles/${profileSegment(profile)}/sessions/${encodeURIComponent(id)}`,
      input,
    );
  }

  async postProfileSessionArchive(
    profile: string | null,
    id: string,
  ): Promise<ProfileSessionGetResult> {
    return this.postJson<ProfileSessionGetResult>(
      `/profiles/${profileSegment(profile)}/sessions/${encodeURIComponent(id)}/archive`,
      {},
    );
  }

  async postProfileSessionRestore(
    profile: string | null,
    id: string,
  ): Promise<ProfileSessionGetResult> {
    return this.postJson<ProfileSessionGetResult>(
      `/profiles/${profileSegment(profile)}/sessions/${encodeURIComponent(id)}/restore`,
      {},
    );
  }

  async deleteProfileSession(
    profile: string | null,
    id: string,
  ): Promise<ProfileSessionDeleteResult> {
    return this.deleteJson<ProfileSessionDeleteResult>(
      `/profiles/${profileSegment(profile)}/sessions/${encodeURIComponent(id)}`,
    );
  }
}
