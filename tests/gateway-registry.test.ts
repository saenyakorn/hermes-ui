import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpawnGateway } from "../src/server/services/gateway-manager";
import { GatewayRegistry } from "../src/server/services/gateway-registry";
import { LogStoreRegistry } from "../src/server/services/log-store-registry";
import { ProfileResolver } from "../src/server/services/paths";

type FakeChildProcess = ChildProcessWithoutNullStreams & {
  readonly kill: ReturnType<typeof vi.fn<(signal?: NodeJS.Signals | number) => boolean>>;
};

let rootDir = "";

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(os.tmpdir(), "hermes-gateway-registry-"));
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

function createFakeChild(pid: number | undefined): FakeChildProcess {
  const kill = vi.fn(() => true);
  return Object.assign(new EventEmitter(), {
    pid,
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill,
  }) as unknown as FakeChildProcess;
}

function createRegistry(spawnGateway: SpawnGateway): {
  registry: GatewayRegistry;
  resolver: ProfileResolver;
} {
  const resolver = new ProfileResolver(rootDir);
  const logsRegistry = new LogStoreRegistry(resolver, () => "2026-04-29T00:00:00.000Z");
  const registry = new GatewayRegistry(
    resolver,
    logsRegistry,
    spawnGateway,
    () => "2026-04-29T00:00:00.000Z",
  );
  return { registry, resolver };
}

describe("GatewayRegistry.get", () => {
  it("returns the same manager instance for repeated calls with the same profile", () => {
    const { registry } = createRegistry(vi.fn(() => createFakeChild(1)));
    const a = registry.get(null);
    const b = registry.get(null);
    expect(a).toBe(b);
  });

  it("constructs an isolated manager per profile with profile-specific cwd", () => {
    const { registry, resolver } = createRegistry(vi.fn(() => createFakeChild(1)));
    const defaultManager = registry.get(null);
    const alpha = registry.get("alpha");
    const beta = registry.get("beta");

    expect(defaultManager).not.toBe(alpha);
    expect(alpha).not.toBe(beta);
    expect(defaultManager.cwd).toBe(resolver.resolveDataDir(null));
    expect(alpha.cwd).toBe(resolver.resolveDataDir("alpha"));
    expect(beta.cwd).toBe(resolver.resolveDataDir("beta"));
    expect(defaultManager.getProfile()).toBeNull();
    expect(alpha.getProfile()).toBe("alpha");
    expect(beta.getProfile()).toBe("beta");
  });

  it("rejects invalid profile names", () => {
    const { registry } = createRegistry(vi.fn(() => createFakeChild(1)));
    expect(() => registry.get("BAD NAME")).toThrow();
    expect(() => registry.get("default")).toThrow();
  });
});

describe("GatewayRegistry.get start spawn args", () => {
  it("spawns hermes gateway run for the default profile", async () => {
    const child = createFakeChild(123);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const { registry, resolver } = createRegistry(spawnGateway);

    await registry.get(null).start();

    expect(spawnGateway).toHaveBeenCalledWith(
      "hermes",
      ["gateway", "run"],
      expect.objectContaining({ cwd: resolver.resolveDataDir(null) }),
    );
  });

  it("spawns hermes --profile <name> gateway run for named profiles", async () => {
    const child = createFakeChild(456);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const { registry, resolver } = createRegistry(spawnGateway);

    await registry.get("alpha").start();

    expect(spawnGateway).toHaveBeenCalledWith(
      "hermes",
      ["--profile", "alpha", "gateway", "run"],
      expect.objectContaining({ cwd: resolver.resolveDataDir("alpha") }),
    );
  });
});

describe("GatewayRegistry.has + knownProfiles", () => {
  it("only reports profiles that have been touched", () => {
    const { registry } = createRegistry(vi.fn(() => createFakeChild(1)));
    expect(registry.has(null)).toBe(false);
    expect(registry.has("alpha")).toBe(false);
    registry.get("alpha");
    expect(registry.has("alpha")).toBe(true);
    expect(registry.has(null)).toBe(false);
    expect(registry.knownProfiles()).toEqual(["alpha"]);
  });
});

describe("GatewayRegistry.list", () => {
  it("includes the default profile, all known profiles, and additional ones (deduped)", async () => {
    const { registry } = createRegistry(vi.fn(() => createFakeChild(1)));
    registry.get("alpha");

    const summary = await registry.list(["alpha", "beta"], false);
    const slugs = summary.gateways.map((entry) => entry.profile);
    expect(slugs).toEqual([null, "alpha", "beta"]);
    for (const entry of summary.gateways) {
      expect(entry.status.state).toBe("stopped");
    }
  });

  it("returns stable shape with status snapshots when refreshHealth is false", async () => {
    const { registry } = createRegistry(vi.fn(() => createFakeChild(1)));
    const summary = await registry.list([], false);
    expect(summary.gateways).toEqual([
      expect.objectContaining({
        profile: null,
        status: expect.objectContaining({ state: "stopped" }),
        health: "unknown",
      }),
    ]);
  });
});

describe("GatewayRegistry.shutdownAll", () => {
  it("awaits shutdown for every running manager and isolates failures", async () => {
    const child = createFakeChild(1234);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const { registry } = createRegistry(spawnGateway);

    const manager = registry.get("alpha");
    await manager.start();

    const shutdownPromise = registry.shutdownAll();
    await vi.waitFor(() => {
      expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    });
    child.emit("exit", 0, null);
    await shutdownPromise;

    expect(manager.status()).toMatchObject({ state: "stopped", pid: null });
  });
});
