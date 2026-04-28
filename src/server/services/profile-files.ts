import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProfileFileKind, ProfileFileReadResult, ProfileFileWriteResult } from "../types";
import type { ProfileResolver } from "./paths";
import { validateProfileName } from "./paths";

/**
 * Resolves the on-disk location of a managed markdown file for a given profile.
 * `null` profile means the default (root `data/`) profile.
 */
function resolveFilePath(dataDir: string, kind: ProfileFileKind): string {
  switch (kind) {
    case "soul":
      return path.join(dataDir, "SOUL.md");
    case "memory":
      return path.join(dataDir, "memories", "MEMORY.md");
    case "user":
      return path.join(dataDir, "memories", "USER.md");
    default:
      return assertExhaustive(kind);
  }
}

function assertExhaustive(kind: never): never {
  throw new Error(`Unexpected profile file kind: ${String(kind)}`);
}

function relativeDisplayPath(dataDir: string, fullPath: string, profile: string | null): string {
  const profileSegment = profile === null ? "data" : `data/profiles/${profile}`;
  const remainder = path.relative(dataDir, fullPath);
  return `${profileSegment}/${remainder.split(path.sep).join("/")}`;
}

/**
 * Reads and writes the canonical Hermes markdown files (`SOUL.md`,
 * `memories/MEMORY.md`, `memories/USER.md`) for either the active or an
 * explicitly-named profile, with atomic temp+rename writes.
 */
export class ProfileFiles {
  constructor(private readonly resolver: ProfileResolver) {}

  async read(profile: string | null, kind: ProfileFileKind): Promise<ProfileFileReadResult> {
    if (profile !== null) {
      validateProfileName(profile);
    }
    const dataDir = this.resolver.resolveDataDir(profile);
    const fullPath = resolveFilePath(dataDir, kind);
    const displayPath = relativeDisplayPath(dataDir, fullPath, profile);

    try {
      const content = await readFile(fullPath, "utf8");
      const info = await stat(fullPath);
      return {
        profile,
        kind,
        path: displayPath,
        content,
        updatedAt: info.mtime.toISOString(),
      };
    } catch (cause: unknown) {
      if (this.isMissingFileError(cause)) {
        return {
          profile,
          kind,
          path: displayPath,
          content: "",
          updatedAt: null,
        };
      }
      throw cause;
    }
  }

  async write(
    profile: string | null,
    kind: ProfileFileKind,
    content: string,
  ): Promise<ProfileFileWriteResult> {
    if (profile !== null) {
      validateProfileName(profile);
    }
    const dataDir = this.resolver.resolveDataDir(profile);
    const fullPath = resolveFilePath(dataDir, kind);
    const displayPath = relativeDisplayPath(dataDir, fullPath, profile);

    await mkdir(path.dirname(fullPath), { recursive: true });

    const temporaryPath = path.join(
      path.dirname(fullPath),
      `.${path.basename(fullPath)}.${randomUUID()}.tmp`,
    );
    try {
      await writeFile(temporaryPath, content);
      await rename(temporaryPath, fullPath);
    } catch (cause: unknown) {
      await rm(temporaryPath, { force: true });
      throw cause;
    }

    const info = await stat(fullPath);
    return {
      profile,
      kind,
      path: displayPath,
      content,
      updatedAt: info.mtime.toISOString(),
      saved: true,
    };
  }

  private isMissingFileError(cause: unknown): boolean {
    return cause instanceof Error && "code" in cause && cause.code === "ENOENT";
  }
}
