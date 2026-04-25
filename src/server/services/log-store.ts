import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import dayjs from 'dayjs';

export type LogChannel = 'gateway' | 'stdout' | 'stderr' | 'health' | 'warning';
export type Clock = () => string;
export type LogListener = (line: string) => void;

export type LogTailResult = {
  lines: string[];
  warning: string | null;
};

export class LogStore {
  private readonly listeners = new Set<LogListener>();
  private warning: string | null = null;

  constructor(
    private readonly logsDir: string,
    private readonly clock: Clock = () => new Date().toISOString(),
  ) {}

  async append(channel: LogChannel, message: string): Promise<void> {
    const timestamp = this.clock();
    const line = this.formatLine(timestamp, channel, message);

    try {
      await mkdir(this.logsDir, { recursive: true });
      await writeFile(this.getLogFilePath(timestamp), `${line}\n`, { flag: 'a' });
      this.warning = null;
      this.emit(line);
    } catch (cause: unknown) {
      this.warning = this.formatWarning(cause);
      this.emit(this.formatLine(this.clock(), 'warning', this.warning));
    }
  }

  async tail(limit: number): Promise<LogTailResult> {
    const timestamp = this.clock();

    try {
      const content = await readFile(this.getLogFilePath(timestamp), 'utf8');
      const lines = content.split('\n').filter((line) => line.length > 0);

      return {
        lines: lines.slice(-Math.max(0, limit)),
        warning: this.warning,
      };
    } catch (cause: unknown) {
      const warning = this.formatWarning(cause);

      return {
        lines: [],
        warning,
      };
    }
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getWarning(): string | null {
    return this.warning;
  }

  private getLogFilePath(timestamp: string): string {
    return path.join(this.logsDir, `${dayjs(timestamp).format('YYYY-MM-DD')}.log`);
  }

  private formatLine(timestamp: string, channel: LogChannel, message: string): string {
    return `[${timestamp}] [${channel}] ${message}`;
  }

  private formatWarning(cause: unknown): string {
    if (cause instanceof Error) {
      return cause.message;
    }

    return String(cause);
  }

  private emit(line: string): void {
    for (const listener of this.listeners) {
      listener(line);
    }
  }
}
