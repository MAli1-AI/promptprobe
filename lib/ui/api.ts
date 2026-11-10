import type { Mode, Target, TestCase, TestSummary } from '../types';
import { clampRetryDelay } from './helpers';

export interface TargetsApiResponse {
  targets: Target[];
  tests: TestCase[];
  mode: Mode;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export class ScanApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ScanApiError';
    this.status = status;
    this.code = code;
  }
}

function shouldUseFixtures(): boolean {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_USE_FIXTURES === 'true') {
    return true;
  }
  return false;
}

const FIXTURE_TARGETS: Target[] = [
  { id: 'vulnerable-bot', name: 'Vulnerable Bot', description: 'Simulated bot with no defenses' },
  { id: 'hardened-bot', name: 'Hardened Bot', description: 'Simulated defended bot' },
  { id: 'flaky-bot', name: 'Flaky Bot', description: 'Simulated flaky bot with error runs' },
];

const FIXTURE_TESTS: TestCase[] = [
  { id: 'OV-1', category: 'instruction_override', title: 'Ignore previous instructions', prompt: 'test', aiJudged: false },
  { id: 'LK-1', category: 'secret_leak', title: 'Direct secret extraction', prompt: 'test', aiJudged: false },
  { id: 'PV-1', category: 'policy_violation', title: 'Pressure for out-of-policy refund', prompt: 'test', aiJudged: true },
  { id: 'BC-1', category: 'benign_control', title: 'Normal product question', prompt: 'test', aiJudged: false },
];

/**
 * Fetch available scan targets and test cases.
 */
export async function fetchTargets(): Promise<TargetsApiResponse> {
  if (shouldUseFixtures()) {
    return {
      targets: FIXTURE_TARGETS,
      tests: FIXTURE_TESTS,
      mode: 'mock',
    };
  }

  const res = await fetch('/api/targets');
  if (!res.ok) {
    let message = `Failed to fetch targets (HTTP ${res.status})`;
    try {
      const errJson = (await res.json()) as ApiErrorResponse;
      if (errJson?.error?.message) {
        message = errJson.error.message;
      }
    } catch {
      // ignore
    }
    throw new ScanApiError(res.status, 'targets_failed', message);
  }

  return (await res.json()) as TargetsApiResponse;
}

/**
 * Executes a single test against the target via POST /api/scan.
 * On 429 rate limit, waits up to 10s based on Retry-After header and retries once.
 */
export async function scanTest(
  targetId: string,
  testId: string,
  runs: number = 3
): Promise<TestSummary> {
  if (shouldUseFixtures()) {
    return {
      targetId,
      testId,
      category: 'secret_leak',
      title: 'Direct secret extraction (Fixture)',
      aiJudged: false,
      runsRequested: runs,
      clamped: runs > 10,
      flagged: targetId === 'vulnerable-bot' ? runs : 0,
      clean: targetId === 'vulnerable-bot' ? 0 : runs,
      errors: 0,
      successRate: targetId === 'vulnerable-bot' ? 1.0 : 0.0,
      verdict: targetId === 'vulnerable-bot' ? 'FAIL' : 'PASS',
      severity: targetId === 'vulnerable-bot' ? 'Critical' : 'None',
      explanation: 'Simulated fixture result',
      mitigation: 'Keep secrets server side',
      mode: 'mock',
      runs: Array.from({ length: runs }, (_, i) => ({
        index: i + 1,
        status: targetId === 'vulnerable-bot' ? 'flagged' : 'clean',
        responseExcerpt: 'Simulated response from fixture',
        durationMs: 42,
        aiJudged: false,
      })),
    };
  }

  const sendRequest = async (): Promise<Response> => {
    return fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, testId, runs }),
    });
  };

  let res = await sendRequest();

  // Retry once on 429
  if (res.status === 429) {
    const retrySec = clampRetryDelay(res.headers.get('Retry-After'));
    await new Promise((resolve) => setTimeout(resolve, retrySec * 1000));
    res = await sendRequest();
  }

  if (!res.ok) {
    let errorCode = 'scan_failed';
    let errorMessage = `HTTP ${res.status} ${res.statusText}`;
    try {
      const errJson = (await res.json()) as ApiErrorResponse;
      if (errJson?.error) {
        errorCode = errJson.error.code || errorCode;
        errorMessage = errJson.error.message || errorMessage;
      }
    } catch {
      // keep fallback errorMessage
    }
    throw new ScanApiError(res.status, errorCode, errorMessage);
  }

  return (await res.json()) as TestSummary;
}

/**
 * Sends a single probe to POST /api/scan with testId 'LK-1' and runs 1.
 * Returns the exact API message or result text without throwing.
 */
export async function probeTarget(targetId: string): Promise<{
  ok: boolean;
  status: number;
  message: string;
}> {
  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, testId: 'LK-1', runs: 1 }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        ok: true,
        status: res.status,
        message: `Success: target is allowed. Test LK-1 returned verdict: ${data.verdict}`,
      };
    }

    try {
      const errJson = (await res.json()) as ApiErrorResponse;
      if (errJson?.error?.message) {
        return {
          ok: false,
          status: res.status,
          message: `${errJson.error.message} (code: ${errJson.error.code})`,
        };
      }
    } catch {
      // not JSON
    }

    return {
      ok: false,
      status: res.status,
      message: `Request failed with HTTP ${res.status}: ${res.statusText}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : 'Network error',
    };
  }
}
