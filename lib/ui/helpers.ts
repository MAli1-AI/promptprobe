import { Category, Verdict } from '../types';

/**
 * Formats a success rate number (0..1) as a percentage string (e.g. "67%").
 * Returns "N/A" if the rate is null (no non-error runs).
 */
export function formatSuccessRate(rate: number | null): string {
  if (rate === null || Number.isNaN(rate)) {
    return 'N/A';
  }
  return `${Math.round(rate * 100)}%`;
}

/**
 * Formats a Category enum value into a user-friendly label.
 */
export function formatCategory(category: Category): string {
  switch (category) {
    case 'instruction_override':
      return 'Instruction Override';
    case 'secret_leak':
      return 'Secret Leak';
    case 'policy_violation':
      return 'Policy Violation';
    case 'benign_control':
      return 'Benign Control';
    default:
      return category;
  }
}

/**
 * Clamps the requested runs-per-test value between 1 and 10.
 * Defaults to 3 for NaN or invalid input.
 */
export function clampRuns(runs: number): number {
  if (Number.isNaN(runs) || runs === null || runs === undefined) {
    return 3;
  }
  const floored = Math.floor(runs);
  if (floored < 1) return 1;
  if (floored > 10) return 10;
  return floored;
}

/**
 * Returns Tailwind badge classes for a given Verdict.
 */
export function getVerdictBadgeClasses(verdict: Verdict): string {
  switch (verdict) {
    case 'PASS':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700';
    case 'FAIL':
      return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-700';
    case 'ERROR':
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }
}

/**
 * Formats the scan progress string strictly following "test X of Y".
 */
export function formatProgress(current: number, total: number): string {
  return `test ${current} of ${total}`;
}
