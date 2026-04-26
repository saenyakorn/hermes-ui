import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isMap, parseDocument } from "yaml";
import type { ConfigReadResult, ConfigSaveResult, ConfigValidationIssue } from "../types";
import type { LogStore } from "./log-store";

const STARTER_CONFIG = "# Hermes Agent config\n# Add Hermes settings here.\n{}\n";
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

    const temporaryPath = path.join(this.dataDir, `.config.yaml.${process.pid}.${Date.now()}.tmp`);

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

  private async ensureConfigFile(): Promise<void> {
    await this.ensureDataDir();

    try {
      await stat(this.getConfigPath());
    } catch (cause: unknown) {
      if (!this.isMissingFileError(cause)) {
        throw cause;
      }

      await writeFile(this.getConfigPath(), STARTER_CONFIG, { flag: "wx" });
      await this.logs.append("gateway", "Created starter config at data/config.yaml");
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

    if (document.contents !== null && !isMap(document.contents)) {
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
    return cause instanceof Error && "code" in cause && cause.code === "ENOENT";
  }
}
