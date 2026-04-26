import { describe, expect, it, vi } from "vitest";
import { createApp, type AppServices } from "../src/server/app";
import type {
  ConfigReadResult,
  ConfigSaveResult,
  EnvReadResult,
  GatewayStatus,
  ModelYamlPatch,
  WorkspaceConfigHints,
} from "../src/server/types";

const auth = `Basic ${Buffer.from("admin:secret").toString("base64")}`;

const stoppedStatus: GatewayStatus = {
  state: "stopped",
  health: "unknown",
  pid: null,
  cwd: "/repo/data",
  startedAt: null,
  uptimeMs: null,
  exitCode: null,
  lastError: null,
  logWarning: null,
};

const runningStatus: GatewayStatus = {
  ...stoppedStatus,
  state: "running",
  health: "healthy",
  pid: 1234,
  startedAt: "2026-04-26T10:00:00.000Z",
  uptimeMs: 30000,
};

const crashedStatus: GatewayStatus = {
  ...stoppedStatus,
  state: "crashed",
  lastError: "restart failed",
};

const configRead: ConfigReadResult = {
  path: "data/config.yaml",
  content: "{}\n",
  updatedAt: "2026-04-26T10:30:00.000Z",
  validation: { ok: true, issues: [] },
};

const configSave: ConfigSaveResult = {
  ...configRead,
  saved: true,
};

const envRead: EnvReadResult = {
  path: "data/.env",
  updatedAt: "2026-04-26T10:30:00.000Z",
  entries: [{ key: "OPENAI_API_KEY", maskedValue: "******ab" }],
};

const workspaceHints: WorkspaceConfigHints = {
  model: { default: null, provider: null, base_url: null },
  discord: {
    allowed_users: null,
    allowed_channels: null,
    require_mention: null,
    free_response_channels: null,
    auto_thread: null,
    reactions: null,
    ignored_channels: null,
    no_thread_channels: null,
    allow_mentions_everyone: null,
    allow_mentions_roles: null,
    allow_mentions_users: null,
    allow_mentions_replied_user: null,
  },
};

function createServices(): AppServices {
  return {
    env: {
      adminUsername: "admin",
      adminPassword: "secret",
      port: 3000,
      logLevel: "info",
    },
    gateway: {
      status: vi.fn(() => stoppedStatus),
      start: vi.fn(),
      stop: vi.fn(),
      restart: vi.fn(),
      refreshHealth: vi.fn(),
    },
    logs: {
      tail: vi.fn(async () => ({ lines: ["line one"], warning: null })),
      subscribe: vi.fn(() => () => undefined),
    },
    config: {
      read: vi.fn(async () => configRead),
      save: vi.fn(async () => configSave),
      patchModel: vi.fn(async (_updates: ModelYamlPatch) => configSave),
      getWorkspaceConfigHints: vi.fn(async () => workspaceHints),
      patchDiscordAllowedUsers: vi.fn(async () => configSave),
    },
    envVars: {
      read: vi.fn(async () => envRead),
      upsert: vi.fn(async (key: string, value: string) => ({
        ...envRead,
        entries: [{ key, maskedValue: "*".repeat(Math.min(8, value.length)) }],
      })),
      remove: vi.fn(async () => envRead),
      applyBatch: vi.fn(async () => envRead),
    },
  };
}

describe("createApp", () => {
  it("requires basic auth", async () => {
    const response = await createApp(createServices()).request("/");

    expect(response.status).toBe(401);
  });

  it("renders plain HTML shell with htmx and vanilla app script", async () => {
    const response = await createApp(createServices()).request("/", {
      headers: { authorization: auth },
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('src="/assets/vendor/htmx.min.js"');
    expect(html).toContain('id="gateway-panel"');
    expect(html).toContain('id="workspace"');
    expect(html).toContain('src="/assets/main.js"');
    expect(html).toContain('data-tab-trigger="messaging"');
    expect(html).toContain("Messaging Platform");
    expect(html).toContain('data-tab-trigger="model-providers"');
    expect(html).toContain("Model providers");
    expect(html).toContain("Advanced options");
  });

  it("returns gateway status JSON", async () => {
    const response = await createApp(createServices()).request("/gateway/status", {
      headers: { authorization: auth },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ state: "stopped" });
  });

  it("returns log tail JSON", async () => {
    const response = await createApp(createServices()).request("/logs/tail", {
      headers: { authorization: auth },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ lines: ["line one"], warning: null });
  });

  it("protects config routes with basic auth", async () => {
    const response = await createApp(createServices()).request("/config");

    expect(response.status).toBe(401);
  });

  it("returns config JSON", async () => {
    const services = createServices();

    const response = await createApp(services).request("/config", {
      headers: { authorization: auth },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(configRead);
    expect(services.config.read).toHaveBeenCalledOnce();
  });

  it("returns JSON error when config read fails", async () => {
    const services = createServices();
    services.config.read = vi.fn(async () => {
      throw new Error("permission denied");
    });

    const response = await createApp(services).request("/config", {
      headers: { authorization: auth },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to read config: permission denied",
    });
  });

  it("saves config without restarting gateway while stopped", async () => {
    const services = createServices();

    const response = await createApp(services).request("/config", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ content: "{}\n" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      config: configSave,
      restart: { attempted: false, ok: true, error: null },
      gateway: stoppedStatus,
    });
    expect(services.config.save).toHaveBeenCalledWith("{}\n");
    expect(services.gateway.restart).not.toHaveBeenCalled();
  });

  it("returns JSON error without restarting when config save fails", async () => {
    const services = createServices();
    services.gateway.status = vi.fn(() => runningStatus);
    services.config.save = vi.fn(async () => {
      throw new Error("disk full");
    });

    const response = await createApp(services).request("/config", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ content: "{}\n" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to save config: disk full",
    });
    expect(services.gateway.restart).not.toHaveBeenCalled();
  });

  it("restarts gateway after saving config while running", async () => {
    const services = createServices();
    services.gateway.status = vi.fn(() => runningStatus);
    services.gateway.restart = vi.fn(async () => runningStatus);

    const response = await createApp(services).request("/config", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ content: "{}\n" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      config: configSave,
      restart: { attempted: true, ok: true, error: null },
      gateway: runningStatus,
    });
    expect(services.gateway.restart).toHaveBeenCalledOnce();
  });

  it("returns validation failure without restarting gateway", async () => {
    const services = createServices();
    const invalidConfig: ConfigSaveResult = {
      ...configRead,
      content: "[]\n",
      validation: {
        ok: false,
        issues: [{ message: "Config root must be a YAML mapping.", path: null }],
      },
      saved: false,
    };
    services.config.save = vi.fn(async () => invalidConfig);

    const response = await createApp(services).request("/config", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ content: "[]\n" }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      config: invalidConfig,
      restart: { attempted: false, ok: true, error: null },
      gateway: stoppedStatus,
    });
    expect(services.gateway.restart).not.toHaveBeenCalled();
  });

  it("surfaces restart failure while preserving saved config", async () => {
    const services = createServices();
    services.gateway.status = vi
      .fn()
      .mockReturnValueOnce(runningStatus)
      .mockReturnValue(crashedStatus);
    services.gateway.restart = vi.fn(async () => {
      throw new Error("restart failed");
    });

    const response = await createApp(services).request("/config", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ content: "{}\n" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      config: configSave,
      restart: { attempted: true, ok: false, error: "restart failed" },
      gateway: crashedStatus,
    });
  });

  it("returns bad request for invalid config post body", async () => {
    const services = createServices();

    const response = await createApp(services).request("/config", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ content: 123 }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Config content must be a string." });
    expect(services.config.save).not.toHaveBeenCalled();
    expect(services.gateway.restart).not.toHaveBeenCalled();
  });

  it("returns current gateway status when start fails", async () => {
    const services = createServices();
    const failedStatus: GatewayStatus = {
      state: "crashed",
      health: "unknown",
      pid: null,
      cwd: "/repo/data",
      startedAt: null,
      uptimeMs: null,
      exitCode: null,
      lastError: "spawn hermes ENOENT",
      logWarning: null,
    };
    services.gateway.start = vi.fn(async () => {
      throw new Error("spawn hermes ENOENT");
    });
    services.gateway.status = vi.fn(() => failedStatus);

    const response = await createApp(services).request("/gateway/start", {
      method: "POST",
      headers: { authorization: auth },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      state: "crashed",
      lastError: "spawn hermes ENOENT",
    });
  });

  it("protects env batch route with basic auth", async () => {
    const response = await createApp(createServices()).request("/env/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ set: { DISCORD_BOT_TOKEN: "x" } }),
    });

    expect(response.status).toBe(401);
  });

  it("returns bad request for invalid env batch body", async () => {
    const services = createServices();

    const response = await createApp(services).request("/env/batch", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    expect(services.envVars.applyBatch).not.toHaveBeenCalled();
  });

  it("returns bad request when env batch has only blank set values", async () => {
    const services = createServices();

    const response = await createApp(services).request("/env/batch", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ set: { DISCORD_BOT_TOKEN: "   " } }),
    });

    expect(response.status).toBe(400);
    expect(services.envVars.applyBatch).not.toHaveBeenCalled();
  });

  it("applies env batch and restarts gateway", async () => {
    const services = createServices();
    services.gateway.restart = vi.fn(async () => runningStatus);
    const afterBatch: EnvReadResult = {
      ...envRead,
      entries: [...envRead.entries, { key: "DISCORD_BOT_TOKEN", maskedValue: "******ab" }],
    };
    services.envVars.applyBatch = vi.fn(async () => afterBatch);

    const response = await createApp(services).request("/env/batch", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ set: { DISCORD_BOT_TOKEN: "tok" } }),
    });

    expect(response.status).toBe(200);
    expect(services.envVars.applyBatch).toHaveBeenCalledWith({ set: { DISCORD_BOT_TOKEN: "tok" } });
    expect(services.gateway.restart).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({
      env: afterBatch,
      restart: { attempted: true, ok: true, error: null },
      gateway: runningStatus,
    });
  });

  it("returns JSON error when env batch apply fails", async () => {
    const services = createServices();
    services.envVars.applyBatch = vi.fn(async () => {
      throw new Error("disk full");
    });

    const response = await createApp(services).request("/env/batch", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ remove: ["DISCORD_BOT_TOKEN"] }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to update env: disk full",
    });
  });

  it("protects model-providers settings route with basic auth", async () => {
    const response = await createApp(createServices()).request("/settings/model-providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ env: { set: { OPENROUTER_API_KEY: "k" } } }),
    });

    expect(response.status).toBe(401);
  });

  it("protects workspace-hints route with basic auth", async () => {
    const response = await createApp(createServices()).request("/settings/workspace-hints");

    expect(response.status).toBe(401);
  });

  it("returns workspace config hints JSON", async () => {
    const services = createServices();

    const response = await createApp(services).request("/settings/workspace-hints", {
      headers: { authorization: auth },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(workspaceHints);
    expect(services.config.getWorkspaceConfigHints).toHaveBeenCalledOnce();
  });

  it("returns bad request for empty model-providers body", async () => {
    const services = createServices();

    const response = await createApp(services).request("/settings/model-providers", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    expect(services.config.patchModel).not.toHaveBeenCalled();
    expect(services.envVars.applyBatch).not.toHaveBeenCalled();
  });

  it("returns 422 when model yaml patch does not save and does not apply env", async () => {
    const services = createServices();
    services.gateway.status = vi.fn(() => runningStatus);
    const invalidPatch: ConfigSaveResult = {
      ...configRead,
      content: "[]\n",
      validation: {
        ok: false,
        issues: [{ message: "Config root must be a YAML mapping.", path: null }],
      },
      saved: false,
    };
    services.config.patchModel = vi.fn(async () => invalidPatch);

    const response = await createApp(services).request("/settings/model-providers", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({
        model: { default: "x/y" },
        env: { set: { OPENROUTER_API_KEY: "secret" } },
      }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "Config validation failed; env was not modified.",
      config: invalidPatch,
    });
    expect(services.config.patchModel).toHaveBeenCalledOnce();
    expect(services.envVars.applyBatch).not.toHaveBeenCalled();
    expect(services.gateway.restart).not.toHaveBeenCalled();
  });

  it("patches model config, applies env batch, and restarts gateway once", async () => {
    const services = createServices();
    services.gateway.status = vi.fn(() => runningStatus);
    services.gateway.restart = vi.fn(async () => runningStatus);
    const afterBatch: EnvReadResult = {
      ...envRead,
      entries: [...envRead.entries, { key: "OPENROUTER_API_KEY", maskedValue: "******ab" }],
    };
    services.envVars.applyBatch = vi.fn(async () => afterBatch);
    const patchedConfig: ConfigSaveResult = {
      ...configRead,
      content: "model:\n  default: anthropic/claude\n",
      saved: true,
    };
    services.config.patchModel = vi.fn(async () => patchedConfig);

    const response = await createApp(services).request("/settings/model-providers", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({
        model: { default: "anthropic/claude" },
        env: { set: { OPENROUTER_API_KEY: "tok" } },
      }),
    });

    expect(response.status).toBe(200);
    expect(services.config.patchModel).toHaveBeenCalledWith({ default: "anthropic/claude" });
    expect(services.envVars.applyBatch).toHaveBeenCalledWith({
      set: { OPENROUTER_API_KEY: "tok" },
    });
    expect(services.gateway.restart).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({
      env: afterBatch,
      config: patchedConfig,
      restart: { attempted: true, ok: true, error: null },
      gateway: runningStatus,
    });
  });

  it("model-providers env-only skips patchModel and does not restart when gateway stopped", async () => {
    const services = createServices();
    services.gateway.restart = vi.fn(async () => runningStatus);

    const response = await createApp(services).request("/settings/model-providers", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ env: { set: { OPENROUTER_API_KEY: "tok" } } }),
    });

    expect(response.status).toBe(200);
    expect(services.config.patchModel).not.toHaveBeenCalled();
    expect(services.config.patchDiscordAllowedUsers).not.toHaveBeenCalled();
    expect(services.envVars.applyBatch).toHaveBeenCalledOnce();
    expect(services.gateway.restart).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      restart: { attempted: false, ok: true, error: null },
      gateway: stoppedStatus,
    });
  });

  it("model-providers discord-only patches discord allowlist and skips env batch", async () => {
    const services = createServices();
    services.gateway.restart = vi.fn(async () => runningStatus);
    const afterDiscordPatch: ConfigSaveResult = {
      ...configRead,
      content: 'discord:\n  allowed_users: "1,2"\n',
      saved: true,
    };
    services.config.patchDiscordAllowedUsers = vi.fn(async () => afterDiscordPatch);

    const response = await createApp(services).request("/settings/model-providers", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ discord: { allowed_users: "1, 2" } }),
    });

    expect(response.status).toBe(200);
    expect(services.config.patchModel).not.toHaveBeenCalled();
    expect(services.config.patchDiscordAllowedUsers).toHaveBeenCalledWith("1, 2");
    expect(services.envVars.applyBatch).not.toHaveBeenCalled();
    expect(services.gateway.restart).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      config: afterDiscordPatch,
      restart: { attempted: false, ok: true, error: null },
      gateway: stoppedStatus,
    });
  });

  it("returns 422 when discord yaml patch does not save and does not apply env", async () => {
    const services = createServices();
    services.gateway.status = vi.fn(() => runningStatus);
    const invalidDiscordPatch: ConfigSaveResult = {
      ...configRead,
      validation: {
        ok: false,
        issues: [{ message: "Config root must be a YAML mapping.", path: null }],
      },
      saved: false,
    };
    services.config.patchDiscordAllowedUsers = vi.fn(async () => invalidDiscordPatch);

    const response = await createApp(services).request("/settings/model-providers", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({
        discord: { allowed_users: "9" },
        env: { set: { DISCORD_BOT_TOKEN: "secret" } },
      }),
    });

    expect(response.status).toBe(422);
    expect(services.config.patchDiscordAllowedUsers).toHaveBeenCalledOnce();
    expect(services.envVars.applyBatch).not.toHaveBeenCalled();
    expect(services.gateway.restart).not.toHaveBeenCalled();
  });
});
