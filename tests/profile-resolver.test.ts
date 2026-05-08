import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigStore } from "../src/server/services/config-store";
import { GatewayManager, type SpawnGateway } from "../src/server/services/gateway-manager";
import { LogStore } from "../src/server/services/log-store";
import { LogStoreRegistry } from "../src/server/services/log-store-registry";
import {
  ProfileResolver,
  isValidProfileName,
  resolveProfileDataDir,
  validateProfileName,
} from "../src/server/services/paths";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

let rootDir = "";

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(os.tmpdir(), "hermes-profile-resolver-"));
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe("validateProfileName", () => {
  it("accepts simple slugs", () => {
    expect(() => validateProfileName("coder")).not.toThrow();
    expect(() => validateProfileName("a1")).not.toThrow();
    expect(() => validateProfileName("my-bot_2")).not.toThrow();
  });

  it("rejects empty, traversal, and reserved names", () => {
    expect(() => validateProfileName("")).toThrow();
    expect(() => validateProfileName(".")).toThrow();
    expect(() => validateProfileName("..")).toThrow();
    expect(() => validateProfileName("../etc")).toThrow();
    expect(() => validateProfileName("a/b")).toThrow();
    expect(() => validateProfileName("a\\b")).toThrow();
    expect(() => validateProfileName("default")).toThrow();
    expect(() => validateProfileName("PROFILES")).toThrow();
    expect(() => validateProfileName("Bad Name")).toThrow();
  });

  it("isValidProfileName mirrors validateProfileName as a boolean", () => {
    expect(isValidProfileName("coder")).toBe(true);
    expect(isValidProfileName("../etc")).toBe(false);
  });
});

describe("resolveProfileDataDir", () => {
  it("returns rootDir/data for the default profile", () => {
    expect(resolveProfileDataDir("/repo", null)).toBe(path.join("/repo", "data"));
  });

  it("returns rootDir/data/profiles/<name> for named profiles", () => {
    expect(resolveProfileDataDir("/repo", "coder")).toBe(
      path.join("/repo", "data", "profiles", "coder"),
    );
  });
});

describe("ProfileResolver", () => {
  it("resolves the default data and logs directories", () => {
    const resolver = new ProfileResolver(rootDir);
    expect(resolver.resolveDataDir(null)).toBe(path.join(rootDir, "data"));
    expect(resolver.resolveLogsDir(null)).toBe(path.join(rootDir, "data", "logs"));
    expect(resolver.getRootDataDir()).toBe(path.join(rootDir, "data"));
  });

  it("resolves named profile directories under data/profiles", () => {
    const resolver = new ProfileResolver(rootDir);
    expect(resolver.resolveDataDir("coder")).toBe(path.join(rootDir, "data", "profiles", "coder"));
    expect(resolver.resolveLogsDir("coder")).toBe(
      path.join(rootDir, "data", "profiles", "coder", "logs"),
    );
  });

  it("readLegacyActiveProfile returns null when the marker is absent", async () => {
    const fs = await import("node:fs/promises");
    await fs.mkdir(path.join(rootDir, "data"), { recursive: true });
    const resolver = new ProfileResolver(rootDir);
    await expect(resolver.readLegacyActiveProfile()).resolves.toBeNull();
  });

  it("readLegacyActiveProfile reads a valid marker once for migration", async () => {
    const fs = await import("node:fs/promises");
    await fs.mkdir(path.join(rootDir, "data"), { recursive: true });
    await writeFile(path.join(rootDir, "data", ".active_profile"), "coder");
    const resolver = new ProfileResolver(rootDir);
    await expect(resolver.readLegacyActiveProfile()).resolves.toBe("coder");
  });

  it("readLegacyActiveProfile ignores invalid marker contents", async () => {
    const fs = await import("node:fs/promises");
    await fs.mkdir(path.join(rootDir, "data"), { recursive: true });
    await writeFile(path.join(rootDir, "data", ".active_profile"), "../escape");
    const resolver = new ProfileResolver(rootDir);
    await expect(resolver.readLegacyActiveProfile()).resolves.toBeNull();
  });
});

describe("services accept explicit profiles", () => {
  it("ConfigStore.read targets the specified profile's data dir", async () => {
    const fs = await import("node:fs/promises");
    const dataDir = path.join(rootDir, "data");
    const profileDir = path.join(dataDir, "profiles", "coder");
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(profileDir, { recursive: true });
    await writeFile(path.join(dataDir, "config.yaml"), "default: true\n");
    await writeFile(path.join(profileDir, "config.yaml"), "coder: true\n");

    const resolver = new ProfileResolver(rootDir);
    const logsRegistry = new LogStoreRegistry(resolver, () => "2026-04-26T10:30:00.000Z");
    const config = new ConfigStore(resolver, logsRegistry, () => "2026-04-26T10:30:00.000Z");

    expect((await config.read(null)).content).toBe("default: true\n");
    expect((await config.read("coder")).content).toBe("coder: true\n");
  });

  it("LogStoreRegistry.get returns a per-profile LogStore reading the matching dir", async () => {
    const fs = await import("node:fs/promises");
    const defaultLogs = path.join(rootDir, "data", "logs");
    const coderLogs = path.join(rootDir, "data", "profiles", "coder", "logs");
    await fs.mkdir(defaultLogs, { recursive: true });
    await fs.mkdir(coderLogs, { recursive: true });
    await writeFile(
      path.join(defaultLogs, "2026-04-26.log"),
      "[2026-04-26T10:30:00.000Z] [gateway] default\n",
    );
    await writeFile(
      path.join(coderLogs, "2026-04-26.log"),
      "[2026-04-26T10:30:00.000Z] [gateway] coder\n",
    );

    const resolver = new ProfileResolver(rootDir);
    const registry = new LogStoreRegistry(resolver, () => "2026-04-26T10:30:00.000Z");

    const defaultTail = await registry.get(null).tail(10);
    expect(defaultTail.lines.at(-1)).toContain("default");

    const coderTail = await registry.get("coder").tail(10);
    expect(coderTail.lines.at(-1)).toContain("coder");
  });

  it("GatewayManager.start spawns hermes with the cwd and HERMES_HOME of the bound profile", async () => {
    const fs = await import("node:fs/promises");
    const coderDir = path.join(rootDir, "data", "profiles", "coder");
    await fs.mkdir(coderDir, { recursive: true });

    const logs = new LogStore(coderDir, () => "2026-04-26T10:30:00.000Z");
    const child = createFakeChild(1234);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = new GatewayManager(
      "coder",
      coderDir,
      logs,
      spawnGateway,
      () => "2026-04-26T10:30:00.000Z",
    );

    await manager.start();
    expect(spawnGateway).toHaveBeenLastCalledWith(
      "hermes",
      ["--profile", "coder", "gateway", "run"],
      {
        cwd: coderDir,
        env: expect.objectContaining({ HERMES_HOME: coderDir }),
        detached: true,
        stdio: ["pipe"],
      },
    );
  });
});

type FakeChild = ChildProcessWithoutNullStreams & {
  kill: ReturnType<typeof vi.fn>;
};

function createFakeChild(pid: number | undefined): FakeChild {
  const kill = vi.fn(() => true);
  return Object.assign(new EventEmitter(), {
    pid,
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill,
  }) as unknown as FakeChild;
}
