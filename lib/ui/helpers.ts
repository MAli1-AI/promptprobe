import type { Category, RunStatus, Severity, Verdict } from '../types';

export const CATEGORY_LABELS: Record<Category, string> = {
  instruction_override: 'Instruction override',
  secret_leak: 'Secret leak',
  policy_violation: 'Policy violation',
  benign_control: 'Benign control',
};

export function getCategoryLabel(category: Category): string {
  return CATEGORY_LABELS[category] ?? category;
}

/**
 * Formats success rate as percentage string, or 'n/a' when null.
 */
export function formatPercent(rate: number | null): string {
  if (rate === null || Number.isNaN(rate)) {
    return 'n/a';
  }
  return `${Math.round(rate * 100)}%`;
}

/**
 * Clamps Retry-After header seconds to [1, 10], defaulting to 1 on invalid or missing values.
 */
export function clampRetryDelay(retryAfterHeader: string | null | undefined): number {
  if (!retryAfterHeader) {
    return 1;
  }
  const parsed = parseInt(retryAfterHeader.trim(), 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(parsed, 10);
}

/**
 * Validates runs input: must be an integer between 1 and 10.
 */
export function validateRuns(input: string | number): {
  valid: boolean;
  value?: number;
  error?: string;
} {
  const str = String(input).trim();
  if (str === '') {
    return { valid: false, error: 'Runs count is required' };
  }
  const num = Number(str);
  if (!Number.isInteger(num)) {
    return { valid: false, error: 'Runs must be a whole number between 1 and 10' };
  }
  if (num < 1 || num > 10) {
    return { valid: false, error: 'Runs must be between 1 and 10' };
  }
  return { valid: true, value: num };
}

/**
 * Clamps a runs value to [min, max], floors decimals, and falls back to 3 for invalid input.
 */
export function clampRuns(value: number | string, min = 1, max = 10, fallback = 3): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * Progress text for the scan loop, e.g. "test 3 of 12".
 */
export function formatProgress(completed: number, total: number): string {
  return `test ${completed} of ${total}`;
}

export interface BadgeStyle {
  label: string;
  symbol: string;
  className: string;
}

export function getVerdictBadgeProps(verdict: Verdict): BadgeStyle {
  switch (verdict) {
    case 'PASS':
      return {
        label: 'PASS',
        symbol: '✓',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
      };
    case 'FAIL':
      return {
        label: 'FAIL',
        symbol: '✗',
        className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
      };
    case 'ERROR':
    default:
      return {
        label: 'ERROR',
        symbol: '⚠',
        className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
      };
  }
}

export function getSeverityBadgeProps(severity: Severity): BadgeStyle {
  switch (severity) {
    case 'Critical':
      return {
        label: 'Critical',
        symbol: '▲',
        className: 'bg-rose-100 text-rose-900 border-rose-400 font-bold dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
      };
    case 'High':
      return {
        label: 'High',
        symbol: '▲',
        className: 'bg-orange-100 text-orange-900 border-orange-400 font-semibold dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800',
      };
    case 'Medium':
      return {
        label: 'Medium',
        symbol: '■',
        className: 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800',
      };
    case 'Low':
      return {
        label: 'Low',
        symbol: '▼',
        className: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
      };
    case 'None':
    default:
      return {
        label: 'None',
        symbol: '○',
        className: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      };
  }
}

export function getRunStatusBadgeProps(status: RunStatus): BadgeStyle {
  switch (status) {
    case 'flagged':
      return {
        label: 'Flagged',
        symbol: '✗',
        className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
      };
    case 'clean':
      return {
        label: 'Clean',
        symbol: '✓',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
      };
    case 'error':
    default:
      return {
        label: 'Error',
        symbol: '⚠',
        className: 'bg-slate-200 text-slate-800 border-slate-400 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
      };
  }
}