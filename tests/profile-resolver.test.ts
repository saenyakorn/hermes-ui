import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigStore } from "../src/server/services/config-store";
import { GatewayManager, type SpawnGateway } from "../src/server/services/gateway-manager";
import { LogStore } from "../src/server/services/log-store";
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
  it("starts on the default profile when no marker exists", async () => {
    const resolver = new ProfileResolver(rootDir);
    await resolver.initialize();
    expect(resolver.getActive()).toBeNull();
    expect(resolver.getDataDir()).toBe(path.join(rootDir, "data"));
    expect(resolver.getLogsDir()).toBe(path.join(rootDir, "data", "logs"));
  });

  it("loads the active profile from data/.active_profile when present", async () => {
    await writeFile(path.join(rootDir, "data", ".active_profile"), "coder", {
      flag: "w",
    }).catch(async () => {
      // ENOENT for missing data/ — create it then retry.
      await import("node:fs/promises").then((fs) =>
        fs.mkdir(path.join(rootDir, "data"), { recursive: true }),
      );
      await writeFile(path.join(rootDir, "data", ".active_profile"), "coder");
    });
    const resolver = new ProfileResolver(rootDir);
    await resolver.initialize();
    expect(resolver.getActive()).toBe("coder");
    expect(resolver.getDataDir()).toBe(path.join(rootDir, "data", "profiles", "coder"));
  });

  it("ignores invalid marker contents", async () => {
    const fs = await import("node:fs/promises");
    await fs.mkdir(path.join(rootDir, "data"), { recursive: true });
    await writeFile(path.join(rootDir, "data", ".active_profile"), "../escape");
    const resolver = new ProfileResolver(rootDir);
    await resolver.initialize();
    expect(resolver.getActive()).toBeNull();
  });

  it("setActive persists the marker atomically and notifies listeners", async () => {
    const fs = await import("node:fs/promises");
    await fs.mkdir(path.join(rootDir, "data"), { recursive: true });
    const resolver = new ProfileResolver(rootDir);
    await resolver.initialize();
    const listener = vi.fn();
    resolver.subscribe(listener);

    await resolver.setActive("coder");
    expect(resolver.getActive()).toBe("coder");
    await expect(readFile(path.join(rootDir, "data", ".active_profile"), "utf8")).resolves.toBe(
      "coder",
    );
    expect(listener).toHaveBeenCalledWith("coder");

    await resolver.setActive(null);
    expect(resolver.getActive()).toBeNull();
    await expect(readFile(path.join(rootDir, "data", ".active_profile"), "utf8")).rejects.toThrow();
    expect(listener).toHaveBeenLastCalledWith(null);
  });

  it("rejects invalid names on setActive", async () => {
    const fs = await import("node:fs/promises");
    await fs.mkdir(path.join(rootDir, "data"), { recursive: true });
    const resolver = new ProfileResolver(rootDir);
    await resolver.initialize();
    await expect(resolver.setActive("../escape")).rejects.toThrow();
  });
});

describe("services follow profile switches", () => {
  it("ConfigStore.read targets the active profile's data dir", async () => {
    const fs = await import("node:fs/promises");
    const dataDir = path.join(rootDir, "data");
    const profileDir = path.join(dataDir, "profiles", "coder");
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(profileDir, { recursive: true });
    await writeFile(path.join(dataDir, "config.yaml"), "default: true\n");
    await writeFile(path.join(profileDir, "config.yaml"), "coder: true\n");

    const resolver = new ProfileResolver(rootDir);
    await resolver.initialize();
    const logs = new LogStore(
      () => resolver.getLogsDir(),
      () => "2026-04-26T10:30:00.000Z",
    );
    const config = new ConfigStore(
      () => resolver.getDataDir(),
      logs,
      () => "2026-04-26T10:30:00.000Z",
    );

    const beforeSwitch = await config.read();
    expect(beforeSwitch.content).toBe("default: true\n");

    await resolver.setActive("coder");
    const afterSwitch = await config.read();
    expect(afterSwitch.content).toBe("coder: true\n");
  });

  it("LogStore.tail re-reads from the active profile's logs dir", async () => {
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
    await resolver.initialize();
    const logs = new LogStore(
      () => resolver.getLogsDir(),
      () => "2026-04-26T10:30:00.000Z",
    );

    const beforeSwitch = await logs.tail(10);
    expect(beforeSwitch.lines.at(-1)).toContain("default");

    await resolver.setActive("coder");
    const afterSwitch = await logs.tail(10);
    expect(afterSwitch.lines.at(-1)).toContain("coder");
  });

  it("GatewayManager.start spawns hermes with HERMES_HOME for the active profile", async () => {
    const fs = await import("node:fs/promises");
    await fs.mkdir(path.join(rootDir, "data"), { recursive: true });

    const resolver = new ProfileResolver(rootDir);
    await resolver.initialize();
    const logs = new LogStore(
      () => resolver.getLogsDir(),
      () => "2026-04-26T10:30:00.000Z",
    );

    const child = createFakeChild(1234);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = new GatewayManager(
      () => resolver.getDataDir(),
      logs,
      spawnGateway,
      () => "2026-04-26T10:30:00.000Z",
    );

    await manager.start();
    expect(spawnGateway).toHaveBeenLastCalledWith("hermes", ["gateway"], {
      cwd: path.join(rootDir, "data"),
      env: expect.objectContaining({ HERMES_HOME: path.join(rootDir, "data") }),
    });

    await manager.stop();
    child.emit("exit", 0, null);

    await resolver.setActive("coder");
    const child2 = createFakeChild(5678);
    (spawnGateway as ReturnType<typeof vi.fn>).mockReturnValueOnce(child2);
    await manager.start();
    expect(spawnGateway).toHaveBeenLastCalledWith("hermes", ["gateway"], {
      cwd: path.join(rootDir, "data", "profiles", "coder"),
      env: expect.objectContaining({
        HERMES_HOME: path.join(rootDir, "data", "profiles", "coder"),
      }),
    });
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
