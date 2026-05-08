import { spawn, type IPty, type IPtyForkOptions, type IWindowsPtyForkOptions } from "node-pty";
import type { ProfileResolver } from "./paths";
import { validateProfileName } from "./paths";

type PtyOptions = IPtyForkOptions | IWindowsPtyForkOptions;

export type SpawnPty = (file: string, args: string[], options: PtyOptions) => IPty;

export type TerminalSession = {
  write: (input: string) => void;
  resize: (cols: number, rows: number) => void;
  onData: (handler: (data: string) => void) => void;
  onExit: (handler: (exitCode: number) => void) => void;
  kill: () => void;
};

/**
 * Spawns and tracks PTY sessions per socket id. Each `create` takes an
 * explicit `profile` argument so the spawned shell's cwd / `HERMES_HOME`
 * point at that profile's data dir; concurrent profiles each get their own
 * shell sessions.
 */
export class TerminalManager {
  private sessions = new Map<string, IPty>();

  constructor(
    private readonly resolver: ProfileResolver,
    private readonly spawnPty: SpawnPty = spawn,
  ) {}

  create(socketId: string, profile: string | null): TerminalSession {
    if (profile !== null) {
      validateProfileName(profile);
    }
    this.close(socketId);

    const cwd = this.resolver.resolveDataDir(profile);
    const pty = this.spawnPty("bash", [], {
      cwd,
      cols: 80,
      rows: 24,
      env: { ...process.env, HERMES_HOME: cwd },
    });
    this.sessions.set(socketId, pty);

    return {
      write: (input) => pty.write(input),
      resize: (cols, rows) => pty.resize(cols, rows),
      onData: (handler) => {
        pty.onData(handler);
      },
      onExit: (handler) => {
        pty.onExit(({ exitCode }) => handler(exitCode));
      },
      kill: () => this.close(socketId),
    };
  }

  close(socketId: string): void {
    const session = this.sessions.get(socketId);

    if (!session) {
      return;
    }

    session.kill();
    this.sessions.delete(socketId);
  }
}
