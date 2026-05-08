import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseEnv } from "dotenv";
import type { EnvReadResult } from "../types";
import type { ProfileResolver } from "./paths";
import { validateProfileName } from "./paths";

const ENV_FILE_NAME = ".env";
const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

function getDisplayEnvPath(profile: string | null): string {
  if (profile === null) {
    return "data/.env";
  }
  return `data/profiles/${profile}/.env`;
}

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

/**
 * Manages `<profileDataDir>/.env` for an explicit profile. Methods accept
 * `profile: string | null` ("null" = default profile); there is no global
 * active profile.
 */
export class EnvStore {
  constructor(private readonly resolver: ProfileResolver) {}

  async read(profile: string | null): Promise<EnvReadResult> {
    this.assertValidProfile(profile);
    await this.ensureDataDir(profile);
    const content = await this.readRawContent(profile);
    const parsed = parseEnv(content);
    const metadata = await this.getUpdatedAt(profile);
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
      path: getDisplayEnvPath(profile),
      updatedAt: metadata,
      entries,
    };
  }

  async upsert(profile: string | null, key: string, value: string): Promise<EnvReadResult> {
    this.assertValidProfile(profile);
    this.validateKey(key);
    await this.ensureDataDir(profile);
    const parsed = parseEnv(await this.readRawContent(profile));
    parsed[key] = value;
    await this.writeParsed(profile, parsed);
    return this.read(profile);
  }

  async remove(profile: string | null, key: string): Promise<EnvReadResult> {
    this.assertValidProfile(profile);
    this.validateKey(key);
    await this.ensureDataDir(profile);
    const parsed = parseEnv(await this.readRawContent(profile));
    delete parsed[key];
    await this.writeParsed(profile, parsed);
    return this.read(profile);
  }

  /**
   * Apply multiple env changes in one atomic write (single gateway restart when used from HTTP).
   */
  async applyBatch(
    profile: string | null,
    options: {
      set?: Record<string, string>;
      remove?: string[];
    },
  ): Promise<EnvReadResult> {
    this.assertValidProfile(profile);
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

    await this.ensureDataDir(profile);
    const parsed = parseEnv(await this.readRawContent(profile));

    for (const key of removeKeys) {
      delete parsed[key];
    }
    for (const [key, value] of setEntries) {
      if (value.length > 0) {
        parsed[key] = value;
      }
    }

    await this.writeParsed(profile, parsed);
    return this.read(profile);
  }

  private async ensureDataDir(profile: string | null): Promise<void> {
    await mkdir(this.resolver.resolveDataDir(profile), { recursive: true });
  }

  private async readRawContent(profile: string | null): Promise<string> {
    try {
      return await readFile(this.getEnvPath(profile), "utf8");
    } catch (cause: unknown) {
      if (this.isFileErrorCode(cause, "ENOENT")) {
        return "";
      }
      throw cause;
    }
  }

  private async writeParsed(profile: string | null, values: Record<string, string>): Promise<void> {
    const dataDir = this.resolver.resolveDataDir(profile);
    const temporaryPath = path.join(dataDir, `.env.${randomUUID()}.tmp`);
    const content = this.serialize(values);
    try {
      await writeFile(temporaryPath, content);
      await rename(temporaryPath, this.getEnvPath(profile));
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

  private async getUpdatedAt(profile: string | null): Promise<string | null> {
    try {
      const metadata = await stat(this.getEnvPath(profile));
      return metadata.mtime.toISOString();
    } catch (cause: unknown) {
      if (this.isFileErrorCode(cause, "ENOENT")) {
        return null;
      }
      throw cause;
    }
  }

  private getEnvPath(profile: string | null): string {
    return path.join(this.resolver.resolveDataDir(profile), ENV_FILE_NAME);
  }

  private assertValidProfile(profile: string | null): void {
    if (profile !== null) {
      validateProfileName(profile);
    }
  }

  private isFileErrorCode(cause: unknown, code: string): boolean {
    return cause instanceof Error && "code" in cause && cause.code === code;
  }
}
