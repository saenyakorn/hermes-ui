import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProfileResolver } from "../src/server/services/paths";
import { ProfileFiles } from "../src/server/services/profile-files";

let rootDir = "";
let resolver: ProfileResolver;
let files: ProfileFiles;

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(os.tmpdir(), "hermes-profile-files-"));
  await mkdir(path.join(rootDir, "data", "profiles", "coder"), { recursive: true });
  resolver = new ProfileResolver(rootDir);
  await resolver.initialize();
  files = new ProfileFiles(resolver);
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe("ProfileFiles.read", () => {
  it("returns empty content with null updatedAt for missing files", async () => {
    const result = await files.read(null, "soul");
    expect(result.content).toBe("");
    expect(result.updatedAt).toBeNull();
    expect(result.path).toBe("data/SOUL.md");
  });

  it("reads existing files and reports relative path with profile prefix", async () => {
    await writeFile(path.join(rootDir, "data", "SOUL.md"), "you are hermes\n");
    const result = await files.read(null, "soul");
    expect(result.content).toBe("you are hermes\n");
    expect(result.updatedAt).not.toBeNull();
    expect(result.path).toBe("data/SOUL.md");
  });

  it("reads memory and user files for the named profile", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder", "memories"), {
      recursive: true,
    });
    await writeFile(
      path.join(rootDir, "data", "profiles", "coder", "memories", "MEMORY.md"),
      "memory body",
    );

    const memory = await files.read("coder", "memory");
    expect(memory.content).toBe("memory body");
    expect(memory.path).toBe("data/profiles/coder/memories/MEMORY.md");

    const user = await files.read("coder", "user");
    expect(user.content).toBe("");
    expect(user.path).toBe("data/profiles/coder/memories/USER.md");
  });

  it("rejects invalid profile names", async () => {
    await expect(files.read("../etc", "soul")).rejects.toThrow();
  });
});

describe("ProfileFiles.write", () => {
  it("creates parent directories and writes the file atomically", async () => {
    const result = await files.write("coder", "user", "hello user\n");

    const onDisk = await readFile(
      path.join(rootDir, "data", "profiles", "coder", "memories", "USER.md"),
      "utf8",
    );
    expect(onDisk).toBe("hello user\n");
    expect(result.saved).toBe(true);
    expect(result.content).toBe("hello user\n");
    expect(result.updatedAt).not.toBeNull();
  });

  it("overwrites existing content", async () => {
    await mkdir(path.join(rootDir, "data", "profiles", "coder", "memories"), {
      recursive: true,
    });
    await writeFile(
      path.join(rootDir, "data", "profiles", "coder", "memories", "MEMORY.md"),
      "old",
    );

    await files.write("coder", "memory", "new");

    const onDisk = await readFile(
      path.join(rootDir, "data", "profiles", "coder", "memories", "MEMORY.md"),
      "utf8",
    );
    expect(onDisk).toBe("new");
  });

  it("rejects invalid profile names without writing", async () => {
    await expect(files.write("../etc", "soul", "x")).rejects.toThrow();
  });

  it("does not leave stray temp files on success", async () => {
    await files.write("coder", "soul", "hi");
    const fs = await import("node:fs/promises");
    const entries = await fs.readdir(path.join(rootDir, "data", "profiles", "coder"));
    expect(entries.filter((entry) => entry.includes(".tmp"))).toHaveLength(0);
  });
});
