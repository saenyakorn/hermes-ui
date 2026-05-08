import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isMap, isScalar, isSeq, parse, parseDocument, stringify } from "yaml";
import type {
  ConfigReadResult,
  ConfigSaveResult,
  ConfigValidationIssue,
  DiscordSettingsPatch,
  ModelYamlPatch,
  WorkspaceConfigHints,
} from "../types";
import { DEFAULT_HERMES_CONFIG_YAML } from "../config/default-hermes-config";
import type { LogStoreRegistry } from "./log-store-registry";
import type { ProfileResolver } from "./paths";
import { validateProfileName } from "./paths";

const CONFIG_FILE_NAME = "config.yaml";

function getDisplayConfigPath(profile: string | null): string {
  if (profile === null) {
    return "data/config.yaml";
  }
  return `data/profiles/${profile}/config.yaml`;
}

function emptyDiscordHints(): WorkspaceConfigHints["discord"] {
  return {
    allowed_users: null,
    allowed_channels: null,
    require_mention: null,
    free_response_channels: null,
    auto_thread: null,
    reactions: null,
    ignored_channels: null,
    no_thread_channels: null,
    channel_prompts: null,
    allow_mentions_everyone: null,
    allow_mentions_roles: null,
    allow_mentions_users: null,
    allow_mentions_replied_user: null,
  };
}

/**
 * Reads and writes `<profileDataDir>/config.yaml` for an explicit profile.
 * Methods take `profile: string | null` ("null" = default profile) — there is
 * no global active profile.
 */
export class ConfigStore {
  constructor(
    private readonly resolver: ProfileResolver,
    private readonly logsRegistry: LogStoreRegistry,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async read(profile: string | null): Promise<ConfigReadResult> {
    this.assertValidProfile(profile);
    await this.ensureConfigFile(profile);
    const configPath = this.getConfigPath(profile);
    const content = await readFile(configPath, "utf8");
    const metadata = await stat(configPath);

    return {
      path: getDisplayConfigPath(profile),
      content,
      updatedAt: metadata.mtime.toISOString(),
      validation: this.validate(content),
    };
  }

  /**
   * Merges non-empty string fields into `model` in config.yaml and saves.
   * Omitted or blank fields are left unchanged on disk.
   */
  async patchModel(profile: string | null, updates: ModelYamlPatch): Promise<ConfigSaveResult> {
    this.assertValidProfile(profile);
    const trimmed: Record<string, string> = {};
    for (const key of ["default", "provider", "base_url"] as const) {
      const value = updates[key];
      if (typeof value === "string" && value.trim().length > 0) {
        trimmed[key] = value.trim();
      }
    }
    if (Object.keys(trimmed).length === 0) {
      const current = await this.read(profile);
      return { ...current, saved: false };
    }

    const { content } = await this.read(profile);
    const document = parseDocument(content);
    const parseIssues: ConfigValidationIssue[] = document.errors.map((error) => ({
      message: `YAML parse error: ${error.message}`,
      path: null,
    }));
    if (parseIssues.length > 0) {
      const updatedAt = await this.getExistingUpdatedAt(profile);
      return {
        path: getDisplayConfigPath(profile),
        content,
        updatedAt,
        validation: { ok: false, issues: parseIssues },
        saved: false,
      };
    }
    if (document.contents === null || !isMap(document.contents)) {
      const updatedAt = await this.getExistingUpdatedAt(profile);
      return {
        path: getDisplayConfigPath(profile),
        content,
        updatedAt,
        validation: {
          ok: false,
          issues: [{ message: "Config root must be a YAML mapping.", path: null }],
        },
        saved: false,
      };
    }

    for (const [yamlKey, value] of Object.entries(trimmed)) {
      document.setIn(["model", yamlKey], value);
    }

    return this.save(profile, String(document));
  }

  async save(profile: string | null, content: string): Promise<ConfigSaveResult> {
    this.assertValidProfile(profile);
    await this.ensureDataDir(profile);
    const validation = this.validate(content);
    const logs = this.logsRegistry.get(profile);

    if (!validation.ok) {
      await logs.append("gateway", "Config validation failed");
      const updatedAt = await this.getExistingUpdatedAt(profile);

      return {
        path: getDisplayConfigPath(profile),
        content,
        updatedAt,
        validation,
        saved: false,
      };
    }

    const dataDir = this.resolver.resolveDataDir(profile);
    const temporaryPath = path.join(dataDir, `.config.yaml.${randomUUID()}.tmp`);

    try {
      await writeFile(temporaryPath, content);
      await rename(temporaryPath, this.getConfigPath(profile));
    } catch (cause: unknown) {
      await rm(temporaryPath, { force: true });
      throw cause;
    }

    await logs.append("gateway", "Config saved");
    const saved = await this.read(profile);

    return {
      ...saved,
      saved: true,
    };
  }

  /**
   * Reads `model.*` and `discord.*` keys used by the workspace Messaging UI (best-effort if YAML is invalid).
   */
  async getWorkspaceConfigHints(profile: string | null): Promise<WorkspaceConfigHints> {
    this.assertValidProfile(profile);
    const empty: WorkspaceConfigHints = {
      model: { default: null, provider: null, base_url: null },
      discord: emptyDiscordHints(),
      group_sessions_per_user: null,
    };
    const { content } = await this.read(profile);
    const document = parseDocument(content);
    if (document.errors.length > 0 || document.contents === null || !isMap(document.contents)) {
      return empty;
    }

    return {
      model: {
        default: this.yamlScalarToString(document.getIn(["model", "default"])),
        provider: this.yamlScalarToString(document.getIn(["model", "provider"])),
        base_url: this.yamlScalarToString(document.getIn(["model", "base_url"])),
      },
      discord: {
        allowed_users: this.yamlNodeToListOrScalarDisplay(
          document.getIn(["discord", "allowed_users"]),
        ),
        allowed_channels: this.yamlNodeToListOrScalarDisplay(
          document.getIn(["discord", "allowed_channels"]),
        ),
        require_mention: this.yamlScalarToString(document.getIn(["discord", "require_mention"])),
        free_response_channels: this.yamlNodeToListOrScalarDisplay(
          document.getIn(["discord", "free_response_channels"]),
        ),
        auto_thread: this.yamlScalarToString(document.getIn(["discord", "auto_thread"])),
        reactions: this.yamlScalarToString(document.getIn(["discord", "reactions"])),
        ignored_channels: this.yamlNodeToListOrScalarDisplay(
          document.getIn(["discord", "ignored_channels"]),
        ),
        no_thread_channels: this.yamlNodeToListOrScalarDisplay(
          document.getIn(["discord", "no_thread_channels"]),
        ),
        channel_prompts: this.yamlMappingNodeToChannelPromptsDisplay(
          document.getIn(["discord", "channel_prompts"]),
        ),
        allow_mentions_everyone: this.yamlScalarToString(
          document.getIn(["discord", "allow_mentions", "everyone"]),
        ),
        allow_mentions_roles: this.yamlScalarToString(
          document.getIn(["discord", "allow_mentions", "roles"]),
        ),
        allow_mentions_users: this.yamlScalarToString(
          document.getIn(["discord", "allow_mentions", "users"]),
        ),
        allow_mentions_replied_user: this.yamlScalarToString(
          document.getIn(["discord", "allow_mentions", "replied_user"]),
        ),
      },
      group_sessions_per_user: this.yamlScalarToString(document.getIn(["group_sessions_per_user"])),
    };
  }

  /**
   * Sets/clears workspace-managed Discord settings in config.yaml.
   */
  async patchDiscordSettings(
    profile: string | null,
    updates: DiscordSettingsPatch,
  ): Promise<ConfigSaveResult> {
    this.assertValidProfile(profile);
    const { content } = await this.read(profile);
    const document = parseDocument(content);
    const parseIssues: ConfigValidationIssue[] = document.errors.map((error) => ({
      message: `YAML parse error: ${error.message}`,
      path: null,
    }));
    if (parseIssues.length > 0) {
      const updatedAt = await this.getExistingUpdatedAt(profile);
      return {
        path: getDisplayConfigPath(profile),
        content,
        updatedAt,
        validation: { ok: false, issues: parseIssues },
        saved: false,
      };
    }
    if (document.contents === null || !isMap(document.contents)) {
      const updatedAt = await this.getExistingUpdatedAt(profile);
      return {
        path: getDisplayConfigPath(profile),
        content,
        updatedAt,
        validation: {
          ok: false,
          issues: [{ message: "Config root must be a YAML mapping.", path: null }],
        },
        saved: false,
      };
    }

    const applyStringValue = (pathParts: readonly string[], value: string | undefined): void => {
      if (value === undefined) {
        return;
      }
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        const parentPath = pathParts.slice(0, -1);
        const leaf = pathParts[pathParts.length - 1];
        const parent = document.getIn(parentPath);
        if (isMap(parent)) {
          parent.delete(leaf);
        }
        return;
      }
      document.setIn(pathParts, trimmed);
    };
    const applyBooleanString = (pathParts: readonly string[], value: string | undefined): void => {
      if (value === undefined) {
        return;
      }
      const normalized = value.trim().toLowerCase();
      if (normalized.length === 0) {
        const parentPath = pathParts.slice(0, -1);
        const leaf = pathParts[pathParts.length - 1];
        const parent = document.getIn(parentPath);
        if (isMap(parent)) {
          parent.delete(leaf);
        }
        return;
      }
      if (normalized === "true" || normalized === "false") {
        document.setIn(pathParts, normalized === "true");
      }
    };
    const applyChannelPromptsMappingString = (
      pathParts: readonly string[],
      value: string | undefined,
    ): void => {
      if (value === undefined) {
        return;
      }
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        const parentPath = pathParts.slice(0, -1);
        const leaf = pathParts[pathParts.length - 1];
        const parent = document.getIn(parentPath);
        if (isMap(parent)) {
          parent.delete(leaf);
        }
        return;
      }
      let parsed: unknown;
      try {
        parsed = parse(trimmed);
      } catch {
        try {
          parsed = JSON.parse(trimmed) as unknown;
        } catch {
          return;
        }
      }
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        document.setIn(pathParts, parsed);
      }
    };

    applyStringValue(["discord", "allowed_users"], updates.allowed_users);
    applyBooleanString(["discord", "require_mention"], updates.require_mention);
    applyStringValue(["discord", "free_response_channels"], updates.free_response_channels);
    applyBooleanString(["discord", "auto_thread"], updates.auto_thread);
    applyBooleanString(["discord", "reactions"], updates.reactions);
    applyStringValue(["discord", "ignored_channels"], updates.ignored_channels);
    applyStringValue(["discord", "no_thread_channels"], updates.no_thread_channels);
    applyChannelPromptsMappingString(["discord", "channel_prompts"], updates.channel_prompts);
    applyBooleanString(["discord", "allow_mentions", "everyone"], updates.allow_mentions_everyone);
    applyBooleanString(["discord", "allow_mentions", "roles"], updates.allow_mentions_roles);
    applyBooleanString(["discord", "allow_mentions", "users"], updates.allow_mentions_users);
    applyBooleanString(
      ["discord", "allow_mentions", "replied_user"],
      updates.allow_mentions_replied_user,
    );
    applyBooleanString(["group_sessions_per_user"], updates.group_sessions_per_user);

    return this.save(profile, String(document));
  }

  /**
   * Backward-compatible helper for allowlist-only patching.
   */
  async patchDiscordAllowedUsers(
    profile: string | null,
    allowed_users: string,
  ): Promise<ConfigSaveResult> {
    return this.patchDiscordSettings(profile, { allowed_users });
  }

  /** Ensures `<profileDataDir>/config.yaml` exists for the default profile at boot. */
  async initializeDefault(): Promise<void> {
    await this.ensureConfigFile(null);
  }

  private yamlNodeToListOrScalarDisplay(node: unknown): string | null {
    if (node === null || node === undefined) {
      return null;
    }
    if (typeof node === "string") {
      return node;
    }
    if (typeof node === "number" || typeof node === "boolean") {
      return String(node);
    }
    if (isScalar(node)) {
      const value = node.value;
      if (value === null || value === undefined) {
        return null;
      }
      return typeof value === "string" ? value : String(value);
    }
    if (isSeq(node)) {
      const parts: string[] = [];
      for (const item of node.items) {
        if (item === null || item === undefined) {
          continue;
        }
        if (isScalar(item) && item.value !== null && item.value !== undefined) {
          parts.push(String(item.value));
        }
      }
      return parts.length > 0 ? parts.join(",") : null;
    }
    return null;
  }

  /**
   * `discord.channel_prompts` is a mapping in YAML; surface it as plain YAML text in the workspace UI.
   * Legacy configs may store a JSON object string — normalize to YAML for display.
   */
  private yamlMappingNodeToChannelPromptsDisplay(node: unknown): string | null {
    if (node === null || node === undefined) {
      return null;
    }
    if (isMap(node)) {
      return stringify(node.toJSON()).trimEnd();
    }
    const scalarText = this.yamlScalarToString(node);
    if (scalarText === null) {
      return null;
    }
    const trimmed = scalarText.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          return stringify(parsed).trimEnd();
        }
      } catch {
        return scalarText;
      }
    }
    return scalarText;
  }

  private yamlScalarToString(node: unknown): string | null {
    if (node === null || node === undefined) {
      return null;
    }
    if (typeof node === "string") {
      return node;
    }
    if (typeof node === "number" || typeof node === "boolean") {
      return String(node);
    }
    if (isScalar(node)) {
      const value = node.value;
      if (value === null || value === undefined) {
        return null;
      }
      return typeof value === "string" ? value : String(value);
    }
    return null;
  }

  private async ensureConfigFile(profile: string | null): Promise<void> {
    await this.ensureDataDir(profile);
    const configPath = this.getConfigPath(profile);

    try {
      await stat(configPath);
    } catch (cause: unknown) {
      if (!this.isMissingFileError(cause)) {
        throw cause;
      }

      try {
        await writeFile(configPath, DEFAULT_HERMES_CONFIG_YAML, { flag: "wx" });
        await this.logsRegistry
          .get(profile)
          .append("gateway", `Created starter config at ${getDisplayConfigPath(profile)}`);
      } catch (writeCause: unknown) {
        if (!this.isFileErrorCode(writeCause, "EEXIST")) {
          throw writeCause;
        }
      }
    }
  }

  private async ensureDataDir(profile: string | null): Promise<void> {
    await mkdir(this.resolver.resolveDataDir(profile), { recursive: true });
  }

  private validate(content: string): { ok: boolean; issues: ConfigValidationIssue[] } {
    const document = parseDocument(content);
    const issues: ConfigValidationIssue[] = document.errors.map((error) => ({
      message: `YAML parse error: ${error.message}`,
      path: null,
    }));

    if (issues.length > 0) {
      return { ok: false, issues };
    }

    if (document.contents === null || !isMap(document.contents)) {
      return {
        ok: false,
        issues: [{ message: "Config root must be a YAML mapping.", path: null }],
      };
    }

    return { ok: true, issues: [] };
  }

  private getConfigPath(profile: string | null): string {
    return path.join(this.resolver.resolveDataDir(profile), CONFIG_FILE_NAME);
  }

  private async getExistingUpdatedAt(profile: string | null): Promise<string | null> {
    try {
      const metadata = await stat(this.getConfigPath(profile));
      return metadata.mtime.toISOString();
    } catch (cause: unknown) {
      if (this.isMissingFileError(cause)) {
        return null;
      }

      throw cause;
    }
  }

  private assertValidProfile(profile: string | null): void {
    if (profile !== null) {
      validateProfileName(profile);
    }
  }

  private isMissingFileError(cause: unknown): boolean {
    return this.isFileErrorCode(cause, "ENOENT");
  }

  private isFileErrorCode(cause: unknown, code: string): boolean {
    return cause instanceof Error && "code" in cause && cause.code === code;
  }
}
