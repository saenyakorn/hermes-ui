import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_HERMES_CONFIG_YAML } from "../src/server/config/default-hermes-config";
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
    expect(result.content).toBe(DEFAULT_HERMES_CONFIG_YAML);
    expect(result.updatedAt).not.toBeNull();
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toBe(
      DEFAULT_HERMES_CONFIG_YAML,
    );
    await expect(readAuditLog()).resolves.toContain("Created starter config at data/config.yaml");
  });

  it("handles concurrent starter config creation", async () => {
    const store = createStore();

    const results = await Promise.all(Array.from({ length: 8 }, () => store.read()));

    for (const result of results) {
      expect(result.path).toBe("data/config.yaml");
      expect(result.content).toBe(DEFAULT_HERMES_CONFIG_YAML);
      expect(result.updatedAt).not.toBeNull();
      expect(result.validation).toEqual({ ok: true, issues: [] });
    }
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toBe(
      DEFAULT_HERMES_CONFIG_YAML,
    );
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

  it("patchModel merges into existing model map and saves", async () => {
    const store = createStore();

    const result = await store.patchModel({ default: "openai/gpt-4o" });

    expect(result.saved).toBe(true);
    expect(result.validation.ok).toBe(true);
    expect(result.content).toContain("openai/gpt-4o");
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toContain(
      "openai/gpt-4o",
    );
  });

  it("patchModel returns saved false when no fields to apply", async () => {
    const store = createStore();

    const result = await store.patchModel({});

    expect(result.saved).toBe(false);
    await expect(readFile(path.join(tmpDir, "config.yaml"), "utf8")).resolves.toBe(
      DEFAULT_HERMES_CONFIG_YAML,
    );
  });

  it("getWorkspaceConfigHints reads model and discord allowlist", async () => {
    const store = createStore();
    await writeFile(
      path.join(tmpDir, "config.yaml"),
      'model:\n  default: "x/y"\n  provider: openrouter\ndiscord:\n  allowed_users: "1,2"\n',
      "utf8",
    );

    const hints = await store.getWorkspaceConfigHints();

    expect(hints.model.default).toBe("x/y");
    expect(hints.model.provider).toBe("openrouter");
    expect(hints.model.base_url).toBeNull();
    expect(hints.discord.allowed_users).toBe("1,2");
  });

  it("patchDiscordAllowedUsers writes and empty string clears the key", async () => {
    const store = createStore();

    const saved = await store.patchDiscordAllowedUsers("10,11");
    expect(saved.saved).toBe(true);
    expect((await store.getWorkspaceConfigHints()).discord.allowed_users).toBe("10,11");

    const cleared = await store.patchDiscordAllowedUsers("");
    expect(cleared.saved).toBe(true);
    expect((await store.getWorkspaceConfigHints()).discord.allowed_users).toBeNull();
  });

  it("getWorkspaceConfigHints joins discord allowed_users YAML sequence", async () => {
    const store = createStore();
    await writeFile(
      path.join(tmpDir, "config.yaml"),
      'discord:\n  allowed_users:\n    - "a"\n    - b\n',
      "utf8",
    );

    const hints = await store.getWorkspaceConfigHints();
    expect(hints.discord.allowed_users).toBe("a,b");
  });

  it("getWorkspaceConfigHints reads discord booleans, lists, and allow_mentions", async () => {
    const store = createStore();
    await writeFile(
      path.join(tmpDir, "config.yaml"),
      [
        "discord:",
        "  require_mention: false",
        "  ignored_channels:",
        '    - "111"',
        '    - "222"',
        "  allow_mentions:",
        "    everyone: true",
        "    roles: false",
        "    users: true",
        "    replied_user: false",
        "",
      ].join("\n"),
      "utf8",
    );

    const hints = await store.getWorkspaceConfigHints();
    expect(hints.discord.require_mention).toBe("false");
    expect(hints.discord.ignored_channels).toBe("111,222");
    expect(hints.discord.allow_mentions_everyone).toBe("true");
    expect(hints.discord.allow_mentions_roles).toBe("false");
    expect(hints.discord.allow_mentions_users).toBe("true");
    expect(hints.discord.allow_mentions_replied_user).toBe("false");
  });
});
