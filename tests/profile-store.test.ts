import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogStore } from "../src/server/services/log-store";
import { ProfileResolver } from "../src/server/services/paths";
import { ProfileStore, type RunHermes } from "../src/server/services/profile-store";

let rootDir = "";

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(os.tmpdir(), "hermes-profile-store-"));
  await mkdir(path.join(rootDir, "data", "profiles"), { recursive: true });
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

function createStore(runHermes: RunHermes): { store: ProfileStore; resolver: ProfileResolver } {
  const resolver = new ProfileResolver(rootDir);
  const logs = new LogStore(
    () => resolver.getLogsDir(),
    () => "2026-04-29T00:00:00.000Z",
  );
  const store = new ProfileStore(
    rootDir,
    resolver,
    logs,
    runHermes,
    () => "2026-04-29T00:00:00.000Z",
  );
  return { store, resolver };
}

const okRun: RunHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));

describe("ProfileStore.list", () => {
  it("includes the default profile and discovered named profiles", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder"), { recursive: true });
    await mkdir(path.join(rootDir, "data", "profiles", "ops"), { recursive: true });
    const { store, resolver } = createStore(okRun);
    await resolver.initialize();

    const list = await store.list();
    expect(list.active).toBeNull();
    expect(list.profiles.map((profile) => profile.name)).toEqual([null, "coder", "ops"]);
    expect(list.profiles[0]).toMatchObject({ name: null, active: true, label: "default" });
    expect(list.profiles[1]).toMatchObject({ name: "coder", active: false });
  });

  it("ignores directory entries with invalid profile names", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder"), { recursive: true });
    await mkdir(path.join(rootDir, "data", "profiles", "BAD NAME"), { recursive: true });
    const { store, resolver } = createStore(okRun);
    await resolver.initialize();
    const list = await store.list();
    expect(list.profiles.map((profile) => profile.name)).toEqual([null, "coder"]);
  });
});

describe("ProfileStore.create", () => {
  it("invokes hermes profile create for blank profiles with HERMES_HOME set", async () => {
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store, resolver } = createStore(runHermes);
    await resolver.initialize();

    await store.create({ name: "coder", mode: "blank" });

    expect(runHermes).toHaveBeenCalledTimes(1);
    expect(runHermes).toHaveBeenCalledWith(["profile", "create", "coder"], {
      cwd: path.join(rootDir, "data"),
      env: expect.objectContaining({ HERMES_HOME: path.join(rootDir, "data") }),
    });
  });

  it("uses --clone for clone mode", async () => {
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store, resolver } = createStore(runHermes);
    await resolver.initialize();

    await store.create({ name: "work", mode: "clone" });
    expect(runHermes).toHaveBeenCalledWith(
      ["profile", "create", "work", "--clone"],
      expect.any(Object),
    );
  });

  it("uses --clone-all for clone-all mode and supports --clone-from", async () => {
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store, resolver } = createStore(runHermes);
    await resolver.initialize();

    await store.create({ name: "backup", mode: "clone-all", cloneFrom: "coder" });
    expect(runHermes).toHaveBeenCalledWith(
      ["profile", "create", "backup", "--clone-all", "--clone-from", "coder"],
      expect.any(Object),
    );
  });

  it("rejects invalid names without invoking hermes", async () => {
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store, resolver } = createStore(runHermes);
    await resolver.initialize();

    await expect(store.create({ name: "default", mode: "blank" })).rejects.toThrow();
    await expect(store.create({ name: "../etc", mode: "blank" })).rejects.toThrow();
    expect(runHermes).not.toHaveBeenCalled();
  });

  it("propagates a typed error when hermes exits non-zero", async () => {
    const runHermes = vi.fn(async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "boom",
    }));
    const { store, resolver } = createStore(runHermes);
    await resolver.initialize();

    await expect(store.create({ name: "coder", mode: "blank" })).rejects.toThrow(/boom/);
  });

  it("translates ENOENT into HermesCliMissingError", async () => {
    const runHermes = vi.fn(async () => {
      const error = Object.assign(new Error("spawn hermes ENOENT"), { code: "ENOENT" });
      throw error;
    });
    const { store, resolver } = createStore(runHermes);
    await resolver.initialize();

    await expect(store.create({ name: "coder", mode: "blank" })).rejects.toThrow(
      "Hermes CLI not found",
    );
  });
});

describe("ProfileStore.rename", () => {
  it("invokes hermes profile rename and updates the active marker if required", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder"), { recursive: true });
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store, resolver } = createStore(runHermes);
    await resolver.initialize();
    await resolver.setActive("coder");

    await mkdir(path.join(rootDir, "data", "profiles", "developer"), { recursive: true });
    await store.rename("coder", "developer");

    expect(runHermes).toHaveBeenCalledWith(
      ["profile", "rename", "coder", "developer"],
      expect.any(Object),
    );
    expect(resolver.getActive()).toBe("developer");
  });
});

describe("ProfileStore.remove", () => {
  it("invokes hermes profile delete --yes", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "ops"), { recursive: true });
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store, resolver } = createStore(runHermes);
    await resolver.initialize();

    await store.remove("ops");
    expect(runHermes).toHaveBeenCalledWith(
      ["profile", "delete", "ops", "--yes"],
      expect.any(Object),
    );
  });

  it("refuses to delete the currently active profile", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder"), { recursive: true });
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store, resolver } = createStore(runHermes);
    await resolver.initialize();
    await resolver.setActive("coder");

    await expect(store.remove("coder")).rejects.toThrow(/active profile/);
    expect(runHermes).not.toHaveBeenCalled();
  });
});

describe("ProfileStore.activate", () => {
  it("does not stop or start the gateway when target equals active", async () => {
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store, resolver } = createStore(runHermes);
    await resolver.initialize();
    const status = baseStatus("stopped");
    const gateway = makeGateway(status);

    const result = await store.activate(null, gateway);
    expect(result.active).toBeNull();
    expect(gateway.stop).not.toHaveBeenCalled();
    expect(gateway.start).not.toHaveBeenCalled();
  });

  it("stops the running gateway, switches the marker, and restarts it", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder"), { recursive: true });
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store, resolver } = createStore(runHermes);
    await resolver.initialize();

    const stoppedSnapshot = baseStatus("stopped");
    const runningSnapshot = baseStatus("running");
    const gateway = makeGateway(runningSnapshot);
    gateway.stop = vi.fn(async () => stoppedSnapshot);
    gateway.start = vi.fn(async () => runningSnapshot);

    const result = await store.activate("coder", gateway);

    expect(gateway.stop).toHaveBeenCalledTimes(1);
    expect(gateway.start).toHaveBeenCalledTimes(1);
    expect(resolver.getActive()).toBe("coder");
    expect(result.restart).toEqual({ attempted: true, ok: true, error: null });
    expect(result.active).toBe("coder");
  });

  it("does not start the gateway when it was not running", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder"), { recursive: true });
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store, resolver } = createStore(runHermes);
    await resolver.initialize();

    const stoppedSnapshot = baseStatus("stopped");
    const gateway = makeGateway(stoppedSnapshot);

    const result = await store.activate("coder", gateway);
    expect(gateway.stop).not.toHaveBeenCalled();
    expect(gateway.start).not.toHaveBeenCalled();
    expect(result.restart).toEqual({ attempted: false, ok: true, error: null });
  });

  it("rejects activating a profile that does not exist", async () => {
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store, resolver } = createStore(runHermes);
    await resolver.initialize();
    await expect(store.setActive("missing")).rejects.toThrow(/does not exist/);
  });
});

import type { GatewayStatus } from "../src/server/types";

function baseStatus(state: GatewayStatus["state"]): GatewayStatus {
  return {
    state,
    health: "unknown",
    pid: state === "running" ? 1234 : null,
    cwd: "/repo/data",
    startedAt: state === "running" ? "2026-04-29T00:00:00.000Z" : null,
    uptimeMs: state === "running" ? 1000 : null,
    exitCode: null,
    lastError: null,
    logWarning: null,
  };
}

function makeGateway(snapshot: GatewayStatus) {
  return {
    status: vi.fn(() => snapshot),
    stop: vi.fn(async () => snapshot),
    start: vi.fn(async () => snapshot),
  };
}
