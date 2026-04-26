import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Document } from "yaml";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import type {
  ConfigReadResult,
  ConfigSaveResult,
  ConfigValidationIssue,
  ModelYamlPatch,
  WorkspaceConfigHints,
} from "../types";
import { DEFAULT_HERMES_CONFIG_YAML } from "../config/default-hermes-config";
import type { LogStore } from "./log-store";

const CONFIG_FILE_NAME = "config.yaml";

export class ConfigStore {
  constructor(
    private readonly dataDir: string,
    private readonly logs: LogStore,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async read(): Promise<ConfigReadResult> {
    await this.ensureConfigFile();
    const content = await readFile(this.getConfigPath(), "utf8");
    const metadata = await stat(this.getConfigPath());

    return {
      path: "data/config.yaml",
      content,
      updatedAt: metadata.mtime.toISOString(),
      validation: this.validate(content),
    };
  }

  /**
   * Merges non-empty string fields into `model` in config.yaml and saves.
   * Omitted or blank fields are left unchanged on disk.
   */
  async patchModel(updates: ModelYamlPatch): Promise<ConfigSaveResult> {
    const trimmed: Record<string, string> = {};
    for (const key of ["default", "provider", "base_url"] as const) {
      const value = updates[key];
      if (typeof value === "string" && value.trim().length > 0) {
        trimmed[key] = value.trim();
      }
    }
    if (Object.keys(trimmed).length === 0) {
      const current = await this.read();
      return { ...current, saved: false };
    }

    const { content } = await this.read();
    const document = parseDocument(content);
    const parseIssues: ConfigValidationIssue[] = document.errors.map((error) => ({
      message: `YAML parse error: ${error.message}`,
      path: null,
    }));
    if (parseIssues.length > 0) {
      const updatedAt = await this.getExistingUpdatedAt();
      return {
        path: "data/config.yaml",
        content,
        updatedAt,
        validation: { ok: false, issues: parseIssues },
        saved: false,
      };
    }
    if (document.contents === null || !isMap(document.contents)) {
      const updatedAt = await this.getExistingUpdatedAt();
      return {
        path: "data/config.yaml",
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

    return this.save(String(document));
  }

  async save(content: string): Promise<ConfigSaveResult> {
    await this.ensureDataDir();
    const validation = this.validate(content);

    if (!validation.ok) {
      await this.logs.append("gateway", "Config validation failed");
      const updatedAt = await this.getExistingUpdatedAt();

      return {
        path: "data/config.yaml",
        content,
        updatedAt,
        validation,
        saved: false,
      };
    }

    const temporaryPath = path.join(this.dataDir, `.config.yaml.${randomUUID()}.tmp`);

    try {
      await writeFile(temporaryPath, content);
      await rename(temporaryPath, this.getConfigPath());
    } catch (cause: unknown) {
      await rm(temporaryPath, { force: true });
      throw cause;
    }

    await this.logs.append("gateway", "Config saved");
    const saved = await this.read();

    return {
      ...saved,
      saved: true,
    };
  }

  /**
   * Reads `model.*` and `discord.allowed_users` for UI fields (best-effort if YAML is invalid).
   */
  async getWorkspaceConfigHints(): Promise<WorkspaceConfigHints> {
    const empty: WorkspaceConfigHints = {
      model: { default: null, provider: null, base_url: null },
      discord: { allowed_users: null },
    };
    const { content } = await this.read();
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
        allowed_users: this.yamlDiscordAllowedUsers(document),
      },
    };
  }

  /**
   * Sets or clears `discord.allowed_users` in config.yaml (comma-separated user IDs).
   * Pass an empty string to remove the key.
   */
  async patchDiscordAllowedUsers(allowed_users: string): Promise<ConfigSaveResult> {
    const { content } = await this.read();
    const document = parseDocument(content);
    const parseIssues: ConfigValidationIssue[] = document.errors.map((error) => ({
      message: `YAML parse error: ${error.message}`,
      path: null,
    }));
    if (parseIssues.length > 0) {
      const updatedAt = await this.getExistingUpdatedAt();
      return {
        path: "data/config.yaml",
        content,
        updatedAt,
        validation: { ok: false, issues: parseIssues },
        saved: false,
      };
    }
    if (document.contents === null || !isMap(document.contents)) {
      const updatedAt = await this.getExistingUpdatedAt();
      return {
        path: "data/config.yaml",
        content,
        updatedAt,
        validation: {
          ok: false,
          issues: [{ message: "Config root must be a YAML mapping.", path: null }],
        },
        saved: false,
      };
    }

    const trimmed = allowed_users.trim();
    if (trimmed.length === 0) {
      const discordMap = document.getIn(["discord"]);
      if (isMap(discordMap)) {
        discordMap.delete("allowed_users");
      }
    } else {
      document.setIn(["discord", "allowed_users"], trimmed);
    }

    return this.save(String(document));
  }

  async initialize(): Promise<void> {
    await this.ensureConfigFile();
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

  private yamlDiscordAllowedUsers(document: Document): string | null {
    const node = document.getIn(["discord", "allowed_users"]);
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

  private async ensureConfigFile(): Promise<void> {
    await this.ensureDataDir();

    try {
      await stat(this.getConfigPath());
    } catch (cause: unknown) {
      if (!this.isMissingFileError(cause)) {
        throw cause;
      }

      try {
        await writeFile(this.getConfigPath(), DEFAULT_HERMES_CONFIG_YAML, { flag: "wx" });
        await this.logs.append("gateway", "Created starter config at data/config.yaml");
      } catch (writeCause: unknown) {
        if (!this.isFileErrorCode(writeCause, "EEXIST")) {
          throw writeCause;
        }
      }
    }
  }

  private async ensureDataDir(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
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

  private getConfigPath(): string {
    return path.join(this.dataDir, CONFIG_FILE_NAME);
  }

  private async getExistingUpdatedAt(): Promise<string | null> {
    try {
      const metadata = await stat(this.getConfigPath());

      return metadata.mtime.toISOString();
    } catch (cause: unknown) {
      if (this.isMissingFileError(cause)) {
        return null;
      }

      throw cause;
    }
  }

  private isMissingFileError(cause: unknown): boolean {
    return this.isFileErrorCode(cause, "ENOENT");
  }

  private isFileErrorCode(cause: unknown, code: string): boolean {
    return cause instanceof Error && "code" in cause && cause.code === code;
  }
}
