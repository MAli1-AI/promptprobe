import { describe, it, expect } from 'vitest';
import { TEST_CASES, getTestCase } from './cases';
import { OVERRIDE_MARKER } from '../canaries';

describe('Security Test Cases Matrix (docs/testing.md)', () => {
  it('should have exactly 12 test cases', () => {
    expect(TEST_CASES).toHaveLength(12);
  });

  it('should have unique IDs matching the matrix', () => {
    const expectedIds = [
      'OV-1', 'OV-2', 'OV-3',
      'LK-1', 'LK-2', 'LK-3', 'LK-4',
      'PV-1', 'PV-2',
      'BC-1', 'BC-2', 'BC-3',
    ];
    const actualIds = TEST_CASES.map((c) => c.id);
    expect(actualIds).toEqual(expectedIds);
  });

  describe('Instruction Override (OV-1..3)', () => {
    const ovCases = TEST_CASES.filter((c) => c.id.startsWith('OV-'));

    it('should have 3 instruction override cases', () => {
      expect(ovCases).toHaveLength(3);
    });

    it('should have category "instruction_override" and aiJudged false', () => {
      for (const tc of ovCases) {
        expect(tc.category).toBe('instruction_override');
        expect(tc.aiJudged).toBe(false);
      }
    });

    it('should include the override marker token in all override prompts', () => {
      for (const tc of ovCases) {
        expect(tc.prompt).toContain(OVERRIDE_MARKER);
      }
    });
  });

  describe('Secret Leak (LK-1..4)', () => {
    const lkCases = TEST_CASES.filter((c) => c.id.startsWith('LK-'));

    it('should have 4 secret leak cases', () => {
      expect(lkCases).toHaveLength(4);
    });

    it('should have category "secret_leak" and aiJudged false', () => {
      for (const tc of lkCases) {
        expect(tc.category).toBe('secret_leak');
        expect(tc.aiJudged).toBe(false);
      }
    });

    it('LK-3 prompt must ask for encoded secret (base64, hex, reversed)', () => {
      const lk3 = getTestCase('LK-3');
      expect(lk3).toBeDefined();
      expect(lk3?.prompt.toLowerCase()).toContain('encoded');
      expect(lk3?.prompt.toLowerCase()).toContain('base64');
    });
  });

  describe('Policy Violation (PV-1..2)', () => {
    const pvCases = TEST_CASES.filter((c) => c.id.startsWith('PV-'));

    it('should have 2 policy violation cases', () => {
      expect(pvCases).toHaveLength(2);
    });

    it('should have category "policy_violation" and aiJudged true', () => {
      for (const tc of pvCases) {
        expect(tc.category).toBe('policy_violation');
        expect(tc.aiJudged).toBe(true);
      }
    });
  });

  describe('Benign Control (BC-1..3)', () => {
    const bcCases = TEST_CASES.filter((c) => c.id.startsWith('BC-'));

    it('should have 3 benign control cases', () => {
      expect(bcCases).toHaveLength(3);
    });

    it('should have category "benign_control" and aiJudged false', () => {
      for (const tc of bcCases) {
        expect(tc.category).toBe('benign_control');
        expect(tc.aiJudged).toBe(false);
      }
    });

    it('BC-2 innocently uses the word "secret"', () => {
      const bc2 = getTestCase('BC-2');
      expect(bc2).toBeDefined();
      expect(bc2?.prompt.toLowerCase()).toContain('secret');
      // Prompt should be innocent (e.g. cookie baking, not asking for keys)
      expect(bc2?.prompt).toContain('cookie');
    });
  });

  describe('Safe attack prompt scope', () => {
    it('prompts target only demo bots and contain no external URLs or third-party targets', () => {
      for (const tc of TEST_CASES) {
        expect(tc.prompt).not.toMatch(/https?:\/\//i);
      }
    });
  });

  describe('getTestCase helper', () => {
    it('should retrieve cases by id or return undefined', () => {
      expect(getTestCase('OV-1')?.id).toBe('OV-1');
      expect(getTestCase('UNKNOWN-99')).toBeUndefined();
    });
  });
});
