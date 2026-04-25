import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LogStore } from '../src/server/services/log-store';

let tmpDir = '';

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'hermes-log-store-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('LogStore', () => {
  it('writes gateway logs to dated file', async () => {
    const store = new LogStore(tmpDir, () => '2026-04-26T10:30:00.000Z');

    await store.append('gateway', 'started');

    const content = await readFile(path.join(tmpDir, '2026-04-26.log'), 'utf8');
    expect(content).toContain('[2026-04-26T10:30:00.000Z] [gateway] started');
  });

  it('tails the last requested lines', async () => {
    const store = new LogStore(tmpDir, () => '2026-04-26T10:30:00.000Z');

    await store.append('stdout', 'one');
    await store.append('stdout', 'two');
    await store.append('stdout', 'three');

    await expect(store.tail(2)).resolves.toEqual({
      lines: [
        '[2026-04-26T10:30:00.000Z] [stdout] two',
        '[2026-04-26T10:30:00.000Z] [stdout] three',
      ],
      warning: null,
    });
  });
});
