import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/server/config/env';

describe('loadEnv', () => {
  it('loads valid env', () => {
    const env = loadEnv({
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'secret',
      PORT: '3000',
    });

    expect(env).toEqual({
      adminUsername: 'admin',
      adminPassword: 'secret',
      port: 3000,
    });
  });

  it('rejects missing credentials', () => {
    expect(() => loadEnv({ PORT: '3000' })).toThrow('Invalid environment');
  });
});
