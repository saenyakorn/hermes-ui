import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

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

const ACTIVE_PROFILE_FILE = ".active_profile";
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

export type ProfileChangeListener = (active: string | null) => void;

/**
 * Tracks the currently active Hermes profile and resolves the matching
 * `HERMES_HOME` directory. Stateful services consume this to follow profile
 * switches without having to be reconstructed.
 */
export class ProfileResolver {
  private active: string | null = null;
  private readonly listeners = new Set<ProfileChangeListener>();
  private initialized = false;

  constructor(private readonly rootDir: string) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    try {
      const raw = await readFile(this.getActiveMarkerPath(), "utf8");
      const trimmed = raw.trim();
      if (trimmed.length > 0 && isValidProfileName(trimmed)) {
        this.active = trimmed;
      }
    } catch (cause: unknown) {
      if (!this.isMissingFileError(cause)) {
        throw cause;
      }
    }
  }

  getActive(): string | null {
    return this.active;
  }

  /**
   * Updates the active profile and persists the marker atomically. Pass `null`
   * to revert to the default profile (root `data/`).
   */
  async setActive(name: string | null): Promise<void> {
    if (name !== null) {
      validateProfileName(name);
    }

    if (name === this.active) {
      return;
    }

    if (name === null) {
      try {
        await rm(this.getActiveMarkerPath(), { force: true });
      } catch (cause: unknown) {
        if (!this.isMissingFileError(cause)) {
          throw cause;
        }
      }
    } else {
      const temporaryPath = path.join(this.getRootDataDir(), `.active_profile.${randomUUID()}.tmp`);
      try {
        await writeFile(temporaryPath, name);
        await rename(temporaryPath, this.getActiveMarkerPath());
      } catch (cause: unknown) {
        await rm(temporaryPath, { force: true });
        throw cause;
      }
    }

    this.active = name;
    for (const listener of this.listeners) {
      try {
        listener(name);
      } catch {
        // Listener failures must not block profile switches.
      }
    }
  }

  /** Root `<rootDir>/data` directory regardless of active profile. */
  getRootDataDir(): string {
    return path.join(this.rootDir, "data");
  }

  /** Resolves the data directory for the active profile. */
  getDataDir(): string {
    return resolveProfileDataDir(this.rootDir, this.active);
  }

  /** Resolves the logs directory for the active profile. */
  getLogsDir(): string {
    return path.join(this.getDataDir(), "logs");
  }

  /** Resolves the data directory for an explicit profile (without switching). */
  resolveDataDir(profile: string | null): string {
    return resolveProfileDataDir(this.rootDir, profile);
  }

  subscribe(listener: ProfileChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private getActiveMarkerPath(): string {
    return path.join(this.getRootDataDir(), ACTIVE_PROFILE_FILE);
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
