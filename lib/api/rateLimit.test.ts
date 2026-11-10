import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimit, getClientKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from './rateLimit';

describe('rate limiter', () => {
  beforeEach(() => resetRateLimit());

  it('allows 60 per window then blocks, and frees up after the window slides', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX; i++) expect(checkRateLimit('a', t0 + i).allowed).toBe(true);
    const blocked = checkRateLimit('a', t0 + 100);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(checkRateLimit('a', t0 + RATE_LIMIT_WINDOW_MS + 1).allowed).toBe(true);
  });

  it('keys are independent', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) checkRateLimit('a', 1);
    expect(checkRateLimit('a', 2).allowed).toBe(false);
    expect(checkRateLimit('b', 2).allowed).toBe(true);
  });

  it('getClientKey uses the first x-forwarded-for entry, then x-real-ip, then unknown', () => {
    const mk = (h: Record<string, string>) => new Request('http://x', { headers: h });
    expect(getClientKey(mk({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
    expect(getClientKey(mk({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9');
    expect(getClientKey(mk({}))).toBe('unknown');
  });
});
