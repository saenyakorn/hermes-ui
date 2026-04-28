import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type {
  ProfileActivateResult,
  ProfileCreateInput,
  ProfileListResult,
  ProfileMutationResult,
  ProfileSummary,
  GatewayStatus,
} from "../types";
import type { LogStore } from "./log-store";
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
 * Manages Hermes profiles by combining a filesystem scan of `data/profiles/`
 * with the `hermes profile <verb>` CLI. Active-profile tracking is delegated
 * to {@link ProfileResolver}; this store does not own that state directly.
 */
export class ProfileStore {
  constructor(
    private readonly rootDir: string,
    private readonly resolver: ProfileResolver,
    private readonly logs: LogStore,
    private readonly runHermes: RunHermes = defaultRunHermes,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  /** Lists profiles by scanning `data/profiles/`. */
  async list(): Promise<ProfileListResult> {
    const rootDataDir = this.resolver.getRootDataDir();
    const profilesDir = path.join(rootDataDir, "profiles");
    await mkdir(profilesDir, { recursive: true });

    const active = this.resolver.getActive();
    const profiles: ProfileSummary[] = [];

    profiles.push({
      name: null,
      label: "default",
      dataDir: rootDataDir,
      updatedAt: await this.statUpdatedAt(rootDataDir),
      active: active === null,
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
        active: active === entry.name,
      });
    }
    namedProfiles.sort((left, right) => left.name!.localeCompare(right.name!));

    return {
      active,
      profiles: [...profiles, ...namedProfiles],
      warning: null,
    };
  }

  /** Creates a profile by shelling out to `hermes profile create`. */
  async create(input: ProfileCreateInput): Promise<ProfileMutationResult> {
    validateProfileName(input.name);
    if (input.cloneFrom !== undefined) {
      validateProfileName(input.cloneFrom);
    }

    const args = this.buildCreateArgs(input);
    await this.runHermesOrThrow(args);
    await this.logs.append("gateway", `Created profile "${input.name}" via hermes CLI`);
    return { list: await this.list() };
  }

  /** Renames a profile via `hermes profile rename`. */
  async rename(from: string, to: string): Promise<ProfileMutationResult> {
    validateProfileName(from);
    validateProfileName(to);
    if (from === to) {
      throw new Error("New profile name must differ from the existing name");
    }

    await this.runHermesOrThrow(["profile", "rename", from, to]);

    const active = this.resolver.getActive();
    if (active === from) {
      await this.resolver.setActive(to);
    }
    await this.logs.append("gateway", `Renamed profile "${from}" -> "${to}"`);
    return { list: await this.list() };
  }

  /**
   * Deletes a profile via `hermes profile delete <name> --yes`. Refuses to
   * delete the active profile so callers must switch first.
   */
  async remove(name: string): Promise<ProfileMutationResult> {
    validateProfileName(name);
    if (this.resolver.getActive() === name) {
      throw new Error(
        `Cannot delete the active profile "${name}". Switch to another profile first.`,
      );
    }
    await this.runHermesOrThrow(["profile", "delete", name, "--yes"]);
    await this.logs.append("gateway", `Deleted profile "${name}" via hermes CLI`);
    return { list: await this.list() };
  }

  /**
   * Updates the active profile and returns a fresh listing. Gateway lifecycle
   * (stop/start) is the caller's responsibility — see the activate route.
   */
  async setActive(name: string | null): Promise<ProfileListResult> {
    if (name !== null) {
      validateProfileName(name);
      const profilesDir = path.join(this.resolver.getRootDataDir(), "profiles");
      try {
        const info = await stat(path.join(profilesDir, name));
        if (!info.isDirectory()) {
          throw new Error(`Profile "${name}" is not a directory`);
        }
      } catch (cause: unknown) {
        if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") {
          throw new Error(`Profile "${name}" does not exist`);
        }
        throw cause;
      }
    }
    await this.resolver.setActive(name);
    return this.list();
  }

  active(): string | null {
    return this.resolver.getActive();
  }

  /**
   * Wraps `setActive` with gateway stop/restart bookkeeping suitable for the
   * activate route handler.
   */
  async activate(
    name: string | null,
    gateway: {
      status: () => GatewayStatus;
      stop: () => Promise<GatewayStatus>;
      start: () => Promise<GatewayStatus>;
    },
  ): Promise<ProfileActivateResult> {
    const previousActive = this.resolver.getActive();
    if (name === previousActive) {
      const list = await this.list();
      return {
        active: previousActive,
        list,
        restart: { attempted: false, ok: true, error: null },
        gateway: gateway.status(),
      };
    }

    const wasRunning = gateway.status().state === "running";
    if (wasRunning) {
      try {
        await gateway.stop();
      } catch (cause: unknown) {
        return {
          active: previousActive,
          list: await this.list(),
          restart: { attempted: true, ok: false, error: getErrorMessage(cause) },
          gateway: gateway.status(),
        };
      }
    }

    const list = await this.setActive(name);
    this.logs.clearWarning();
    await this.logs.append(
      "gateway",
      `Switched active profile to ${name === null ? "default" : `"${name}"`}`,
    );

    if (!wasRunning) {
      return {
        active: name,
        list,
        restart: { attempted: false, ok: true, error: null },
        gateway: gateway.status(),
      };
    }

    try {
      const status = await gateway.start();
      return {
        active: name,
        list,
        restart: { attempted: true, ok: true, error: null },
        gateway: status,
      };
    } catch (cause: unknown) {
      return {
        active: name,
        list,
        restart: { attempted: true, ok: false, error: getErrorMessage(cause) },
        gateway: gateway.status(),
      };
    }
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

function getErrorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  return String(cause);
}
