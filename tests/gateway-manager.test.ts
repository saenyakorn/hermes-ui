import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayManager, type SpawnGateway } from '../src/server/services/gateway-manager';
import { LogStore } from '../src/server/services/log-store';

type FakeChildProcess = ChildProcessWithoutNullStreams & {
  readonly kill: ReturnType<typeof vi.fn<(signal?: NodeJS.Signals | number) => boolean>>;
};

let tmpDir = '';

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'hermes-gateway-manager-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
  vi.useRealTimers();
});

function createFakeChild(pid: number | undefined): FakeChildProcess {
  const kill = vi.fn(() => true);

  return Object.assign(new EventEmitter(), {
    pid,
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill,
  }) as unknown as FakeChildProcess;
}

function createManager(spawnGateway: SpawnGateway): GatewayManager {
  return new GatewayManager(
    '/workspace/project',
    new LogStore(tmpDir, () => '2026-04-26T10:30:00.000Z'),
    spawnGateway,
    () => '2026-04-26T10:30:00.000Z',
  );
}

describe('GatewayManager', () => {
  it('starts hermes gateway once in the configured cwd', async () => {
    const child = createFakeChild(1234);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = createManager(spawnGateway);

    const status = await manager.start();

    expect(spawnGateway).toHaveBeenCalledTimes(1);
    expect(spawnGateway).toHaveBeenCalledWith('hermes', ['gateway'], { cwd: '/workspace/project' });
    expect(status).toMatchObject({
      state: 'running',
      health: 'unknown',
      pid: 1234,
      cwd: '/workspace/project',
      startedAt: '2026-04-26T10:30:00.000Z',
      exitCode: null,
      lastError: null,
    });
  });

  it('rejects duplicate start while gateway is running', async () => {
    const child = createFakeChild(1234);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = createManager(spawnGateway);

    await manager.start();

    await expect(manager.start()).rejects.toThrow('Gateway already running');
    expect(spawnGateway).toHaveBeenCalledTimes(1);
  });

  it('returns stopped when stopping an already stopped gateway', async () => {
    const spawnGateway: SpawnGateway = vi.fn(() => createFakeChild(1234));
    const manager = createManager(spawnGateway);

    const status = await manager.stop();

    expect(spawnGateway).not.toHaveBeenCalled();
    expect(status).toMatchObject({
      state: 'stopped',
      health: 'unknown',
      pid: null,
      cwd: '/workspace/project',
      startedAt: null,
      exitCode: null,
      lastError: null,
    });
  });

  it('waits for asynchronous child exit before restart spawns another gateway', async () => {
    const firstChild = createFakeChild(1234);
    const secondChild = createFakeChild(5678);
    const spawnGateway: SpawnGateway = vi.fn()
      .mockReturnValueOnce(firstChild)
      .mockReturnValueOnce(secondChild);
    const manager = createManager(spawnGateway);

    await manager.start();

    const restart = manager.restart().then(
      (status) => ({ ok: true as const, status }),
      (cause: unknown) => ({ ok: false as const, cause }),
    );
    await vi.waitFor(() => {
      expect(firstChild.kill).toHaveBeenCalledWith('SIGTERM');
    });

    expect(spawnGateway).toHaveBeenCalledTimes(1);

    firstChild.emit('exit', 0, null);

    const result = await restart;

    expect(result).toMatchObject({
      ok: true,
      status: {
        state: 'running',
        pid: 5678,
      },
    });
    expect(spawnGateway).toHaveBeenCalledTimes(2);
    expect(spawnGateway).toHaveBeenLastCalledWith('hermes', ['gateway'], { cwd: '/workspace/project' });
  });

  it('marks SIGTERM from controlled stop as stopped', async () => {
    const child = createFakeChild(1234);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = createManager(spawnGateway);

    await manager.start();
    await manager.stop();

    child.emit('exit', null, 'SIGTERM');

    expect(manager.status()).toMatchObject({
      state: 'stopped',
      pid: null,
      startedAt: null,
      uptimeMs: null,
      exitCode: null,
      lastError: null,
    });
  });

  it('marks unexpected SIGTERM as crashed', async () => {
    const child = createFakeChild(1234);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = createManager(spawnGateway);

    await manager.start();

    child.emit('exit', null, 'SIGTERM');

    expect(manager.status()).toMatchObject({
      state: 'crashed',
      pid: null,
      exitCode: null,
      lastError: 'Gateway exited with signal SIGTERM',
    });
  });

  it('rejects and clears process state when spawn emits an error', async () => {
    const child = createFakeChild(undefined);
    const spawnGateway: SpawnGateway = vi.fn(() => child);
    const manager = createManager(spawnGateway);
    const start = manager.start();

    child.emit('error', new Error('spawn hermes ENOENT'));

    await expect(start).rejects.toThrow('spawn hermes ENOENT');
    expect(manager.status()).toMatchObject({
      state: 'crashed',
      pid: null,
      startedAt: null,
      lastError: 'spawn hermes ENOENT',
    });
  });
});
