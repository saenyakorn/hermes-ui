import { describe, expect, it, vi } from 'vitest';
import { createApp, type AppServices } from '../src/server/app';
import type { GatewayStatus } from '../src/server/types';

const auth = `Basic ${Buffer.from('admin:secret').toString('base64')}`;

function createServices(): AppServices {
  const status: GatewayStatus = {
    state: 'stopped',
    health: 'unknown',
    pid: null,
    cwd: '/repo/data',
    startedAt: null,
    uptimeMs: null,
    exitCode: null,
    lastError: null,
    logWarning: null,
  };

  return {
    env: {
      adminUsername: 'admin',
      adminPassword: 'secret',
      port: 3000,
      logLevel: 'info',
    },
    gateway: {
      status: vi.fn(() => status),
      start: vi.fn(),
      stop: vi.fn(),
      restart: vi.fn(),
      refreshHealth: vi.fn(),
    },
    logs: {
      tail: vi.fn(async () => ({ lines: ['line one'], warning: null })),
      subscribe: vi.fn(() => () => undefined),
    },
  };
}

describe('createApp', () => {
  it('requires basic auth', async () => {
    const response = await createApp(createServices()).request('/');

    expect(response.status).toBe(401);
  });

  it('returns gateway status JSON', async () => {
    const response = await createApp(createServices()).request('/gateway/status', {
      headers: { authorization: auth },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ state: 'stopped' });
  });

  it('returns log tail JSON', async () => {
    const response = await createApp(createServices()).request('/logs/tail', {
      headers: { authorization: auth },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ lines: ['line one'], warning: null });
  });
});
