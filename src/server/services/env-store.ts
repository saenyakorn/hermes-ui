import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseEnv } from "dotenv";
import type { EnvReadResult } from "../types";

const ENV_FILE_NAME = ".env";
const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

export class EnvStore {
  constructor(
    private readonly dataDir: string,
  ) {}

  async read(): Promise<EnvReadResult> {
    await this.ensureDataDir();
    const content = await this.readRawContent();
    const parsed = parseEnv(content);
    const metadata = await this.getUpdatedAt();
    const entries = Object.entries(parsed)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => ({
        key,
        maskedValue: this.maskValue(value),
      }));

    return {
      path: "data/.env",
      updatedAt: metadata,
      entries,
    };
  }

  async upsert(key: string, value: string): Promise<EnvReadResult> {
    this.validateKey(key);
    await this.ensureDataDir();
    const parsed = parseEnv(await this.readRawContent());
    parsed[key] = value;
    await this.writeParsed(parsed);
    return this.read();
  }

  async remove(key: string): Promise<EnvReadResult> {
    this.validateKey(key);
    await this.ensureDataDir();
    const parsed = parseEnv(await this.readRawContent());
    delete parsed[key];
    await this.writeParsed(parsed);
    return this.read();
  }

  /**
   * Apply multiple env changes in one atomic write (single gateway restart when used from HTTP).
   */
  async applyBatch(options: {
    set?: Record<string, string>;
    remove?: string[];
  }): Promise<EnvReadResult> {
    const setEntries = options.set ? Object.entries(options.set) : [];
    const removeKeys = options.remove ?? [];
    if (setEntries.length === 0 && removeKeys.length === 0) {
      throw new Error("Batch must include at least one set or remove entry");
    }

    for (const key of removeKeys) {
      this.validateKey(key);
    }
    for (const [key] of setEntries) {
      this.validateKey(key);
    }

    await this.ensureDataDir();
    const parsed = parseEnv(await this.readRawContent());

    for (const key of removeKeys) {
      delete parsed[key];
    }
    for (const [key, value] of setEntries) {
      if (value.length > 0) {
        parsed[key] = value;
      }
    }

    await this.writeParsed(parsed);
    return this.read();
  }

  private async ensureDataDir(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
  }

  private async readRawContent(): Promise<string> {
    try {
      return await readFile(this.getEnvPath(), "utf8");
    } catch (cause: unknown) {
      if (this.isFileErrorCode(cause, "ENOENT")) {
        return "";
      }
      throw cause;
    }
  }

  private async writeParsed(values: Record<string, string>): Promise<void> {
    const temporaryPath = path.join(this.dataDir, `.env.${randomUUID()}.tmp`);
    const content = this.serialize(values);
    try {
      await writeFile(temporaryPath, content);
      await rename(temporaryPath, this.getEnvPath());
    } catch (cause: unknown) {
      await rm(temporaryPath, { force: true });
      throw cause;
    }
  }

  private serialize(values: Record<string, string>): string {
    const entries = Object.entries(values).sort(([left], [right]) => left.localeCompare(right));
    const lines = entries.map(([key, value]) => `${key}=${this.encodeValue(value)}`);
    return lines.length > 0 ? `${lines.join("\n")}\n` : "";
  }

  private encodeValue(value: string): string {
    return JSON.stringify(value);
  }

  private maskValue(value: string): string {
    if (value.length === 0) {
      return "(empty)";
    }
    if (value.length <= 4) {
      return "*".repeat(value.length);
    }
    return `${"*".repeat(Math.min(8, value.length - 2))}${value.slice(-2)}`;
  }

  private validateKey(key: string): void {
    if (!ENV_KEY_PATTERN.test(key)) {
      throw new Error("Env key must match ^[A-Z_][A-Z0-9_]*$");
    }
  }

  private async getUpdatedAt(): Promise<string | null> {
    try {
      const metadata = await stat(this.getEnvPath());
      return metadata.mtime.toISOString();
    } catch (cause: unknown) {
      if (this.isFileErrorCode(cause, "ENOENT")) {
        return null;
      }
      throw cause;
    }
  }

  private getEnvPath(): string {
    return path.join(this.dataDir, ENV_FILE_NAME);
  }

  private isFileErrorCode(cause: unknown, code: string): boolean {
    return cause instanceof Error && "code" in cause && cause.code === code;
  }
}
