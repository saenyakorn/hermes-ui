import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseEnv } from "dotenv";
import type { EnvReadResult } from "../types";
import { asDirProvider, type DirProvider } from "./paths";

const ENV_FILE_NAME = ".env";
const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

/** Non-secret Discord .env keys whose raw value may be sent to the workspace UI (selects). */
const ENV_KEYS_WITH_PUBLIC_VALUE_IN_API = new Set([
  "DISCORD_ALLOWED_USERS",
  "DISCORD_COMMAND_SYNC_POLICY",
  "DISCORD_REPLY_TO_MODE",
  "DISCORD_REQUIRE_MENTION",
  "DISCORD_AUTO_THREAD",
  "DISCORD_REACTIONS",
  "DISCORD_ALLOW_MENTION_EVERYONE",
  "DISCORD_ALLOW_MENTION_ROLES",
  "DISCORD_ALLOW_MENTION_USERS",
  "DISCORD_ALLOW_MENTION_REPLIED_USER",
  "DISCORD_IGNORE_NO_MENTION",
]);

export class EnvStore {
  private readonly getDataDir: DirProvider;

  constructor(dataDir: string | DirProvider) {
    this.getDataDir = asDirProvider(dataDir);
  }

  async read(): Promise<EnvReadResult> {
    await this.ensureDataDir();
    const content = await this.readRawContent();
    const parsed = parseEnv(content);
    const metadata = await this.getUpdatedAt();
    const entries = Object.entries(parsed)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => {
        const maskedValue = this.maskValue(value);
        const base = { key, maskedValue };
        if (value.length === 0 || value.length > 128 || value.includes("\n")) {
          return base;
        }
        if (ENV_KEYS_WITH_PUBLIC_VALUE_IN_API.has(key)) {
          return { ...base, publicValue: value };
        }
        return base;
      });

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
    await mkdir(this.getDataDir(), { recursive: true });
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
    const temporaryPath = path.join(this.getDataDir(), `.env.${randomUUID()}.tmp`);
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
    return path.join(this.getDataDir(), ENV_FILE_NAME);
  }

  private isFileErrorCode(cause: unknown, code: string): boolean {
    return cause instanceof Error && "code" in cause && cause.code === code;
  }
}
