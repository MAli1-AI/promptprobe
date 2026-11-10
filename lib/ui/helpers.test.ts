import { describe, expect, it } from 'vitest';
import {
  clampRetryDelay,
  formatPercent,
  getCategoryLabel,
  getRunStatusBadgeProps,
  getSeverityBadgeProps,
  getVerdictBadgeProps,
  validateRuns,
} from './helpers';

describe('formatPercent', () => {
  it('formats null as n/a', () => {
    expect(formatPercent(null)).toBe('n/a');
  });

  it('formats 0 as 0%', () => {
    expect(formatPercent(0)).toBe('0%');
  });

  it('formats fractional values correctly', () => {
    expect(formatPercent(0.8)).toBe('80%');
    expect(formatPercent(0.3333)).toBe('33%');
    expect(formatPercent(1)).toBe('100%');
  });
});

describe('clampRetryDelay', () => {
  it('defaults to 1 on empty or null values', () => {
    expect(clampRetryDelay(null)).toBe(1);
    expect(clampRetryDelay(undefined)).toBe(1);
    expect(clampRetryDelay('')).toBe(1);
    expect(clampRetryDelay('invalid')).toBe(1);
  });

  it('uses parsed value when between 1 and 10', () => {
    expect(clampRetryDelay('5')).toBe(5);
    expect(clampRetryDelay('1')).toBe(1);
    expect(clampRetryDelay('10')).toBe(10);
  });

  it('clamps values above 10 to 10', () => {
    expect(clampRetryDelay('15')).toBe(10);
    expect(clampRetryDelay('60')).toBe(10);
  });

  it('clamps values below 1 to 1', () => {
    expect(clampRetryDelay('0')).toBe(1);
    expect(clampRetryDelay('-5')).toBe(1);
  });
});

describe('validateRuns', () => {
  it('validates integers 1 through 10', () => {
    expect(validateRuns(1)).toEqual({ valid: true, value: 1 });
    expect(validateRuns(3)).toEqual({ valid: true, value: 3 });
    expect(validateRuns(10)).toEqual({ valid: true, value: 10 });
    expect(validateRuns('5')).toEqual({ valid: true, value: 5 });
  });

  it('rejects invalid inputs', () => {
    expect(validateRuns(0).valid).toBe(false);
    expect(validateRuns(11).valid).toBe(false);
    expect(validateRuns('abc').valid).toBe(false);
    expect(validateRuns(2.5).valid).toBe(false);
    expect(validateRuns('').valid).toBe(false);
  });
});

describe('badge props', () => {
  it('returns distinct verdict badge props with symbol and label', () => {
    const pass = getVerdictBadgeProps('PASS');
    const fail = getVerdictBadgeProps('FAIL');
    const error = getVerdictBadgeProps('ERROR');

    expect(pass.label).toBe('PASS');
    expect(pass.symbol).toBe('✓');
    expect(fail.label).toBe('FAIL');
    expect(fail.symbol).toBe('✗');
    expect(error.label).toBe('ERROR');
    expect(error.symbol).toBe('⚠');

    expect(pass.className).not.toBe(fail.className);
    expect(fail.className).not.toBe(error.className);
  });

  it('returns distinct severity badge props', () => {
    const severities = ['None', 'Low', 'Medium', 'High', 'Critical'] as const;
    const labels = severities.map((s) => getSeverityBadgeProps(s).label);
    expect(labels).toEqual(['None', 'Low', 'Medium', 'High', 'Critical']);
  });

  it('returns run status badge props', () => {
    expect(getRunStatusBadgeProps('clean').label).toBe('Clean');
    expect(getRunStatusBadgeProps('flagged').label).toBe('Flagged');
    expect(getRunStatusBadgeProps('error').label).toBe('Error');
  });

  it('returns category labels', () => {
    expect(getCategoryLabel('secret_leak')).toBe('Secret leak');
    expect(getCategoryLabel('instruction_override')).toBe('Instruction override');
  });
});
