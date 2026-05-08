import { readFile } from "node:fs/promises";
import path from "node:path";

export type AppPaths = {
  rootDir: string;
  dataDir: string;
  logsDir: string;
};

export function createPaths(rootDir: string = process.cwd()): AppPaths {
  const dataDir = path.join(rootDir, "data");

  return {
    rootDir,
    dataDir,
    logsDir: path.join(dataDir, "logs"),
  };
}

/** Lazy directory accessor used by stateful services so they pick up profile switches at call time. */
export type DirProvider = () => string;

export function asDirProvider(value: string | DirProvider): DirProvider {
  return typeof value === "string" ? () => value : value;
}

const LEGACY_ACTIVE_PROFILE_FILE = ".active_profile";
const PROFILE_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const RESERVED_PROFILE_NAMES = new Set(["default", "profiles", "."]);

/**
 * Validates a profile name (does not return — throws on invalid input).
 * Names are restricted to a conservative slug so that joining them under
 * `data/profiles/` cannot escape the profile root.
 */
export function validateProfileName(name: string): void {
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("Profile name must be a non-empty string");
  }
  if (RESERVED_PROFILE_NAMES.has(name)) {
    throw new Error(`Profile name "${name}" is reserved`);
  }
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    throw new Error("Profile name must not contain path separators");
  }
  if (!PROFILE_NAME_PATTERN.test(name)) {
    throw new Error("Profile name must match ^[a-z0-9][a-z0-9_-]{0,31}$");
  }
}

export function isValidProfileName(name: string): boolean {
  try {
    validateProfileName(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves filesystem paths for profiles. Profiles run concurrently — there is
 * no global "active profile". Each operation that targets a profile takes an
 * explicit `profile: string | null` argument (`null` = the default profile
 * rooted at `<rootDir>/data`).
 */
export class ProfileResolver {
  constructor(private readonly rootDir: string) {}

  /** Root `<rootDir>/data` directory. */
  getRootDataDir(): string {
    return path.join(this.rootDir, "data");
  }

  /** Resolves the data directory for an explicit profile. */
  resolveDataDir(profile: string | null): string {
    return resolveProfileDataDir(this.rootDir, profile);
  }

  /** Resolves the logs directory for an explicit profile. */
  resolveLogsDir(profile: string | null): string {
    return path.join(this.resolveDataDir(profile), "logs");
  }

  /**
   * Reads the legacy `data/.active_profile` marker if present. Used once at
   * boot to seed the workspace UI's initial profile selection so users who
   * had an active profile selected before the multi-gateway switch keep
   * their familiar default. Returns `null` if the marker is missing or
   * invalid.
   */
  async readLegacyActiveProfile(): Promise<string | null> {
    try {
      const raw = await readFile(this.getLegacyMarkerPath(), "utf8");
      const trimmed = raw.trim();
      if (trimmed.length > 0 && isValidProfileName(trimmed)) {
        return trimmed;
      }
      return null;
    } catch (cause: unknown) {
      if (this.isMissingFileError(cause)) {
        return null;
      }
      throw cause;
    }
  }

  private getLegacyMarkerPath(): string {
    return path.join(this.getRootDataDir(), LEGACY_ACTIVE_PROFILE_FILE);
  }

  private isMissingFileError(cause: unknown): boolean {
    return cause instanceof Error && "code" in cause && cause.code === "ENOENT";
  }
}

/**
 * Returns the data directory for a given profile, with `null` mapping to the
 * root (default) profile.
 */
export function resolveProfileDataDir(rootDir: string, profile: string | null): string {
  if (profile === null) {
    return path.join(rootDir, "data");
  }
  validateProfileName(profile);
  return path.join(rootDir, "data", "profiles", profile);
}
