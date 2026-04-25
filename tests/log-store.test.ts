import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

  it('tails requested lines from a large log file', async () => {
    const store = new LogStore(tmpDir, () => '2026-04-26T10:30:00.000Z');
    const longLine = `[2026-04-26T10:30:00.000Z] [stdout] ${'x'.repeat(70 * 1024)}`;
    const expectedLines = [
      '[2026-04-26T10:30:00.000Z] [stdout] near-end',
      '[2026-04-26T10:30:00.000Z] [stdout] end',
    ];

    await writeFile(path.join(tmpDir, '2026-04-26.log'), `${longLine}\n${expectedLines.join('\n')}\n`);

    await expect(store.tail(2)).resolves.toEqual({
      lines: expectedLines,
      warning: null,
    });
  });

  it('normalizes multiline messages into tagged records', async () => {
    const store = new LogStore(tmpDir, () => '2026-04-26T10:30:00.000Z');

    await store.append('stdout', 'one\ntwo');

    await expect(store.tail(2)).resolves.toEqual({
      lines: [
        '[2026-04-26T10:30:00.000Z] [stdout] one',
        '[2026-04-26T10:30:00.000Z] [stdout] two',
      ],
      warning: null,
    });
  });

  it('continues emitting when one listener throws', async () => {
    const store = new LogStore(tmpDir, () => '2026-04-26T10:30:00.000Z');
    const received: string[] = [];

    store.subscribe(() => {
      throw new Error('listener failed');
    });
    store.subscribe((line) => {
      received.push(line);
    });

    await expect(store.append('gateway', 'started')).resolves.toBeUndefined();
    expect(received).toEqual(['[2026-04-26T10:30:00.000Z] [gateway] started']);
    expect(store.getWarning()).toBeNull();
  });

  it('uses the UTC timestamp date for log filenames', async () => {
    const store = new LogStore(tmpDir, () => '2026-04-26T23:30:00.000Z');

    await store.append('gateway', 'boundary');

    const content = await readFile(path.join(tmpDir, '2026-04-26.log'), 'utf8');
    expect(content).toContain('[2026-04-26T23:30:00.000Z] [gateway] boundary');
  });
});
