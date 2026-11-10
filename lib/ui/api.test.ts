import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTargets, probeTarget, scanTest, ScanApiError } from './api';

describe('lib/ui/api', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetchTargets parses 200 response', async () => {
    const mockData = {
      targets: [{ id: 'vulnerable-bot', name: 'Vulnerable', description: 'desc' }],
      tests: [{ id: 'LK-1', category: 'secret_leak', title: 'Leak', prompt: 'test', aiJudged: false }],
      mode: 'mock',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const result = await fetchTargets();
    expect(result.targets).toHaveLength(1);
    expect(result.mode).toBe('mock');
  });

  it('fetchTargets throws ScanApiError on error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'internal', message: 'Internal error' } }),
    });

    await expect(fetchTargets()).rejects.toThrow(ScanApiError);
  });

  it('scanTest retries once on 429', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          ok: false,
          status: 429,
          headers: new Headers({ 'Retry-After': '1' }),
          json: async () => ({ error: { code: 'rate_limited', message: 'Rate limited' } }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          targetId: 'vulnerable-bot',
          testId: 'LK-1',
          verdict: 'FAIL',
          severity: 'Critical',
        }),
      };
    });

    const summary = await scanTest('vulnerable-bot', 'LK-1', 1);
    expect(summary.verdict).toBe('FAIL');
    expect(callCount).toBe(2);
  });

  it('probeTarget handles 403 target_not_allowed verbatim', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          code: 'target_not_allowed',
          message: 'Target is not on the allowlist',
        },
      }),
    });

    const res = await probeTarget('https://example.com');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
    expect(res.message).toContain('Target is not on the allowlist');
  });
});
