import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ApiError,
  isApiError,
  getTargets,
  runScan,
  isUseFixtures,
} from './api';
import {
  vulnerableBotLeakFixture,
  hardenedBotCleanFixture,
  errorRunsFixture,
  aiJudgedFixture,
  forbidden403Response,
} from './fixtures';

describe('UI API module and fixtures', () => {
  const originalEnv = process.env.NEXT_PUBLIC_USE_FIXTURES;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_USE_FIXTURES = 'true';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_USE_FIXTURES = originalEnv;
    vi.restoreAllMocks();
  });

  describe('ApiError and isApiError', () => {
    it('instantiates ApiError with status, message, and code', () => {
      const err = new ApiError(403, 'Forbidden bot', 'target_not_allowed');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(403);
      expect(err.message).toBe('Forbidden bot');
      expect(err.code).toBe('target_not_allowed');
      expect(err.name).toBe('ApiError');
    });

    it('identifies ApiError instances and duck-typed error objects', () => {
      const err = new ApiError(404, 'Not found');
      expect(isApiError(err)).toBe(true);
      expect(isApiError({ status: 500, message: 'Server down' })).toBe(true);

      expect(isApiError(null)).toBe(false);
      expect(isApiError(undefined)).toBe(false);
      expect(isApiError('error string')).toBe(false);
      expect(isApiError(vulnerableBotLeakFixture)).toBe(false);
    });

    it('checks isUseFixtures returns true when NEXT_PUBLIC_USE_FIXTURES is true', () => {
      process.env.NEXT_PUBLIC_USE_FIXTURES = 'true';
      expect(isUseFixtures()).toBe(true);

      process.env.NEXT_PUBLIC_USE_FIXTURES = 'false';
      expect(isUseFixtures()).toBe(false);
    });
  });

  describe('Fixtures validation', () => {
    it('validates vulnerable-bot leak fixture structure', () => {
      expect(vulnerableBotLeakFixture.targetId).toBe('vulnerable-bot');
      expect(vulnerableBotLeakFixture.category).toBe('secret_leak');
      expect(vulnerableBotLeakFixture.flagged).toBeGreaterThan(0);
      expect(vulnerableBotLeakFixture.verdict).toBe('FAIL');
      expect(vulnerableBotLeakFixture.severity).toBe('Critical');
      expect(vulnerableBotLeakFixture.runs.every((r) => r.status === 'flagged')).toBe(true);
      expect(vulnerableBotLeakFixture.runs[0].evidence).toBeDefined();
    });

    it('validates hardened-bot clean result structure', () => {
      expect(hardenedBotCleanFixture.targetId).toBe('hardened-bot');
      expect(hardenedBotCleanFixture.flagged).toBe(0);
      expect(hardenedBotCleanFixture.clean).toBeGreaterThan(0);
      expect(hardenedBotCleanFixture.verdict).toBe('PASS');
      expect(hardenedBotCleanFixture.severity).toBe('None');
      expect(hardenedBotCleanFixture.runs.every((r) => r.status === 'clean')).toBe(true);
    });

    it('validates error/timeout/malformed runs fixture', () => {
      expect(errorRunsFixture.targetId).toBe('flaky-bot');
      expect(errorRunsFixture.verdict).toBe('ERROR');
      expect(errorRunsFixture.errors).toBe(3);
      expect(errorRunsFixture.successRate).toBeNull();
      const errorKinds = errorRunsFixture.runs.map((r) => r.errorKind);
      expect(errorKinds).toContain('timeout');
      expect(errorKinds).toContain('error');
      expect(errorKinds).toContain('malformed');
    });

    it('validates AI-judged result fixture', () => {
      expect(aiJudgedFixture.aiJudged).toBe(true);
      expect(aiJudgedFixture.category).toBe('policy_violation');
      expect(aiJudgedFixture.verdict).toBe('FAIL');
      expect(aiJudgedFixture.severity).toBe('Medium');
      expect(aiJudgedFixture.runs.some((r) => r.aiJudged)).toBe(true);
    });

    it('validates forbidden 403 response structure for unknown target ids', () => {
      expect(forbidden403Response.error.code).toBe('target_not_allowed');
      expect(forbidden403Response.error.message).toContain('Target not allowed');
    });
  });

  describe('getTargets() helper', () => {
    it('returns fixture targets, test suite, and mock mode when fixtures are enabled', async () => {
      process.env.NEXT_PUBLIC_USE_FIXTURES = 'true';
      const result = await getTargets();

      expect(result.mode).toBe('mock');
      expect(result.targets.length).toBeGreaterThanOrEqual(3);
      expect(result.tests.length).toBeGreaterThanOrEqual(12);

      const targetIds = result.targets.map((t) => t.id);
      expect(targetIds).toContain('vulnerable-bot');
      expect(targetIds).toContain('hardened-bot');
      expect(targetIds).toContain('flaky-bot');
    });

    it('calls fetch when fixtures are disabled', async () => {
      process.env.NEXT_PUBLIC_USE_FIXTURES = 'false';
      const mockData = {
        targets: [{ id: 'mock-bot', name: 'Mock Bot', description: 'desc' }],
        tests: [],
        mode: 'live',
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await getTargets();
      expect(fetchMock).toHaveBeenCalledWith('/api/targets');
      expect(res.targets[0].id).toBe('mock-bot');
    });

    it('throws ApiError when fetch fails with HTTP error', async () => {
      process.env.NEXT_PUBLIC_USE_FIXTURES = 'false';
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: 'internal', message: 'DB down' } }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(getTargets()).rejects.toThrow(ApiError);
    });
  });

  describe('runScan() helper', () => {
    it('returns 403 ApiError for unknown target id in fixture mode', async () => {
      process.env.NEXT_PUBLIC_USE_FIXTURES = 'true';
      const result = await runScan('unknown-target-id', 'LK-1', 3);

      expect(isApiError(result)).toBe(true);
      if (isApiError(result)) {
        expect(result.status).toBe(403);
        expect(result.code).toBe('target_not_allowed');
        expect(result.message).toContain('Target not allowed');
      }
    });

    it('returns clean result for hardened-bot in fixture mode', async () => {
      process.env.NEXT_PUBLIC_USE_FIXTURES = 'true';
      const result = await runScan('hardened-bot', 'LK-1', 3);

      expect(isApiError(result)).toBe(false);
      if (!isApiError(result)) {
        expect(result.targetId).toBe('hardened-bot');
        expect(result.verdict).toBe('PASS');
        expect(result.flagged).toBe(0);
        expect(result.clean).toBe(3);
      }
    });

    it('returns leak result for vulnerable-bot in fixture mode', async () => {
      process.env.NEXT_PUBLIC_USE_FIXTURES = 'true';
      const result = await runScan('vulnerable-bot', 'LK-1', 3);

      expect(isApiError(result)).toBe(false);
      if (!isApiError(result)) {
        expect(result.targetId).toBe('vulnerable-bot');
        expect(result.verdict).toBe('FAIL');
        expect(result.flagged).toBe(3);
      }
    });

    it('returns AI-judged result for policy violation test on vulnerable-bot', async () => {
      process.env.NEXT_PUBLIC_USE_FIXTURES = 'true';
      const result = await runScan('vulnerable-bot', 'PV-1', 3);

      expect(isApiError(result)).toBe(false);
      if (!isApiError(result)) {
        expect(result.aiJudged).toBe(true);
        expect(result.category).toBe('policy_violation');
      }
    });

    it('returns error-run results for flaky-bot in fixture mode', async () => {
      process.env.NEXT_PUBLIC_USE_FIXTURES = 'true';
      const result = await runScan('flaky-bot', 'LK-3', 3);

      expect(isApiError(result)).toBe(false);
      if (!isApiError(result)) {
        expect(result.targetId).toBe('flaky-bot');
        expect(result.verdict).toBe('ERROR');
        expect(result.errors).toBe(3);
      }
    });

    it('performs POST /api/scan when fixtures are disabled', async () => {
      process.env.NEXT_PUBLIC_USE_FIXTURES = 'false';
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => vulnerableBotLeakFixture,
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await runScan('vulnerable-bot', 'LK-1', 3);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/scan',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ targetId: 'vulnerable-bot', testId: 'LK-1', runs: 3 }),
        })
      );
      expect(isApiError(result)).toBe(false);
    });

    it('returns typed ApiError when POST /api/scan fails with HTTP error', async () => {
      process.env.NEXT_PUBLIC_USE_FIXTURES = 'false';
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => forbidden403Response,
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await runScan('unallowed-bot', 'LK-1', 3);
      expect(isApiError(result)).toBe(true);
      if (isApiError(result)) {
        expect(result.status).toBe(403);
        expect(result.code).toBe('target_not_allowed');
      }
    });
  });
});
