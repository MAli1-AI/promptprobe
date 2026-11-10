import type {
  ChatTarget,
  ErrorKind,
  Mode,
  RunResult,
  TestCase,
  TestSummary,
} from '../types';
import { detectDeterministic, detectLeak, detectOverride } from './detectors';
import type { DetectionResult } from './detectors';
import {
  computeExplanation,
  computeSeverity,
  computeSuccessRate,
  computeVerdict,
  getMitigation,
} from './scoring';

export const MIN_RUNS = 1;
export const MAX_RUNS = 10;
export const MAX_CONCURRENCY = 3;
export const DEFAULT_MAX_CALLS = 25;
export const EXCERPT_MAX_CHARS = 300;

/** Result of an AI judge for policy_violation tests. */
export interface JudgeVerdict {
  violated: boolean;
  reason: string;
}

/** Injected judge: receives the test case and the target's reply text. */
export type JudgeFn = (input: { testCase: TestCase; reply: string }) => Promise<JudgeVerdict>;

export interface RunTestOptions {
  /** Max total calls (target asks + judge calls) for this runTest. Default: MAX_CALLS_PER_SCAN or 25. */
  maxCalls?: number;
  /** Optional AI judge used only for policy_violation tests. */
  judge?: JudgeFn;
  /** Overrides the mode derived from USE_MOCK. */
  mode?: Mode;
}

function resolveMaxCalls(optValue: number | undefined): number {
  if (typeof optValue === 'number' && Number.isFinite(optValue)) {
    return Math.max(0, Math.floor(optValue));
  }
  const fromEnv = Number.parseInt(process.env.MAX_CALLS_PER_SCAN ?? '', 10);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_MAX_CALLS;
}

function resolveMode(optValue: Mode | undefined): Mode {
  return optValue ?? (process.env.USE_MOCK === 'true' ? 'mock' : 'live');
}

/** Clamp requested runs to 1..10. Non-finite input becomes 1 (and counts as clamped). */
function clampRuns(requested: number): { runs: number; clamped: boolean; requested: number } {
  if (typeof requested !== 'number' || !Number.isFinite(requested)) {
    return { runs: MIN_RUNS, clamped: true, requested: MIN_RUNS };
  }
  const whole = Math.trunc(requested);
  const runs = Math.min(MAX_RUNS, Math.max(MIN_RUNS, whole));
  return { runs, clamped: runs !== requested, requested: whole };
}

function excerpt(text: string): string {
  return text.length > EXCERPT_MAX_CHARS ? text.slice(0, EXCERPT_MAX_CHARS) : text;
}

function isAiJudged(testCase: TestCase): boolean {
  return testCase.aiJudged || testCase.category === 'policy_violation';
}

function errorRun(
  index: number,
  errorKind: ErrorKind,
  detail: string | undefined,
  startedAt: number,
  aiJudged: boolean
): RunResult {
  return {
    index,
    status: 'error',
    errorKind,
    detail,
    responseExcerpt: '',
    durationMs: Date.now() - startedAt,
    aiJudged,
  };
}

function detectionRun(
  index: number,
  detection: DetectionResult,
  text: string,
  startedAt: number,
  aiJudged: boolean
): RunResult {
  return {
    index,
    status: detection.flagged ? 'flagged' : 'clean',
    evidence: detection.flagged ? detection.evidence : undefined,
    responseExcerpt: excerpt(text),
    durationMs: Date.now() - startedAt,
    aiJudged,
  };
}

/**
 * Runs one test case against one target `runs` times and returns a TestSummary.
 *
 * - runs clamped to 1..10 (summary.clamped tells the caller)
 * - at most MAX_CONCURRENCY (3) target calls in flight
 * - every target call and every judge call spends one unit of the call budget (a judged
 *   run reserves both up front); runs that cannot get budget become error runs with
 *   detail 'budget_exhausted'
 * - timeout / error / malformed replies become error runs (kind and detail kept)
 * - never throws: any unexpected exception inside a run becomes an error run
 */
export async function runTest(
  target: ChatTarget,
  testCase: TestCase,
  runs: number,
  opts: RunTestOptions = {}
): Promise<TestSummary> {
  const { runs: effectiveRuns, clamped, requested } = clampRuns(runs);
  const maxCalls = resolveMaxCalls(opts.maxCalls);
  const mode = resolveMode(opts.mode);
  const aiJudged = isAiJudged(testCase);

  // JS is single-threaded, so this check-and-increment is atomic between awaits.
  let callsUsed = 0;
  const takeCalls = (n: number): boolean => {
    if (callsUsed + n > maxCalls) return false;
    callsUsed += n;
    return true;
  };
  // A judged run needs a target call AND a judge call; reserve both up front (all or nothing)
  // so concurrent runs can't spend budget on target replies whose judge call would starve.
  const callsPerRun = testCase.category === 'policy_violation' && opts.judge ? 2 : 1;

  const executeRun = async (index: number): Promise<RunResult> => {
    const startedAt = Date.now();
    try {
      if (!takeCalls(callsPerRun)) {
        return errorRun(index, 'error', 'budget_exhausted', startedAt, aiJudged);
      }

      const reply = await target.ask(testCase.prompt, { testId: testCase.id, runIndex: index });

      if (reply.status === 'timeout') {
        return errorRun(index, 'timeout', 'timeout', startedAt, aiJudged);
      }
      if (reply.status === 'error') {
        return errorRun(index, 'error', reply.detail, startedAt, aiJudged);
      }
      if (reply.status === 'malformed') {
        return errorRun(index, 'malformed', reply.detail, startedAt, aiJudged);
      }
      if (reply.status !== 'ok' || typeof reply.text !== 'string') {
        return errorRun(index, 'malformed', 'unrecognized_reply', startedAt, aiJudged);
      }

      switch (testCase.category) {
        case 'secret_leak':
          return detectionRun(index, detectLeak(reply.text), reply.text, startedAt, aiJudged);
        case 'instruction_override':
          return detectionRun(index, detectOverride(reply.text), reply.text, startedAt, aiJudged);
        case 'benign_control':
          return detectionRun(
            index,
            detectDeterministic(reply.text),
            reply.text,
            startedAt,
            aiJudged
          );
        case 'policy_violation': {
          if (!opts.judge) {
            return errorRun(index, 'error', 'judge_unavailable', startedAt, true);
          }
          try {
            const verdict = await opts.judge({ testCase, reply: reply.text });
            if (!verdict || typeof verdict.violated !== 'boolean') {
              return errorRun(index, 'malformed', 'judge_malformed', startedAt, true);
            }
            return {
              index,
              status: verdict.violated ? 'flagged' : 'clean',
              evidence: verdict.violated ? String(verdict.reason ?? '') : undefined,
              responseExcerpt: excerpt(reply.text),
              durationMs: Date.now() - startedAt,
              aiJudged: true,
            };
          } catch {
            return errorRun(index, 'error', 'judge_failed', startedAt, true);
          }
        }
        default:
          return errorRun(index, 'error', 'unknown_category', startedAt, aiJudged);
      }
    } catch {
      // Deliberately generic: never echo exception text (could contain secrets).
      return errorRun(index, 'error', 'unexpected_error', startedAt, aiJudged);
    }
  };

  // Worker pool: at most MAX_CONCURRENCY runs in flight, indices dispatched in order
  // so budget is spent deterministically (lowest run indices first).
  const results: RunResult[] = new Array<RunResult>(effectiveRuns);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < effectiveRuns) {
      const index = nextIndex++;
      results[index] = await executeRun(index);
    }
  };
  const workerCount = Math.min(MAX_CONCURRENCY, effectiveRuns);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  let flagged = 0;
  let clean = 0;
  let errors = 0;
  for (const r of results) {
    if (r.status === 'flagged') flagged += 1;
    else if (r.status === 'clean') clean += 1;
    else errors += 1;
  }

  const successRate = computeSuccessRate(flagged, clean);
  const verdict = computeVerdict(flagged, clean, errors);
  const severity = computeSeverity(testCase.category, successRate);
  let explanation = computeExplanation(
    verdict,
    testCase.category,
    successRate,
    flagged,
    clean,
    errors
  );
  if (errors > 0 && verdict !== 'ERROR') {
    explanation += ` ${errors} error run(s) excluded from the rate.`;
  }

  return {
    targetId: target.id,
    testId: testCase.id,
    category: testCase.category,
    title: testCase.title,
    aiJudged,
    runsRequested: requested,
    clamped,
    flagged,
    clean,
    errors,
    successRate,
    verdict,
    severity,
    explanation,
    mitigation: getMitigation(testCase.category),
    mode,
    runs: results,
  };
}
