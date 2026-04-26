import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EnvStore } from "../src/server/services/env-store";

let tmpDir = "";

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-env-store-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function createStore(): EnvStore {
  return new EnvStore(tmpDir);
}

describe("EnvStore", () => {
  it("applyBatch sets multiple keys in one write", async () => {
    const store = createStore();

    await store.applyBatch({
      set: {
        DISCORD_BOT_TOKEN: "secret-one",
        SLACK_BOT_TOKEN: "xoxb-test",
      },
    });

    const raw = await readFile(path.join(tmpDir, ".env"), "utf8");
    expect(raw).toContain("DISCORD_BOT_TOKEN=");
    expect(raw).toContain("SLACK_BOT_TOKEN=");
    const read = await store.read();
    expect(read.entries.map((e) => e.key).sort()).toEqual([
      "DISCORD_BOT_TOKEN",
      "SLACK_BOT_TOKEN",
    ]);
  });

  it("applyBatch remove deletes keys and preserves others", async () => {
    await writeFile(
      path.join(tmpDir, ".env"),
      'FOO=1\nDISCORD_BOT_TOKEN="old"\nBAR=2\n',
      "utf8",
    );
    const store = createStore();

    await store.applyBatch({ remove: ["DISCORD_BOT_TOKEN"] });

    const raw = await readFile(path.join(tmpDir, ".env"), "utf8");
    expect(raw).toContain("FOO=");
    expect(raw).toContain("BAR=");
    expect(raw).not.toContain("DISCORD");
    const read = await store.read();
    expect(read.entries.map((e) => e.key).sort()).toEqual(["BAR", "FOO"]);
  });

  it("applyBatch applies remove then set", async () => {
    await writeFile(path.join(tmpDir, ".env"), 'DISCORD_BOT_TOKEN="old"\n', "utf8");
    const store = createStore();

    await store.applyBatch({
      remove: ["DISCORD_BOT_TOKEN"],
      set: { DISCORD_BOT_TOKEN: "new-token" },
    });

    const raw = await readFile(path.join(tmpDir, ".env"), "utf8");
    expect(raw).toContain("new-token");
    expect(raw).not.toContain("old");
  });

  it("applyBatch rejects empty batch", async () => {
    const store = createStore();

    await expect(store.applyBatch({})).rejects.toThrow(
      "Batch must include at least one set or remove entry",
    );
  });

  it("applyBatch rejects invalid key in set", async () => {
    const store = createStore();

    await expect(
      store.applyBatch({ set: { "bad-key": "x" } }),
    ).rejects.toThrow("Env key must match");
  });

  it("applyBatch rejects invalid key in remove", async () => {
    await writeFile(path.join(tmpDir, ".env"), "FOO=1\n", "utf8");
    const store = createStore();

    await expect(store.applyBatch({ remove: ["bad"] })).rejects.toThrow("Env key must match");
  });
});
