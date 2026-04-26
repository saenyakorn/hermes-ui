import { describe, expect, it, vi } from "vitest";
import { createApp, type AppServices } from "../src/server/app";
import type {
  ConfigReadResult,
  ConfigSaveResult,
  EnvReadResult,
  GatewayStatus,
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
});
