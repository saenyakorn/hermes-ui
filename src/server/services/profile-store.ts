import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type {
  ProfileCreateInput,
  ProfileListResult,
  ProfileMutationResult,
  ProfileSummary,
} from "../types";
import type { LogStoreRegistry } from "./log-store-registry";
import type { ProfileResolver } from "./paths";
import { validateProfileName } from "./paths";

/**
 * Result of running the `hermes` CLI binary for a profile mutation. The runner
 * is injectable so tests can drive the spawn without invoking the real CLI.
 */
export type RunHermesResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type RunHermes = (
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => Promise<RunHermesResult>;

const defaultRunHermes: RunHermes = async (args, options) => {
  return new Promise<RunHermesResult>((resolve, reject) => {
    const child = spawn("hermes", [...args], {
      cwd: options.cwd,
      env: options.env,
    } satisfies Pick<SpawnOptionsWithoutStdio, "cwd" | "env">);

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({ exitCode: code, stdout, stderr });
    });
  });
};

/** Marker error emitted when the `hermes` binary is not on PATH. */
export class HermesCliMissingError extends Error {
  constructor() {
    super(
      'Hermes CLI not found: unable to execute "hermes". Install Hermes Agent in this environment so the hermes command is available on PATH.',
    );
    this.name = "HermesCliMissingError";
  }
}

/**
 * Predicate the store calls before deleting a profile to confirm no gateway
 * is currently running for that profile (the new "concurrent gateways" model
 * replaces the old "active profile" guard).
 */
export type IsProfileGatewayRunning = (profile: string) => boolean;

/**
 * Manages Hermes profiles by combining a filesystem scan of `data/profiles/`
 * with the `hermes profile <verb>` CLI. The active-profile concept has been
 * removed: every operation that targets a single profile takes its name (or
 * `null` for the default) explicitly.
 */
export class ProfileStore {
  constructor(
    private readonly rootDir: string,
    private readonly resolver: ProfileResolver,
    private readonly logsRegistry: LogStoreRegistry,
    private readonly runHermes: RunHermes = defaultRunHermes,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly isGatewayRunning: IsProfileGatewayRunning = () => false,
  ) {}

  /** Lists profiles by scanning `data/profiles/`. */
  async list(): Promise<ProfileListResult> {
    const rootDataDir = this.resolver.getRootDataDir();
    const profilesDir = path.join(rootDataDir, "profiles");
    await mkdir(profilesDir, { recursive: true });

    const profiles: ProfileSummary[] = [];

    profiles.push({
      name: null,
      label: "default",
      dataDir: rootDataDir,
      updatedAt: await this.statUpdatedAt(rootDataDir),
      active: false,
    });

    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(profilesDir, { withFileTypes: true });
    } catch {
      entries = [];
    }

    const namedProfiles: ProfileSummary[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      try {
        validateProfileName(entry.name);
      } catch {
        continue;
      }
      const dataDir = path.join(profilesDir, entry.name);
      namedProfiles.push({
        name: entry.name,
        label: entry.name,
        dataDir,
        updatedAt: await this.statUpdatedAt(dataDir),
        active: false,
      });
    }
    namedProfiles.sort((left, right) => left.name!.localeCompare(right.name!));

    return {
      active: null,
      profiles: [...profiles, ...namedProfiles],
      warning: null,
    };
  }

  /** List the discovered profile names (slug only). Used for the gateway summary. */
  async listProfileNames(): Promise<Array<string | null>> {
    const rootDataDir = this.resolver.getRootDataDir();
    const profilesDir = path.join(rootDataDir, "profiles");
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(profilesDir, { withFileTypes: true });
    } catch {
      entries = [];
    }
    const names: Array<string | null> = [null];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        validateProfileName(entry.name);
      } catch {
        continue;
      }
      names.push(entry.name);
    }
    return names;
  }

  /** Creates a profile by shelling out to `hermes profile create`. */
  async create(input: ProfileCreateInput): Promise<ProfileMutationResult> {
    validateProfileName(input.name);
    if (input.cloneFrom !== undefined) {
      validateProfileName(input.cloneFrom);
    }

    const args = this.buildCreateArgs(input);
    await this.runHermesOrThrow(args);
    await this.logsRegistry
      .get(null)
      .append("gateway", `Created profile "${input.name}" via hermes CLI`);
    return { list: await this.list() };
  }

  /** Renames a profile via `hermes profile rename`. */
  async rename(from: string, to: string): Promise<ProfileMutationResult> {
    validateProfileName(from);
    validateProfileName(to);
    if (from === to) {
      throw new Error("New profile name must differ from the existing name");
    }
    if (this.isGatewayRunning(from)) {
      throw new Error(
        `Cannot rename profile "${from}" while its gateway is running. Stop it first.`,
      );
    }

    await this.runHermesOrThrow(["profile", "rename", from, to]);

    await this.logsRegistry.get(null).append("gateway", `Renamed profile "${from}" -> "${to}"`);
    return { list: await this.list() };
  }

  /**
   * Deletes a profile via `hermes profile delete <name> --yes`. Refuses to
   * delete a profile whose gateway is currently running so callers must stop
   * it first.
   */
  async remove(name: string): Promise<ProfileMutationResult> {
    validateProfileName(name);
    if (this.isGatewayRunning(name)) {
      throw new Error(
        `Cannot delete profile "${name}" while its gateway is running. Stop it first.`,
      );
    }
    await this.runHermesOrThrow(["profile", "delete", name, "--yes"]);
    await this.logsRegistry.get(null).append("gateway", `Deleted profile "${name}" via hermes CLI`);
    return { list: await this.list() };
  }

  private buildCreateArgs(input: ProfileCreateInput): readonly string[] {
    const args: string[] = ["profile", "create", input.name];
    switch (input.mode) {
      case "blank":
        break;
      case "clone":
        args.push("--clone");
        if (input.cloneFrom !== undefined) {
          args.push("--clone-from", input.cloneFrom);
        }
        break;
      case "clone-all":
        args.push("--clone-all");
        if (input.cloneFrom !== undefined) {
          args.push("--clone-from", input.cloneFrom);
        }
        break;
      default:
        return assertExhaustive(input.mode);
    }
    return args;
  }

  private async runHermesOrThrow(args: readonly string[]): Promise<RunHermesResult> {
    let result: RunHermesResult;
    try {
      result = await this.runHermes(args, {
        cwd: this.resolver.getRootDataDir(),
        env: { ...process.env, HERMES_HOME: this.resolver.getRootDataDir() },
      });
    } catch (cause: unknown) {
      if (isMissingHermesCli(cause)) {
        throw new HermesCliMissingError();
      }
      throw cause;
    }

    if (result.exitCode !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`;
      throw new Error(`hermes ${args.join(" ")} failed: ${detail}`);
    }
    return result;
  }

  private async statUpdatedAt(dataDir: string): Promise<string | null> {
    try {
      const info = await stat(dataDir);
      return info.mtime.toISOString();
    } catch {
      return null;
    }
  }
}

function assertExhaustive(mode: never): never {
  throw new Error(`Unexpected profile create mode: ${String(mode)}`);
}

function isMissingHermesCli(cause: unknown): boolean {
  if (!(cause instanceof Error)) {
    return false;
  }
  const errno = cause as NodeJS.ErrnoException;
  return errno.code === "ENOENT" || cause.message.includes("spawn hermes ENOENT");
}
