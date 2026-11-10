import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/engine/runner', () => ({
  runTest: vi.fn(async () => {
    throw new Error('upstream exploded with key FAKE_TEST_KEY_VALUE');
  }),
}));

import { POST } from './route';
import { resetRateLimit } from '../../../lib/api/rateLimit';

describe('POST /api/scan unexpected failures', () => {
  beforeEach(() => {
    process.env.USE_MOCK = 'true';
    resetRateLimit();
  });

  it('500 internal without leaking the exception message or keys', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(
      new Request('http://localhost/api/scan', {
        method: 'POST',
        headers: { 'x-forwarded-for': '198.51.100.1' },
        body: JSON.stringify({ targetId: 'vulnerable-bot', testId: 'LK-1' }),
      })
    );
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: { code: 'internal', message: 'Internal server error' } });
    expect(text).not.toContain('FAKE_TEST_KEY_VALUE');
    expect(JSON.stringify(errSpy.mock.calls)).not.toContain('FAKE_TEST_KEY_VALUE');
    errSpy.mockRestore();
  });
});
