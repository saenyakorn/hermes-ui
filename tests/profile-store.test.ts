import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogStoreRegistry } from "../src/server/services/log-store-registry";
import { ProfileResolver } from "../src/server/services/paths";
import {
  ProfileStore,
  type IsProfileGatewayRunning,
  type RunHermes,
} from "../src/server/services/profile-store";

let rootDir = "";

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(os.tmpdir(), "hermes-profile-store-"));
  await mkdir(path.join(rootDir, "data", "profiles"), { recursive: true });
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

function createStore(
  runHermes: RunHermes,
  isGatewayRunning: IsProfileGatewayRunning = () => false,
): { store: ProfileStore; resolver: ProfileResolver } {
  const resolver = new ProfileResolver(rootDir);
  const logs = new LogStoreRegistry(resolver, () => "2026-04-29T00:00:00.000Z");
  const store = new ProfileStore(
    rootDir,
    resolver,
    logs,
    runHermes,
    () => "2026-04-29T00:00:00.000Z",
    isGatewayRunning,
  );
  return { store, resolver };
}

const okRun: RunHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));

describe("ProfileStore.list", () => {
  it("includes the default profile and discovered named profiles", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder"), { recursive: true });
    await mkdir(path.join(rootDir, "data", "profiles", "ops"), { recursive: true });
    const { store } = createStore(okRun);

    const list = await store.list();
    expect(list.active).toBeNull();
    expect(list.profiles.map((profile) => profile.name)).toEqual([null, "coder", "ops"]);
    expect(list.profiles[0]).toMatchObject({ name: null, label: "default", active: false });
    expect(list.profiles[1]).toMatchObject({ name: "coder", active: false });
  });

  it("ignores directory entries with invalid profile names", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder"), { recursive: true });
    await mkdir(path.join(rootDir, "data", "profiles", "BAD NAME"), { recursive: true });
    const { store } = createStore(okRun);
    const list = await store.list();
    expect(list.profiles.map((profile) => profile.name)).toEqual([null, "coder"]);
  });

  it("listProfileNames returns null + valid named slugs", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder"), { recursive: true });
    const { store } = createStore(okRun);
    await expect(store.listProfileNames()).resolves.toEqual([null, "coder"]);
  });
});

describe("ProfileStore.create", () => {
  it("invokes hermes profile create for blank profiles with HERMES_HOME set", async () => {
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store } = createStore(runHermes);

    await store.create({ name: "coder", mode: "blank" });

    expect(runHermes).toHaveBeenCalledTimes(1);
    expect(runHermes).toHaveBeenCalledWith(["profile", "create", "coder"], {
      cwd: path.join(rootDir, "data"),
      env: expect.objectContaining({ HERMES_HOME: path.join(rootDir, "data") }),
    });
  });

  it("uses --clone for clone mode", async () => {
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store } = createStore(runHermes);

    await store.create({ name: "work", mode: "clone" });
    expect(runHermes).toHaveBeenCalledWith(
      ["profile", "create", "work", "--clone"],
      expect.any(Object),
    );
  });

  it("uses --clone-all for clone-all mode and supports --clone-from", async () => {
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store } = createStore(runHermes);

    await store.create({ name: "backup", mode: "clone-all", cloneFrom: "coder" });
    expect(runHermes).toHaveBeenCalledWith(
      ["profile", "create", "backup", "--clone-all", "--clone-from", "coder"],
      expect.any(Object),
    );
  });

  it("rejects invalid names without invoking hermes", async () => {
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store } = createStore(runHermes);

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
    const { store } = createStore(runHermes);

    await expect(store.create({ name: "coder", mode: "blank" })).rejects.toThrow(/boom/);
  });

  it("translates ENOENT into HermesCliMissingError", async () => {
    const runHermes = vi.fn(async () => {
      const error = Object.assign(new Error("spawn hermes ENOENT"), { code: "ENOENT" });
      throw error;
    });
    const { store } = createStore(runHermes);

    await expect(store.create({ name: "coder", mode: "blank" })).rejects.toThrow(
      "Hermes CLI not found",
    );
  });
});

describe("ProfileStore.rename", () => {
  it("invokes hermes profile rename when the gateway is not running", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder"), { recursive: true });
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store } = createStore(runHermes);

    await mkdir(path.join(rootDir, "data", "profiles", "developer"), { recursive: true });
    await store.rename("coder", "developer");

    expect(runHermes).toHaveBeenCalledWith(
      ["profile", "rename", "coder", "developer"],
      expect.any(Object),
    );
  });

  it("refuses to rename a profile whose gateway is running", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder"), { recursive: true });
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store } = createStore(runHermes, (profile) => profile === "coder");

    await expect(store.rename("coder", "developer")).rejects.toThrow(
      /while its gateway is running/,
    );
    expect(runHermes).not.toHaveBeenCalled();
  });
});

describe("ProfileStore.remove", () => {
  it("invokes hermes profile delete --yes when the gateway is stopped", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "ops"), { recursive: true });
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store } = createStore(runHermes);

    await store.remove("ops");
    expect(runHermes).toHaveBeenCalledWith(
      ["profile", "delete", "ops", "--yes"],
      expect.any(Object),
    );
  });

  it("refuses to delete a profile whose gateway is currently running", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder"), { recursive: true });
    const runHermes = vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    const { store } = createStore(runHermes, (profile) => profile === "coder");

    await expect(store.remove("coder")).rejects.toThrow(/while its gateway is running/);
    expect(runHermes).not.toHaveBeenCalled();
  });
});
