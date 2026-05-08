import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EnvStore } from "../src/server/services/env-store";
import { ProfileResolver } from "../src/server/services/paths";

let rootDir = "";
let dataDir = "";

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(os.tmpdir(), "hermes-env-store-"));
  dataDir = path.join(rootDir, "data");
  await mkdir(dataDir, { recursive: true });
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

function createStore(): EnvStore {
  const resolver = new ProfileResolver(rootDir);
  return new EnvStore(resolver);
}

describe("EnvStore", () => {
  it("applyBatch sets multiple keys in one write", async () => {
    const store = createStore();

    await store.applyBatch(null, {
      set: {
        DISCORD_BOT_TOKEN: "secret-one",
        SLACK_BOT_TOKEN: "xoxb-test",
      },
    });

    const raw = await readFile(path.join(dataDir, ".env"), "utf8");
    expect(raw).toContain("DISCORD_BOT_TOKEN=");
    expect(raw).toContain("SLACK_BOT_TOKEN=");
    const read = await store.read(null);
    expect(read.entries.map((e) => e.key).sort()).toEqual(["DISCORD_BOT_TOKEN", "SLACK_BOT_TOKEN"]);
  });

  it("applyBatch remove deletes keys and preserves others", async () => {
    await writeFile(path.join(dataDir, ".env"), 'FOO=1\nDISCORD_BOT_TOKEN="old"\nBAR=2\n', "utf8");
    const store = createStore();

    await store.applyBatch(null, { remove: ["DISCORD_BOT_TOKEN"] });

    const raw = await readFile(path.join(dataDir, ".env"), "utf8");
    expect(raw).toContain("FOO=");
    expect(raw).toContain("BAR=");
    expect(raw).not.toContain("DISCORD");
    const read = await store.read(null);
    expect(read.entries.map((e) => e.key).sort()).toEqual(["BAR", "FOO"]);
  });

  it("applyBatch applies remove then set", async () => {
    await writeFile(path.join(dataDir, ".env"), 'DISCORD_BOT_TOKEN="old"\n', "utf8");
    const store = createStore();

    await store.applyBatch(null, {
      remove: ["DISCORD_BOT_TOKEN"],
      set: { DISCORD_BOT_TOKEN: "new-token" },
    });

    const raw = await readFile(path.join(dataDir, ".env"), "utf8");
    expect(raw).toContain("new-token");
    expect(raw).not.toContain("old");
  });

  it("applyBatch rejects empty batch", async () => {
    const store = createStore();

    await expect(store.applyBatch(null, {})).rejects.toThrow(
      "Batch must include at least one set or remove entry",
    );
  });

  it("applyBatch rejects invalid key in set", async () => {
    const store = createStore();

    await expect(store.applyBatch(null, { set: { "bad-key": "x" } })).rejects.toThrow(
      "Env key must match",
    );
  });

  it("applyBatch rejects invalid key in remove", async () => {
    await writeFile(path.join(dataDir, ".env"), "FOO=1\n", "utf8");
    const store = createStore();

    await expect(store.applyBatch(null, { remove: ["bad"] })).rejects.toThrow(
      "Env key must match",
    );
  });

  it("read includes publicValue for Discord boolean/select env keys", async () => {
    await writeFile(
      path.join(dataDir, ".env"),
      "DISCORD_REQUIRE_MENTION=true\nDISCORD_BOT_TOKEN=secret\n",
      "utf8",
    );
    const store = createStore();
    const read = await store.read(null);
    const mention = read.entries.find((e) => e.key === "DISCORD_REQUIRE_MENTION");
    const token = read.entries.find((e) => e.key === "DISCORD_BOT_TOKEN");
    expect(mention?.publicValue).toBe("true");
    expect(token?.publicValue).toBeUndefined();
  });

  it("isolates writes between profiles", async () => {
    const store = createStore();
    const coderDir = path.join(dataDir, "profiles", "coder");
    await mkdir(coderDir, { recursive: true });

    await store.applyBatch(null, { set: { FOO: "default" } });
    await store.applyBatch("coder", { set: { FOO: "coder" } });

    expect(await readFile(path.join(dataDir, ".env"), "utf8")).toContain("default");
    expect(await readFile(path.join(coderDir, ".env"), "utf8")).toContain("coder");

    expect((await store.read(null)).entries.find((e) => e.key === "FOO")).toBeDefined();
    expect((await store.read("coder")).entries.find((e) => e.key === "FOO")).toBeDefined();
  });
});
