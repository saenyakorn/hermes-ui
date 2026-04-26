import { EventEmitter } from 'node:events';
import type { IPty } from 'node-pty';
import { describe, expect, it, vi } from 'vitest';
import { TerminalManager, type SpawnPty } from '../src/server/services/terminal-manager';

class FakePty extends EventEmitter implements IPty {
  readonly pid = 1234;
  readonly process = 'bash';
  handleFlowControl = false;
  killed = false;
  writes: string[] = [];
  cols = 80;
  rows = 24;

  readonly onData = (listener: (event: string) => void) => {
    this.on('data', listener);
    return { dispose: () => this.off('data', listener) };
  };

  readonly onExit = (listener: (event: { exitCode: number; signal?: number }) => void) => {
    this.on('exit', listener);
    return { dispose: () => this.off('exit', listener) };
  };

  clear(): void {}

  pause(): void {}

  resume(): void {}

  write(input: string | Buffer): void {
    this.writes.push(input.toString());
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }

  kill(_signal?: string): void {
    this.killed = true;
  }
}

describe('TerminalManager', () => {
  it('spawns bash in data cwd', () => {
    const fake = new FakePty();
    const spawnPty: SpawnPty = vi.fn(() => fake);
    const manager = new TerminalManager('/repo/data', spawnPty);

    const session = manager.create('socket-1');

    expect(spawnPty).toHaveBeenCalledWith('bash', [], { cwd: '/repo/data', cols: 80, rows: 24, env: process.env });
    session.write('pwd\n');
    expect(fake.writes).toEqual(['pwd\n']);
  });

  it('kills session on close', () => {
    const fake = new FakePty();
    const manager = new TerminalManager('/repo/data', () => fake);

    manager.create('socket-1');
    manager.close('socket-1');

    expect(fake.killed).toBe(true);
  });
});
