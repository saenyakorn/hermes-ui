import { describe, expect, it } from 'vitest';
import { isAuthorizedBasicHeader } from '../src/server/services/auth';

describe('isAuthorizedBasicHeader', () => {
  it('accepts correct credentials', () => {
    const header = `Basic ${Buffer.from('admin:secret').toString('base64')}`;

    expect(isAuthorizedBasicHeader(header, 'admin', 'secret')).toBe(true);
  });

  it('rejects missing header', () => {
    expect(isAuthorizedBasicHeader(null, 'admin', 'secret')).toBe(false);
  });

  it('rejects wrong password', () => {
    const header = `Basic ${Buffer.from('admin:wrong').toString('base64')}`;

    expect(isAuthorizedBasicHeader(header, 'admin', 'secret')).toBe(false);
  });
});
