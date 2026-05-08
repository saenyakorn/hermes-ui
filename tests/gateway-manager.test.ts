import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildGatewayArgs,
  GatewayManager,
  type SpawnGateway,
} from "../src/server/services/gateway-manager";
import { LogStore } from "../src/server/services/log-store";

type FakeChildProcess = ChildProcessWithoutNullStreams & {
  readonly kill: ReturnType<typeof vi.fn<(signal?: NodeJS.Signals | number) => boolean>>;
};

let tmpDir = "";

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-gateway-manager-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
  vi.useRealTimers();
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

function createManager(
  spawnGateway: SpawnGateway,
  profile: string | null = null,
): GatewayManager {
  return new GatewayManager(
    profile,
    "/workspace/project",
    new LogStore(tmpDir, () => "2026-04-26T10:30:00.000Z"),
    spawnGateway,
    () => "2026-04-26T10:30:00.000Z",
  );
}

describe("GatewayManager", () => {
  it("starts hermes gateway once in the configured cwd", async () => {
    const child = createFakeChild(1234);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = createManager(spawnGateway);

    const status = await manager.start();

    expect(spawnGateway).toHaveBeenCalledTimes(1);
    expect(spawnGateway).toHaveBeenCalledWith("hermes", ["gateway", "run"], {
      cwd: "/workspace/project",
      env: { ...process.env, HERMES_HOME: "/workspace/project" },
      detached: true,
      stdio: ["pipe"],
    });
    expect(status).toMatchObject({
      state: "running",
      health: "unknown",
      pid: 1234,
      cwd: "/workspace/project",
      startedAt: "2026-04-26T10:30:00.000Z",
      exitCode: null,
      lastError: null,
    });
  });

  it("includes --profile <name> when bound to a non-default profile", async () => {
    const child = createFakeChild(4321);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = createManager(spawnGateway, "alpha");

    await manager.start();

    expect(spawnGateway).toHaveBeenCalledWith(
      "hermes",
      ["--profile", "alpha", "gateway", "run"],
      expect.objectContaining({ cwd: "/workspace/project" }),
    );
  });

  it("buildGatewayArgs encodes the profile flag correctly", () => {
    expect(buildGatewayArgs(null)).toEqual(["gateway", "run"]);
    expect(buildGatewayArgs("alpha")).toEqual(["--profile", "alpha", "gateway", "run"]);
  });

  it("rejects duplicate start while gateway is running", async () => {
    const child = createFakeChild(1234);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = createManager(spawnGateway);

    await manager.start();

    await expect(manager.start()).rejects.toThrow("Gateway already running");
    expect(spawnGateway).toHaveBeenCalledTimes(1);
  });

  it("returns stopped when stopping an already stopped gateway", async () => {
    const spawnGateway: SpawnGateway = vi.fn(() => createFakeChild(1234));
    const manager = createManager(spawnGateway);

    const status = await manager.stop();

    expect(spawnGateway).not.toHaveBeenCalled();
    expect(status).toMatchObject({
      state: "stopped",
      health: "unknown",
      pid: null,
      cwd: "/workspace/project",
      startedAt: null,
      exitCode: null,
      lastError: null,
    });
  });

  it("shutdown resolves immediately when gateway is already stopped", async () => {
    const spawnGateway: SpawnGateway = vi.fn(() => createFakeChild(1234));
    const manager = createManager(spawnGateway);

    await manager.shutdown();

    expect(spawnGateway).not.toHaveBeenCalled();
  });

  it("shutdown waits for child exit after stop", async () => {
    const child = createFakeChild(1234);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = createManager(spawnGateway);

    await manager.start();

    const done = manager.shutdown();
    await vi.waitFor(() => {
      expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    });

    child.emit("exit", 0, null);

    await done;

    expect(manager.status()).toMatchObject({ state: "stopped", pid: null });
  });

  it("waits for asynchronous child exit before restart spawns another gateway", async () => {
    const firstChild = createFakeChild(1234);
    const secondChild = createFakeChild(5678);
    const spawnGateway: SpawnGateway = vi
      .fn()
      .mockReturnValueOnce(firstChild)
      .mockReturnValueOnce(secondChild);
    const manager = createManager(spawnGateway);

    await manager.start();

    const restart = manager.restart().then(
      (status) => ({ ok: true as const, status }),
      (cause: unknown) => ({ ok: false as const, cause }),
    );
    await vi.waitFor(() => {
      expect(firstChild.kill).toHaveBeenCalledWith("SIGTERM");
    });

    expect(spawnGateway).toHaveBeenCalledTimes(1);

    firstChild.emit("exit", 0, null);

    const result = await restart;

    expect(result).toMatchObject({
      ok: true,
      status: {
        state: "running",
        pid: 5678,
      },
    });
    expect(spawnGateway).toHaveBeenCalledTimes(2);
    expect(spawnGateway).toHaveBeenLastCalledWith("hermes", ["gateway", "run"], {
      cwd: "/workspace/project",
      env: { ...process.env, HERMES_HOME: "/workspace/project" },
      detached: true,
      stdio: ["pipe"],
    });
  });

  it("marks SIGTERM from controlled stop as stopped", async () => {
    const child = createFakeChild(1234);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = createManager(spawnGateway);

    await manager.start();
    await manager.stop();

    child.emit("exit", null, "SIGTERM");

    expect(manager.status()).toMatchObject({
      state: "stopped",
      pid: null,
      startedAt: null,
      uptimeMs: null,
      exitCode: null,
      lastError: null,
    });
  });

  it("marks unexpected SIGTERM as crashed", async () => {
    const child = createFakeChild(1234);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = createManager(spawnGateway);

    await manager.start();

    child.emit("exit", null, "SIGTERM");

    expect(manager.status()).toMatchObject({
      state: "crashed",
      pid: null,
      exitCode: null,
      lastError: "Gateway exited with signal SIGTERM",
    });
  });

  it("rejects and clears process state when spawn emits an error", async () => {
    const child = createFakeChild(undefined);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = createManager(spawnGateway);
    const start = manager.start();

    child.emit("error", new Error("spawn hermes ENOENT"));

    await expect(start).rejects.toThrow("spawn hermes ENOENT");
    expect(manager.status()).toMatchObject({
      state: "crashed",
      pid: null,
      startedAt: null,
      lastError:
        'Hermes CLI not found: unable to execute "hermes". Install Hermes Agent in this environment so the hermes command is available on PATH.',
    });
  });

  it("reports an actionable error when the hermes command is missing", async () => {
    const child = createFakeChild(undefined);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = createManager(spawnGateway);
    const start = manager.start();
    const error = Object.assign(new Error("spawn hermes ENOENT"), {
      code: "ENOENT",
      syscall: "spawn hermes",
    });

    child.emit("error", error);

    await expect(start).rejects.toThrow("spawn hermes ENOENT");
    expect(manager.status().lastError).toBe(
      'Hermes CLI not found: unable to execute "hermes". Install Hermes Agent in this environment so the hermes command is available on PATH.',
    );
  });
});
