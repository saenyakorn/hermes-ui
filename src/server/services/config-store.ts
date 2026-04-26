import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isMap, parseDocument } from "yaml";
import type {
  ConfigReadResult,
  ConfigSaveResult,
  ConfigValidationIssue,
  ModelYamlPatch,
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

  async initialize(): Promise<void> {
    await this.ensureConfigFile();
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
