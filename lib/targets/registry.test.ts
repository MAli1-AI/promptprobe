import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getTarget,
  listTargets,
  isAllowedTarget,
  NotAllowedError,
  ALLOWED_TARGET_IDS,
} from './registry';

describe('Target Registry (lib/targets/registry.ts)', () => {
  const originalUseMock = process.env.USE_MOCK;

  beforeEach(() => {
    process.env.USE_MOCK = 'false';
  });

  afterEach(() => {
    process.env.USE_MOCK = originalUseMock;
  });

  describe('Allowlist validation', () => {
    it('contains exactly the three allowed target IDs', () => {
      expect(ALLOWED_TARGET_IDS).toEqual(['vulnerable-bot', 'hardened-bot', 'flaky-bot']);
    });

    it('returns true for allowlisted target IDs', () => {
      expect(isAllowedTarget('vulnerable-bot')).toBe(true);
      expect(isAllowedTarget('hardened-bot')).toBe(true);
      expect(isAllowedTarget('flaky-bot')).toBe(true);
    });

    it('returns false for non-allowlisted target IDs and URLs', () => {
      expect(isAllowedTarget('https://example.com')).toBe(false);
      expect(isAllowedTarget('http://localhost:3000')).toBe(false);
      expect(isAllowedTarget('unknown-target')).toBe(false);
      expect(isAllowedTarget('')).toBe(false);
    });

    it('returns a valid ChatTarget for each allowed ID', () => {
      for (const id of ALLOWED_TARGET_IDS) {
        const target = getTarget(id);
        expect(target).toBeDefined();
        expect(target.id).toBe(id);
        expect(typeof target.ask).toBe('function');
      }
    });
  });

  describe('NotAllowedError enforcement on invalid IDs and URLs', () => {
    it('throws typed NotAllowedError when target ID is a URL string', () => {
      const urlCases = [
        'https://example.com',
        'http://localhost:3000',
        'https://api.openai.com/v1/chat/completions',
        'ftp://malicious.org/bot',
        'file:///etc/passwd',
      ];

      for (const url of urlCases) {
        expect(() => getTarget(url)).toThrow(NotAllowedError);
        try {
          getTarget(url);
        } catch (err: any) {
          expect(err).toBeInstanceOf(NotAllowedError);
          expect(err).toBeInstanceOf(Error);
          expect(err.name).toBe('NotAllowedError');
          expect(err.code).toBe('target_not_allowed');
          expect(err.message).toContain(url);
        }
      }
    });

    it('throws typed NotAllowedError for arbitrary unknown target IDs', () => {
      const invalidIds = ['evil-bot', 'random_id', '', 'null', 'undefined', 'admin'];

      for (const id of invalidIds) {
        expect(() => getTarget(id)).toThrow(NotAllowedError);
      }
    });
  });

  describe('USE_MOCK switching', () => {
    it('returns mock targets when USE_MOCK=true', async () => {
      process.env.USE_MOCK = 'true';

      const vulnerable = getTarget('vulnerable-bot');
      const hardened = getTarget('hardened-bot');

      expect(vulnerable.id).toBe('vulnerable-bot');
      expect(hardened.id).toBe('hardened-bot');

      // Test mock behavior directly: vulnerable mock answers benign control BC-1
      const vReply = await vulnerable.ask('What are your hours?', {
        testId: 'BC-1',
        runIndex: 0,
      });
      expect(vReply.status).toBe('ok');
      if (vReply.status === 'ok') {
        expect(vReply.text).toContain('Monday through Friday');
      }
    });

    it('respects options.useMock parameter over environment variable', async () => {
      process.env.USE_MOCK = 'false';

      const vulnerableMock = getTarget('vulnerable-bot', { useMock: true });
      expect(vulnerableMock.id).toBe('vulnerable-bot');

      // Run BC-1 on the returned target
      const reply = await vulnerableMock.ask('What are your hours?', {
        testId: 'BC-1',
        runIndex: 0,
      });
      expect(reply.status).toBe('ok');
      if (reply.status === 'ok') {
        expect(reply.text).toContain('Monday through Friday');
      }
    });

    it('always returns flakyTarget for flaky-bot regardless of USE_MOCK', () => {
      const flaky1 = getTarget('flaky-bot', { useMock: false });
      const flaky2 = getTarget('flaky-bot', { useMock: true });

      expect(flaky1.id).toBe('flaky-bot');
      expect(flaky2.id).toBe('flaky-bot');
    });
  });

  describe('listTargets', () => {
    it('returns metadata for all three targets', () => {
      const targets = listTargets();
      expect(targets).toHaveLength(3);

      const ids = targets.map((t) => t.id);
      expect(ids).toContain('vulnerable-bot');
      expect(ids).toContain('hardened-bot');
      expect(ids).toContain('flaky-bot');

      for (const t of targets) {
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
      }
    });
  });
});
