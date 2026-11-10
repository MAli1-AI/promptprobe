import { runTest } from '../../../lib/engine/runner';
import { getTarget, NotAllowedError } from '../../../lib/targets/registry';
import { getTestCase } from '../../../lib/testlib/cases';
import { errorResponse } from '../../../lib/api/errors';
import { checkRateLimit, getClientKey } from '../../../lib/api/rateLimit';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MAX_BODY_CHARS = 4_096;

interface ScanBody {
  targetId: string;
  testId: string;
  runs: number;
}

type Parsed = { ok: true; body: ScanBody } | { ok: false; message: string };

function parseBody(raw: unknown): Parsed {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, message: 'Request body must be a JSON object' };
  }
  const { targetId, testId, runs } = raw as Record<string, unknown>;
  if (typeof targetId !== 'string' || targetId.length === 0) {
    return { ok: false, message: 'targetId is required and must be a non-empty string' };
  }
  if (typeof testId !== 'string' || testId.length === 0) {
    return { ok: false, message: 'testId is required and must be a non-empty string' };
  }
  let runCount = 1;
  if (runs !== undefined) {
    if (typeof runs !== 'number' || !Number.isInteger(runs) || runs < 1) {
      return { ok: false, message: 'runs must be an integer of 1 or more (values above 10 are clamped)' };
    }
    runCount = runs;
  }
  return { ok: true, body: { targetId, testId, runs: runCount } };
}

/**
 * POST /api/scan  { targetId, testId, runs? } -> TestSummary (one test, one target).
 * The client loops over tests, one request per test, so serverless limits are safe.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const limit = checkRateLimit(getClientKey(req));
    if (!limit.allowed) {
      return errorResponse(429, 'rate_limited', 'Too many scan requests, please slow down', {
        'Retry-After': String(limit.retryAfterSec),
      });
    }

    const text = await req.text();
    if (text.length > MAX_BODY_CHARS) {
      return errorResponse(400, 'invalid_body', 'Request body is too large');
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return errorResponse(400, 'invalid_body', 'Request body must be valid JSON');
    }
    const parsed = parseBody(json);
    if (!parsed.ok) {
      return errorResponse(400, 'invalid_body', parsed.message);
    }
    const { targetId, testId, runs } = parsed.body;

    // Allowlist check happens before anything else touches the id: no outbound request,
    // and a URL is just an unknown id.
    let target;
    try {
      target = getTarget(targetId);
    } catch (err) {
      if (err instanceof NotAllowedError) {
        return errorResponse(403, 'target_not_allowed', 'Target is not on the allowlist');
      }
      throw err;
    }

    const testCase = getTestCase(testId);
    if (!testCase) {
      return errorResponse(404, 'test_not_found', 'Unknown test id');
    }

    // A8: pass { judge } here once lib/engine/judge.ts exists.
    const summary = await runTest(target, testCase, runs);
    return Response.json(summary);
  } catch (err) {
    // Never leak details or keys: log only the error class.
    console.error('scan_failed', err instanceof Error ? err.name : 'unknown');
    return errorResponse(500, 'internal', 'Internal server error');
  }
}
