import { listTargets } from '../../../lib/targets/registry';
import { TEST_CASES } from '../../../lib/testlib/cases';
import { errorResponse } from '../../../lib/api/errors';
import type { Mode } from '../../../lib/types';

export const dynamic = 'force-dynamic';

/** GET /api/targets -> { targets, tests, mode } */
export async function GET(): Promise<Response> {
  try {
    const mode: Mode = process.env.USE_MOCK === 'true' ? 'mock' : 'live';
    return Response.json({ targets: listTargets(), tests: TEST_CASES, mode });
  } catch {
    return errorResponse(500, 'internal', 'Internal server error');
  }
}
