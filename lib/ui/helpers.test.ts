import { describe, it, expect } from 'vitest';
import {
  formatSuccessRate,
  formatCategory,
  clampRuns,
  getVerdictBadgeClasses,
  formatProgress,
} from './helpers';

describe('UI pure helpers', () => {
  describe('formatSuccessRate', () => {
    it('returns "N/A" for null or NaN', () => {
      expect(formatSuccessRate(null)).toBe('N/A');
      expect(formatSuccessRate(NaN)).toBe('N/A');
    });

    it('formats 0 as "0%"', () => {
      expect(formatSuccessRate(0)).toBe('0%');
    });

    it('formats 1 as "100%"', () => {
      expect(formatSuccessRate(1)).toBe('100%');
    });

    it('rounds fractions to nearest percentage', () => {
      expect(formatSuccessRate(0.66666)).toBe('67%');
      expect(formatSuccessRate(0.33333)).toBe('33%');
      expect(formatSuccessRate(0.25)).toBe('25%');
    });
  });

  describe('formatCategory', () => {
    it('translates all Category enum values', () => {
      expect(formatCategory('instruction_override')).toBe('Instruction Override');
      expect(formatCategory('secret_leak')).toBe('Secret Leak');
      expect(formatCategory('policy_violation')).toBe('Policy Violation');
      expect(formatCategory('benign_control')).toBe('Benign Control');
    });

    it('returns raw string for unknown categories', () => {
      // @ts-expect-error testing fallback
      expect(formatCategory('unknown_category')).toBe('unknown_category');
    });
  });

  describe('clampRuns', () => {
    it('clamps values below 1 to 1', () => {
      expect(clampRuns(0)).toBe(1);
      expect(clampRuns(-5)).toBe(1);
    });

    it('clamps values above 10 to 10', () => {
      expect(clampRuns(11)).toBe(10);
      expect(clampRuns(99)).toBe(10);
    });

    it('keeps integer values in range 1-10', () => {
      expect(clampRuns(1)).toBe(1);
      expect(clampRuns(3)).toBe(3);
      expect(clampRuns(10)).toBe(10);
    });

    it('floors floating-point values', () => {
      expect(clampRuns(3.7)).toBe(3);
    });

    it('defaults to 3 for NaN, null or undefined', () => {
      expect(clampRuns(NaN)).toBe(3);
      // @ts-expect-error testing fallback
      expect(clampRuns(null)).toBe(3);
      // @ts-expect-error testing fallback
      expect(clampRuns(undefined)).toBe(3);
    });
  });

  describe('getVerdictBadgeClasses', () => {
    it('returns emerald classes for PASS', () => {
      expect(getVerdictBadgeClasses('PASS')).toContain('emerald');
    });

    it('returns rose classes for FAIL', () => {
      expect(getVerdictBadgeClasses('FAIL')).toContain('rose');
    });

    it('returns amber classes for ERROR', () => {
      expect(getVerdictBadgeClasses('ERROR')).toContain('amber');
    });

    it('returns gray classes for unrecognized status', () => {
      // @ts-expect-error testing fallback
      expect(getVerdictBadgeClasses('UNKNOWN')).toContain('gray');
    });
  });

  describe('formatProgress', () => {
    it('formats strictly as "test X of Y"', () => {
      expect(formatProgress(1, 12)).toBe('test 1 of 12');
      expect(formatProgress(5, 12)).toBe('test 5 of 12');
      expect(formatProgress(12, 12)).toBe('test 12 of 12');
    });
  });
});
