import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigStore } from "../src/server/services/config-store";
import { LogStore } from "../src/server/services/log-store";

let tmpDir = "";

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-config-store-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function createStore(): ConfigStore {
  const logs = new LogStore(path.join(tmpDir, "logs"), () => "2026-04-26T10:30:00.000Z");
  return new ConfigStore(tmpDir, logs, () => "2026-04-26T10:30:00.000Z");
}

async function readAuditLog(): Promise<string> {
  return readFile(path.join(tmpDir, "logs", "2026-04-26.log"), "utf8");
}

describe("ConfigStore", () => {
  it("creates a starter config when config.yaml is missing", async () => {
    const store = createStore();

    const result = await store.read();

    expect(result.path).toBe("data/config.yaml");
    expect(result.content).toContain("# Hermes Agent config");
    expect(result.content).toContain("{}");
    expect(result.updatedAt).not.toBeNull();
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toBe(result.content);
    await expect(readAuditLog()).resolves.toContain("Created starter config at data/config.yaml");
  });

  it("handles concurrent starter config creation", async () => {
    const store = createStore();

    const results = await Promise.all(Array.from({ length: 8 }, () => store.read()));

    for (const result of results) {
      expect(result.path).toBe("data/config.yaml");
      expect(result.content).toContain("# Hermes Agent config");
      expect(result.content).toContain("{}");
      expect(result.updatedAt).not.toBeNull();
      expect(result.validation).toEqual({ ok: true, issues: [] });
    }
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toBe(results[0]?.content);
  });

  it("reads existing config content and metadata", async () => {
    await writeFile(path.join(tmpDir, "config.yaml"), "gateway:\n  host: 127.0.0.1\n");
    const store = createStore();

    const result = await store.read();

    expect(result.content).toBe("gateway:\n  host: 127.0.0.1\n");
    expect(result.validation).toEqual({ ok: true, issues: [] });
    expect(result.updatedAt).not.toBeNull();
  });

  it("rejects malformed YAML without writing", async () => {
    await writeFile(path.join(tmpDir, "config.yaml"), "gateway: {}\n");
    const store = createStore();

    const result = await store.save("gateway:\n  - [broken");

    expect(result.saved).toBe(false);
    expect(result.validation.ok).toBe(false);
    expect(result.validation.issues[0]?.message).toContain("YAML");
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toBe("gateway: {}\n");
    await expect(readAuditLog()).resolves.toContain("Config validation failed");
  });

  it("rejects invalid config without creating a missing config file", async () => {
    const store = createStore();

    const result = await store.save("- invalid\n- root\n");

    expect(result.saved).toBe(false);
    expect(result.path).toBe("data/config.yaml");
    expect(result.content).toBe("- invalid\n- root\n");
    expect(result.updatedAt).toBeNull();
    expect(result.validation).toEqual({
      ok: false,
      issues: [{ message: "Config root must be a YAML mapping.", path: null }],
    });
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readAuditLog()).resolves.toContain("Config validation failed");
  });

  it("rejects non-mapping YAML without writing", async () => {
    await writeFile(path.join(tmpDir, "config.yaml"), "gateway: {}\n");
    const store = createStore();

    const result = await store.save("- invalid\n- root\n");

    expect(result.saved).toBe(false);
    expect(result.validation).toEqual({
      ok: false,
      issues: [{ message: "Config root must be a YAML mapping.", path: null }],
    });
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toBe("gateway: {}\n");
  });

  it("rejects empty YAML documents without writing", async () => {
    await writeFile(path.join(tmpDir, "config.yaml"), "gateway: {}\n");
    const store = createStore();

    const result = await store.save("  \n");

    expect(result.saved).toBe(false);
    expect(result.validation).toEqual({
      ok: false,
      issues: [{ message: "Config root must be a YAML mapping.", path: null }],
    });
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toBe("gateway: {}\n");
  });

  it("writes valid config atomically", async () => {
    const store = createStore();

    const result = await store.save("gateway:\n  port: 8080\n");

    expect(result.saved).toBe(true);
    expect(result.content).toBe("gateway:\n  port: 8080\n");
    expect(result.validation).toEqual({ ok: true, issues: [] });
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toBe(
      "gateway:\n  port: 8080\n",
    );
    await expect(readAuditLog()).resolves.toContain("Config saved");
  });

  it("uses unique temporary files for concurrent saves", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_777_777_777);
    const store = createStore();

    const results = await Promise.all([
      store.save("gateway:\n  port: 8080\n"),
      store.save("gateway:\n  port: 9090\n"),
    ]);

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.saved).toBe(true);
      expect(result.validation).toEqual({ ok: true, issues: [] });
    }
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toMatch(
      /^gateway:\n  port: (8080|9090)\n$/,
    );
  });

  it("allows unknown top-level keys for forward compatibility", async () => {
    const store = createStore();

    const result = await store.save("futureHermesOption:\n  enabled: true\n");

    expect(result.saved).toBe(true);
    expect(result.validation.ok).toBe(true);
  });
});
