import { Category, ErrorKind, RunStatus, Severity, TestSummary, Verdict } from '../types';

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
 * Error gets a distinct amber color clearly different from emerald (PASS) and rose (FAIL).
 */
export function getVerdictBadgeClasses(verdict: Verdict): string {
  switch (verdict) {
    case 'PASS':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700';
    case 'FAIL':
      return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-700';
    case 'ERROR':
      return 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }
}

/**
 * Returns Tailwind badge classes for a given Severity level.
 */
export function getSeverityBadgeClasses(severity: Severity): string {
  switch (severity) {
    case 'Critical':
      return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-700';
    case 'High':
      return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700';
    case 'Medium':
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700';
    case 'Low':
      return 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-700';
    case 'None':
    default:
      return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }
}

/**
 * Returns a label and Tailwind badge classes for a given RunStatus and optional ErrorKind.
 * Error, timeout, and malformed results always get a text label "ERROR" and distinct amber styling.
 */
export function getRunStatusBadge(
  status: RunStatus,
  errorKind?: ErrorKind
): { label: string; classes: string } {
  if (status === 'error' || errorKind) {
    const kindSuffix = errorKind ? ` (${errorKind.toUpperCase()})` : '';
    return {
      label: `ERROR${kindSuffix}`,
      classes:
        'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700',
    };
  }

  if (status === 'flagged') {
    return {
      label: 'FLAGGED',
      classes:
        'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-700',
    };
  }

  if (status === 'clean') {
    return {
      label: 'CLEAN',
      classes:
        'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700',
    };
  }

  return {
    label: String(status).toUpperCase(),
    classes:
      'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  };
}

/**
 * Returns user-friendly explanations for network failures, 400, 403, 429, and 500 HTTP responses.
 */
export function getFriendlyErrorMessage(status: number, originalMessage?: string): string {
  switch (status) {
    case 0:
      return 'Network failure: Unable to reach the server. Please check your network connection.';
    case 400:
      return originalMessage
        ? `Bad Request (400): ${originalMessage}`
        : 'Bad Request (400): The scan request was malformed or contains invalid parameters.';
    case 403:
      return originalMessage
        ? `Target Not Allowed (403): ${originalMessage}`
        : 'Target Not Allowed (403): The requested target bot is not on the authorized allowlist.';
    case 429:
      return 'Rate Limited (429): Request limit reached (max 60 requests per minute). Please wait a moment before trying again.';
    case 500:
      return originalMessage
        ? `Server Error (500): ${originalMessage}`
        : 'Server Error (500): The server encountered an internal error processing the test request.';
    default:
      return originalMessage || `Request failed with status ${status}.`;
  }
}

export interface SummaryCounts {
  testsRun: number;
  passed: number;
  failed: number;
  errors: number;
}

/**
 * Computes summary counts (tests run, passed, failed, errors) from a list of TestSummary items.
 */
export function computeSummaryCounts(results: TestSummary[]): SummaryCounts {
  const counts: SummaryCounts = {
    testsRun: results.length,
    passed: 0,
    failed: 0,
    errors: 0,
  };

  for (const r of results) {
    if (r.verdict === 'PASS') {
      counts.passed += 1;
    } else if (r.verdict === 'FAIL') {
      counts.failed += 1;
    } else if (r.verdict === 'ERROR') {
      counts.errors += 1;
    }
  }

  return counts;
}

/**
 * Formats the scan progress string strictly following "test X of Y".
 */
export function formatProgress(current: number, total: number): string {
  return `test ${current} of ${total}`;
}
