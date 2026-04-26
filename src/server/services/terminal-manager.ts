import { spawn, type IPty, type IPtyForkOptions, type IWindowsPtyForkOptions } from "node-pty";

type PtyOptions = IPtyForkOptions | IWindowsPtyForkOptions;

export type SpawnPty = (file: string, args: string[], options: PtyOptions) => IPty;

export type TerminalSession = {
  write: (input: string) => void;
  resize: (cols: number, rows: number) => void;
  onData: (handler: (data: string) => void) => void;
  onExit: (handler: (exitCode: number) => void) => void;
  kill: () => void;
};

export class TerminalManager {
  private sessions = new Map<string, IPty>();

  constructor(
    private readonly cwd: string,
    private readonly spawnPty: SpawnPty = spawn,
  ) {}

  create(socketId: string): TerminalSession {
    this.close(socketId);

    const pty = this.spawnPty("bash", [], {
      cwd: this.cwd,
      cols: 80,
      rows: 24,
      env: process.env,
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
