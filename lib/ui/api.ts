import { Mode, Target, TestCase, TestSummary } from '../types';
import {
  FIXTURE_TARGETS,
  FIXTURE_TESTS,
  forbidden403Response,
  createFixtureScanResult,
} from './fixtures';

/**
 * Typed API error including HTTP status, error message, and optional error code.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Type guard for ApiError instances or error-like objects with status and message.
 */
export function isApiError(value: unknown): value is ApiError {
  if (value instanceof ApiError) {
    return true;
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof (value as { status: unknown }).status === 'number' &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'string'
  );
}

/**
 * Returns whether sample fixture data should be returned instead of calling the live API.
 */
export function isUseFixtures(): boolean {
  return process.env.NEXT_PUBLIC_USE_FIXTURES === 'true';
}

export interface TargetsResponse {
  targets: Target[];
  tests: TestCase[];
  mode: Mode;
}

/**
 * GET /api/targets
 * Returns allowlisted targets, test suite cases, and runtime mode.
 */
export async function getTargets(): Promise<TargetsResponse> {
  if (isUseFixtures()) {
    return {
      targets: FIXTURE_TARGETS,
      tests: FIXTURE_TESTS,
      mode: 'mock',
    };
  }

  const res = await fetch('/api/targets');
  if (!res.ok) {
    let message = `Failed to fetch targets: HTTP ${res.status}`;
    let code: string | undefined;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) {
        message = errJson.error.message;
      }
      if (errJson?.error?.code) {
        code = errJson.error.code;
      }
    } catch {
      // response body was not valid JSON
    }
    throw new ApiError(res.status, message, code);
  }

  return (await res.json()) as TargetsResponse;
}

/**
 * POST /api/scan
 * Runs a test case N times against a target bot.
 * Returns parsed TestSummary JSON on success or a typed ApiError on failure.
 */
export async function runScan(
  targetId: string,
  testId: string,
  runs: number = 3
): Promise<TestSummary | ApiError> {
  if (isUseFixtures()) {
    const isKnownTarget = FIXTURE_TARGETS.some((t) => t.id === targetId);
    if (!isKnownTarget) {
      return new ApiError(
        403,
        forbidden403Response.error.message,
        forbidden403Response.error.code
      );
    }
    return createFixtureScanResult(targetId, testId, runs);
  }

  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetId, testId, runs }),
    });

    if (!res.ok) {
      let message = `Scan request failed with HTTP ${res.status}`;
      let code: string | undefined;
      try {
        const errJson = await res.json();
        if (errJson?.error?.message) {
          message = errJson.error.message;
        }
        if (errJson?.error?.code) {
          code = errJson.error.code;
        }
      } catch {
        // response body was not valid JSON
      }
      return new ApiError(res.status, message, code);
    }

    return (await res.json()) as TestSummary;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return new ApiError(0, message);
  }
}
