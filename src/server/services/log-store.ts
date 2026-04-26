import { mkdir, open, writeFile } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import path from "node:path";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

const LOG_TAIL_CHUNK_SIZE = 64 * 1024;
const LINE_BREAK_PATTERN = /\r\n|\n|\r/;

export type LogChannel = "gateway" | "stdout" | "stderr" | "health" | "warning";
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
    const lines = this.splitMessage(message).map((line) =>
      this.formatLine(timestamp, channel, line),
    );

    if (lines.length === 0) {
      this.warning = null;
      return;
    }

    try {
      await mkdir(this.logsDir, { recursive: true });
      await writeFile(this.getLogFilePath(timestamp), `${lines.join("\n")}\n`, { flag: "a" });
      this.warning = null;
    } catch (cause: unknown) {
      this.warning = this.formatWarning(cause);
      this.emit(this.formatLine(this.clock(), "warning", this.warning));
      return;
    }

    for (const line of lines) {
      this.emit(line);
    }
  }

  async tail(limit: number): Promise<LogTailResult> {
    const timestamp = this.clock();
    const normalizedLimit = Math.max(0, limit);

    if (normalizedLimit === 0) {
      return {
        lines: [],
        warning: this.warning,
      };
    }

    let fileHandle: FileHandle | null = null;

    try {
      fileHandle = await open(this.getLogFilePath(timestamp), "r");
      const stats = await fileHandle.stat();
      const lines = await this.readTailLines(fileHandle, stats.size, normalizedLimit);

      return {
        lines,
        warning: this.warning,
      };
    } catch (cause: unknown) {
      if (this.isMissingFileError(cause)) {
        return {
          lines: [],
          warning: this.warning,
        };
      }

      const warning = this.formatWarning(cause);

      return {
        lines: [],
        warning,
      };
    } finally {
      await fileHandle?.close();
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
    return path.join(this.logsDir, `${dayjs(timestamp).utc().format("YYYY-MM-DD")}.log`);
  }

  private formatLine(timestamp: string, channel: LogChannel, message: string): string {
    return `[${timestamp}] [${channel}] ${message}`;
  }

  private splitMessage(message: string): string[] {
    return message.split(LINE_BREAK_PATTERN).filter((line) => line.length > 0);
  }

  private splitLogContent(content: string): string[] {
    return content.split(LINE_BREAK_PATTERN).filter((line) => line.length > 0);
  }

  private async readTailLines(
    fileHandle: FileHandle,
    fileSize: number,
    limit: number,
  ): Promise<string[]> {
    let position = fileSize;
    let content = "";
    let lines: string[] = [];

    while (position > 0 && lines.length <= limit) {
      const readSize = Math.min(LOG_TAIL_CHUNK_SIZE, position);
      position -= readSize;

      const buffer = Buffer.allocUnsafe(readSize);
      const result = await fileHandle.read(buffer, 0, readSize, position);

      if (result.bytesRead === 0) {
        break;
      }

      content = `${buffer.subarray(0, result.bytesRead).toString("utf8")}${content}`;
      lines = this.splitLogContent(content);
    }

    return lines.slice(-limit);
  }

  private formatWarning(cause: unknown): string {
    if (cause instanceof Error) {
      return cause.message;
    }

    return String(cause);
  }

  private isMissingFileError(cause: unknown): boolean {
    return cause instanceof Error && "code" in cause && cause.code === "ENOENT";
  }

  private emit(line: string): void {
    for (const listener of this.listeners) {
      try {
        listener(line);
      } catch {
        // Listener failures must not affect log persistence or other listeners.
      }
    }
  }
}
