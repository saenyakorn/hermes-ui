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
  ProfileActivateResult,
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
    this.rpc = hc<AppType>(origin, {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => this.authenticatedFetch(input, init),
    });
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
      const fallback = `${String(response.status)} ${response.statusText}`;
      throw new Error(raw ? messageFromJsonErrorBody(raw, fallback) : fallback);
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

  async postModelProvidersSettings(
    body: ModelProvidersSavePayload,
  ): Promise<ModelProvidersMutationResponse> {
    const response = await this.authenticatedFetch(`${this.origin}/settings/model-providers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
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
    const response = await this.rpc.profiles.$get();
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ProfileListResult>;
  }

  async postProfile(input: ProfileCreateInput): Promise<ProfileMutationResult> {
    const response = await this.rpc.profiles.$post({ json: input });
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ProfileMutationResult>;
  }

  async putProfileRename(name: string, to: string): Promise<ProfileMutationResult> {
    const response = await this.authenticatedFetch(
      `${this.origin}/profiles/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to }),
      },
    );
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ProfileMutationResult>;
  }

  async deleteProfile(name: string): Promise<ProfileMutationResult> {
    const response = await this.rpc.profiles[":name"].$delete({ param: { name } });
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ProfileMutationResult>;
  }

  async postProfileActivate(name: string | null): Promise<ProfileActivateResult> {
    const response = await this.rpc.profiles[":name"].activate.$post({
      param: { name: name ?? "default" },
    });
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ProfileActivateResult>;
  }

  async getProfileFile(
    profile: string | null,
    kind: ProfileFileKind,
  ): Promise<ProfileFileReadResult> {
    const response = await this.rpc.profiles[":name"].files[":kind"].$get({
      param: { name: profile ?? "default", kind },
    });
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ProfileFileReadResult>;
  }

  async putProfileFile(
    profile: string | null,
    kind: ProfileFileKind,
    content: string,
  ): Promise<ProfileFileWriteResult> {
    const profileSegment = encodeURIComponent(profile ?? "default");
    const response = await this.authenticatedFetch(
      `${this.origin}/profiles/${profileSegment}/files/${encodeURIComponent(kind)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      },
    );
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ProfileFileWriteResult>;
  }

  async getProfileSessions(profile: string | null): Promise<ProfileSessionListResult> {
    const response = await this.authenticatedFetch(
      `${this.origin}/profiles/${encodeURIComponent(profile ?? "default")}/sessions`,
      {
        credentials: "include",
      },
    );
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ProfileSessionListResult>;
  }

  async getProfileSession(profile: string | null, id: string): Promise<ProfileSessionGetResult> {
    const response = await this.authenticatedFetch(
      `${this.origin}/profiles/${encodeURIComponent(profile ?? "default")}/sessions/${encodeURIComponent(id)}`,
      {
        credentials: "include",
      },
    );
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ProfileSessionGetResult>;
  }

  async postProfileSession(
    profile: string | null,
    input: ProfileSessionCreateInput,
  ): Promise<ProfileSessionGetResult> {
    const response = await this.authenticatedFetch(
      `${this.origin}/profiles/${encodeURIComponent(profile ?? "default")}/sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ProfileSessionGetResult>;
  }

  async putProfileSessionRename(
    profile: string | null,
    id: string,
    input: ProfileSessionRenameInput,
  ): Promise<ProfileSessionGetResult> {
    const response = await this.authenticatedFetch(
      `${this.origin}/profiles/${encodeURIComponent(profile ?? "default")}/sessions/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ProfileSessionGetResult>;
  }

  async postProfileSessionArchive(
    profile: string | null,
    id: string,
  ): Promise<ProfileSessionGetResult> {
    const response = await this.authenticatedFetch(
      `${this.origin}/profiles/${encodeURIComponent(profile ?? "default")}/sessions/${encodeURIComponent(id)}/archive`,
      {
        method: "POST",
      },
    );
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ProfileSessionGetResult>;
  }

  async postProfileSessionRestore(
    profile: string | null,
    id: string,
  ): Promise<ProfileSessionGetResult> {
    const response = await this.authenticatedFetch(
      `${this.origin}/profiles/${encodeURIComponent(profile ?? "default")}/sessions/${encodeURIComponent(id)}/restore`,
      {
        method: "POST",
      },
    );
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ProfileSessionGetResult>;
  }

  async deleteProfileSession(
    profile: string | null,
    id: string,
  ): Promise<ProfileSessionDeleteResult> {
    const response = await this.authenticatedFetch(
      `${this.origin}/profiles/${encodeURIComponent(profile ?? "default")}/sessions/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response));
    }
    return response.json() as Promise<ProfileSessionDeleteResult>;
  }
}
