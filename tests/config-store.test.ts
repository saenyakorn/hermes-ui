import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_HERMES_CONFIG_YAML } from "../src/server/config/default-hermes-config";
import { ConfigStore } from "../src/server/services/config-store";
import { LogStoreRegistry } from "../src/server/services/log-store-registry";
import { ProfileResolver } from "../src/server/services/paths";

let rootDir = "";
let dataDir = "";

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(os.tmpdir(), "hermes-config-store-"));
  dataDir = path.join(rootDir, "data");
  await mkdir(path.join(dataDir, "logs"), { recursive: true });
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

function createStore(): ConfigStore {
  const resolver = new ProfileResolver(rootDir);
  const logs = new LogStoreRegistry(resolver, () => "2026-04-26T10:30:00.000Z");
  return new ConfigStore(resolver, logs, () => "2026-04-26T10:30:00.000Z");
}

async function readAuditLog(): Promise<string> {
  return readFile(path.join(dataDir, "logs", "2026-04-26.log"), "utf8");
}

describe("ConfigStore", () => {
  it("creates a starter config when config.yaml is missing", async () => {
    const store = createStore();

    const result = await store.read(null);

    expect(result.path).toBe("data/config.yaml");
    expect(result.content).toBe(DEFAULT_HERMES_CONFIG_YAML);
    expect(result.updatedAt).not.toBeNull();
    await expect(readFile(path.join(dataDir, "config.yaml"), "utf8")).resolves.toBe(
      DEFAULT_HERMES_CONFIG_YAML,
    );
    await expect(readAuditLog()).resolves.toContain("Created starter config at data/config.yaml");
  });

  it("handles concurrent starter config creation", async () => {
    const store = createStore();

    const results = await Promise.all(Array.from({ length: 8 }, () => store.read(null)));

    for (const result of results) {
      expect(result.path).toBe("data/config.yaml");
      expect(result.content).toBe(DEFAULT_HERMES_CONFIG_YAML);
      expect(result.updatedAt).not.toBeNull();
      expect(result.validation).toEqual({ ok: true, issues: [] });
    }
    await expect(readFile(path.join(dataDir, "config.yaml"), "utf8")).resolves.toBe(
      DEFAULT_HERMES_CONFIG_YAML,
    );
  });

  it("reads existing config content and metadata", async () => {
    await writeFile(path.join(dataDir, "config.yaml"), "gateway:\n  host: 127.0.0.1\n");
    const store = createStore();

    const result = await store.read(null);

    expect(result.content).toBe("gateway:\n  host: 127.0.0.1\n");
    expect(result.validation).toEqual({ ok: true, issues: [] });
    expect(result.updatedAt).not.toBeNull();
  });

  it("rejects malformed YAML without writing", async () => {
    await writeFile(path.join(dataDir, "config.yaml"), "gateway: {}\n");
    const store = createStore();

    const result = await store.save(null, "gateway:\n  - [broken");

    expect(result.saved).toBe(false);
    expect(result.validation.ok).toBe(false);
    expect(result.validation.issues[0]?.message).toContain("YAML");
    await expect(readFile(path.join(dataDir, "config.yaml"), "utf8")).resolves.toBe(
      "gateway: {}\n",
    );
    await expect(readAuditLog()).resolves.toContain("Config validation failed");
  });

  it("rejects invalid config without creating a missing config file", async () => {
    const store = createStore();

    const result = await store.save(null, "- invalid\n- root\n");

    expect(result.saved).toBe(false);
    expect(result.path).toBe("data/config.yaml");
    expect(result.content).toBe("- invalid\n- root\n");
    expect(result.updatedAt).toBeNull();
    expect(result.validation).toEqual({
      ok: false,
      issues: [{ message: "Config root must be a YAML mapping.", path: null }],
    });
    await expect(readFile(path.join(dataDir, "config.yaml"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readAuditLog()).resolves.toContain("Config validation failed");
  });

  it("rejects non-mapping YAML without writing", async () => {
    await writeFile(path.join(dataDir, "config.yaml"), "gateway: {}\n");
    const store = createStore();

    const result = await store.save(null, "- invalid\n- root\n");

    expect(result.saved).toBe(false);
    expect(result.validation).toEqual({
      ok: false,
      issues: [{ message: "Config root must be a YAML mapping.", path: null }],
    });
    await expect(readFile(path.join(dataDir, "config.yaml"), "utf8")).resolves.toBe(
      "gateway: {}\n",
    );
  });

  it("rejects empty YAML documents without writing", async () => {
    await writeFile(path.join(dataDir, "config.yaml"), "gateway: {}\n");
    const store = createStore();

    const result = await store.save(null, "  \n");

    expect(result.saved).toBe(false);
    expect(result.validation).toEqual({
      ok: false,
      issues: [{ message: "Config root must be a YAML mapping.", path: null }],
    });
    await expect(readFile(path.join(dataDir, "config.yaml"), "utf8")).resolves.toBe(
      "gateway: {}\n",
    );
  });

  it("writes valid config atomically", async () => {
    const store = createStore();

    const result = await store.save(null, "gateway:\n  port: 3000\n");

    expect(result.saved).toBe(true);
    expect(result.content).toBe("gateway:\n  port: 3000\n");
    expect(result.validation).toEqual({ ok: true, issues: [] });
    await expect(readFile(path.join(dataDir, "config.yaml"), "utf8")).resolves.toBe(
      "gateway:\n  port: 3000\n",
    );
    await expect(readAuditLog()).resolves.toContain("Config saved");
  });

  it("uses unique temporary files for concurrent saves", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_777_777_777);
    const store = createStore();

    const results = await Promise.all([
      store.save(null, "gateway:\n  port: 3000\n"),
      store.save(null, "gateway:\n  port: 9090\n"),
    ]);

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.saved).toBe(true);
      expect(result.validation).toEqual({ ok: true, issues: [] });
    }
    await expect(readFile(path.join(dataDir, "config.yaml"), "utf8")).resolves.toMatch(
      /^gateway:\n  port: (3000|9090)\n$/,
    );
  });

  it("allows unknown top-level keys for forward compatibility", async () => {
    const store = createStore();

    const result = await store.save(null, "futureHermesOption:\n  enabled: true\n");

    expect(result.saved).toBe(true);
    expect(result.validation.ok).toBe(true);
  });

  it("patchModel merges into existing model map and saves", async () => {
    const store = createStore();

    const result = await store.patchModel(null, { default: "openai/gpt-4o" });

    expect(result.saved).toBe(true);
    expect(result.validation.ok).toBe(true);
    expect(result.content).toContain("openai/gpt-4o");
    await expect(readFile(path.join(dataDir, "config.yaml"), "utf8")).resolves.toContain(
      "openai/gpt-4o",
    );
  });

  it("patchModel returns saved false when no fields to apply", async () => {
    const store = createStore();

    const result = await store.patchModel(null, {});

    expect(result.saved).toBe(false);
    await expect(readFile(path.join(dataDir, "config.yaml"), "utf8")).resolves.toBe(
      DEFAULT_HERMES_CONFIG_YAML,
    );
  });

  it("getWorkspaceConfigHints reads model and discord allowlist", async () => {
    const store = createStore();
    await writeFile(
      path.join(dataDir, "config.yaml"),
      'model:\n  default: "x/y"\n  provider: openrouter\ndiscord:\n  allowed_users: "1,2"\n',
      "utf8",
    );

    const hints = await store.getWorkspaceConfigHints(null);

    expect(hints.model.default).toBe("x/y");
    expect(hints.model.provider).toBe("openrouter");
    expect(hints.model.base_url).toBeNull();
    expect(hints.discord.allowed_users).toBe("1,2");
    expect(hints.group_sessions_per_user).toBeNull();
  });

  it("patchDiscordAllowedUsers writes and empty string clears the key", async () => {
    const store = createStore();

    const saved = await store.patchDiscordAllowedUsers(null, "10,11");
    expect(saved.saved).toBe(true);
    expect((await store.getWorkspaceConfigHints(null)).discord.allowed_users).toBe("10,11");

    const cleared = await store.patchDiscordAllowedUsers(null, "");
    expect(cleared.saved).toBe(true);
    expect((await store.getWorkspaceConfigHints(null)).discord.allowed_users).toBeNull();
  });

  it("getWorkspaceConfigHints joins discord allowed_users YAML sequence", async () => {
    const store = createStore();
    await writeFile(
      path.join(dataDir, "config.yaml"),
      'discord:\n  allowed_users:\n    - "a"\n    - b\n',
      "utf8",
    );

    const hints = await store.getWorkspaceConfigHints(null);
    expect(hints.discord.allowed_users).toBe("a,b");
  });

  it("getWorkspaceConfigHints reads discord booleans, lists, and allow_mentions", async () => {
    const store = createStore();
    await writeFile(
      path.join(dataDir, "config.yaml"),
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
        "group_sessions_per_user: true",
        "",
      ].join("\n"),
      "utf8",
    );

    const hints = await store.getWorkspaceConfigHints(null);
    expect(hints.discord.require_mention).toBe("false");
    expect(hints.discord.ignored_channels).toBe("111,222");
    expect(hints.discord.allow_mentions_everyone).toBe("true");
    expect(hints.discord.allow_mentions_roles).toBe("false");
    expect(hints.discord.allow_mentions_users).toBe("true");
    expect(hints.discord.allow_mentions_replied_user).toBe("false");
    expect(hints.group_sessions_per_user).toBe("true");
  });

  it("patchDiscordSettings writes discord booleans and group session isolation", async () => {
    const store = createStore();

    const saved = await store.patchDiscordSettings(null, {
      require_mention: "false",
      auto_thread: "true",
      allow_mentions_users: "false",
      channel_prompts: '"123": hello from prompt',
      group_sessions_per_user: "true",
    });

    expect(saved.saved).toBe(true);
    const hints = await store.getWorkspaceConfigHints(null);
    expect(hints.discord.require_mention).toBe("false");
    expect(hints.discord.auto_thread).toBe("true");
    expect(hints.discord.allow_mentions_users).toBe("false");
    expect(hints.discord.channel_prompts).toBe('"123": hello from prompt');
    expect(hints.group_sessions_per_user).toBe("true");
  });

  it("patchDiscordSettings accepts legacy JSON object string for channel_prompts", async () => {
    const store = createStore();

    const saved = await store.patchDiscordSettings(null, {
      channel_prompts: '{"456":"legacy prompt"}',
    });

    expect(saved.saved).toBe(true);
    const hints = await store.getWorkspaceConfigHints(null);
    expect(hints.discord.channel_prompts).toBe('"456": legacy prompt');
  });

  it("isolates writes between profiles", async () => {
    const store = createStore();
    await mkdir(path.join(dataDir, "profiles", "coder"), { recursive: true });

    await store.save(null, "gateway:\n  port: 3000\n");
    await store.save("coder", "gateway:\n  port: 4000\n");

    expect((await store.read(null)).content).toBe("gateway:\n  port: 3000\n");
    expect((await store.read("coder")).content).toBe("gateway:\n  port: 4000\n");
  });
});
