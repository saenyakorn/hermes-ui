import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IPty } from "node-pty";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileResolver } from "../src/server/services/paths";
import { TerminalManager, type SpawnPty } from "../src/server/services/terminal-manager";

class FakePty extends EventEmitter implements IPty {
  readonly pid = 1234;
  readonly process = "bash";
  handleFlowControl = false;
  killed = false;
  writes: string[] = [];
  cols = 80;
  rows = 24;

  readonly onData = (listener: (event: string) => void) => {
    this.on("data", listener);
    return { dispose: () => this.off("data", listener) };
  };

  readonly onExit = (listener: (event: { exitCode: number; signal?: number }) => void) => {
    this.on("exit", listener);
    return { dispose: () => this.off("exit", listener) };
  };

  clear(): void {}

  pause(): void {}

  resume(): void {}

  write(input: string | Buffer): void {
    this.writes.push(input.toString());
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }

  kill(_signal?: string): void {
    this.killed = true;
  }
}

let rootDir = "";
let resolver: ProfileResolver;

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(os.tmpdir(), "hermes-terminal-manager-"));
  await mkdir(path.join(rootDir, "data", "profiles"), { recursive: true });
  resolver = new ProfileResolver(rootDir);
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe("TerminalManager", () => {
  it("spawns bash in the default profile data dir with HERMES_HOME set to cwd", () => {
    const fake = new FakePty();
    const spawnPty: SpawnPty = vi.fn(() => fake);
    const manager = new TerminalManager(resolver, spawnPty);

    const session = manager.create("socket-1", null);
    const expectedCwd = path.join(rootDir, "data");

    expect(spawnPty).toHaveBeenCalledWith("bash", [], {
      cwd: expectedCwd,
      cols: 80,
      rows: 24,
      env: { ...process.env, HERMES_HOME: expectedCwd },
    });
    session.write("pwd\n");
    expect(fake.writes).toEqual(["pwd\n"]);
  });

  it("scopes cwd / HERMES_HOME to the named profile passed in create", () => {
    const fake = new FakePty();
    const spawnPty: SpawnPty = vi.fn(() => fake);
    const manager = new TerminalManager(resolver, spawnPty);

    manager.create("socket-1", null);
    manager.create("socket-2", "coder");

    const defaultCwd = path.join(rootDir, "data");
    const coderCwd = path.join(rootDir, "data", "profiles", "coder");

    expect(spawnPty).toHaveBeenNthCalledWith(
      1,
      "bash",
      [],
      expect.objectContaining({ cwd: defaultCwd }),
    );
    expect(spawnPty).toHaveBeenNthCalledWith(
      2,
      "bash",
      [],
      expect.objectContaining({ cwd: coderCwd }),
    );
  });

  it("rejects invalid profile names", () => {
    const fake = new FakePty();
    const manager = new TerminalManager(resolver, () => fake);
    expect(() => manager.create("socket-1", "BAD NAME")).toThrow();
  });

  it("kills session on close", () => {
    const fake = new FakePty();
    const manager = new TerminalManager(resolver, () => fake);

    manager.create("socket-1", null);
    manager.close("socket-1");

    expect(fake.killed).toBe(true);
  });
});
