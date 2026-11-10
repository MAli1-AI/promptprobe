import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';
import { GET } from '../targets/route';
import { resetRateLimit, RATE_LIMIT_MAX } from '../../../lib/api/rateLimit';

let ipCounter = 0;
function scanRequest(body: unknown, ip?: string, rawBody?: string): Request {
  return new Request('http://localhost/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip ?? `10.0.0.${++ipCounter}` },
    body: rawBody ?? JSON.stringify(body),
  });
}

async function errorOf(res: Response): Promise<{ code: string; message: string }> {
  const json = (await res.json()) as { error: { code: string; message: string } };
  return json.error;
}

describe('POST /api/scan (USE_MOCK=true)', () => {
  const originalUseMock = process.env.USE_MOCK;

  beforeEach(() => {
    process.env.USE_MOCK = 'true';
    resetRateLimit();
  });
  afterEach(() => {
    if (originalUseMock === undefined) delete process.env.USE_MOCK;
    else process.env.USE_MOCK = originalUseMock;
    vi.restoreAllMocks();
  });

  it('200 with a TestSummary-shaped body', async () => {
    const res = await POST(scanRequest({ targetId: 'vulnerable-bot', testId: 'LK-1', runs: 5 }));
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s).toMatchObject({
      targetId: 'vulnerable-bot',
      testId: 'LK-1',
      category: 'secret_leak',
      runsRequested: 5,
      clamped: false,
      mode: 'mock',
    });
    expect(s.runs).toHaveLength(5);
    expect(s.flagged + s.clean + s.errors).toBe(5);
    expect(s.flagged).toBeGreaterThan(0);
    expect(s.verdict).toBe('FAIL');
    expect(typeof s.mitigation).toBe('string');
  });

  it('defaults runs to 1 when omitted', async () => {
    const res = await POST(scanRequest({ targetId: 'hardened-bot', testId: 'BC-1' }));
    expect(res.status).toBe(200);
    expect((await res.json()).runs).toHaveLength(1);
  });

  it('403 for a URL target, with no outbound request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await POST(scanRequest({ targetId: 'https://example.com', testId: 'LK-1' }));
    expect(res.status).toBe(403);
    const err = await errorOf(res);
    expect(err.code).toBe('target_not_allowed');
    expect(err.message).not.toContain('example.com');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('403 for any unknown target id, including internal addresses', async () => {
    for (const id of ['evil-bot', 'http://169.254.169.254/latest/meta-data', '../etc/passwd', 'VULNERABLE-BOT']) {
      const res = await POST(scanRequest({ targetId: id, testId: 'LK-1' }));
      expect(res.status, id).toBe(403);
    }
  });

  describe('400 invalid_body', () => {
    const cases: Array<[string, () => Request]> = [
      ['runs 0', () => scanRequest({ targetId: 'vulnerable-bot', testId: 'LK-1', runs: 0 })],
      ['runs negative', () => scanRequest({ targetId: 'vulnerable-bot', testId: 'LK-1', runs: -3 })],
      ['runs 1.5', () => scanRequest({ targetId: 'vulnerable-bot', testId: 'LK-1', runs: 1.5 })],
      ['runs "x"', () => scanRequest({ targetId: 'vulnerable-bot', testId: 'LK-1', runs: 'x' })],
      ['runs "3" (string)', () => scanRequest({ targetId: 'vulnerable-bot', testId: 'LK-1', runs: '3' })],
      ['runs null', () => scanRequest({ targetId: 'vulnerable-bot', testId: 'LK-1', runs: null })],
      ['missing targetId', () => scanRequest({ testId: 'LK-1' })],
      ['missing testId', () => scanRequest({ targetId: 'vulnerable-bot' })],
      ['empty object', () => scanRequest({})],
      ['targetId not a string', () => scanRequest({ targetId: 5, testId: 'LK-1' })],
      ['JSON array', () => scanRequest([1, 2])],
      ['JSON null', () => scanRequest(null)],
      ['non-JSON text', () => scanRequest(undefined, undefined, 'not json {')],
      ['empty body', () => scanRequest(undefined, undefined, '')],
      ['oversized body', () => scanRequest({ targetId: 'x'.repeat(10_000), testId: 'LK-1' })],
    ];
    for (const [name, make] of cases) {
      it(name, async () => {
        const res = await POST(make());
        expect(res.status).toBe(400);
        expect((await errorOf(res)).code).toBe('invalid_body');
      });
    }
  });

  it('404 for an unknown testId', async () => {
    const res = await POST(scanRequest({ targetId: 'vulnerable-bot', testId: 'NOPE-9' }));
    expect(res.status).toBe(404);
    expect((await errorOf(res)).code).toBe('test_not_found');
  });

  it('403 wins over 404 when both target and test are unknown', async () => {
    const res = await POST(scanRequest({ targetId: 'evil', testId: 'NOPE-9' }));
    expect(res.status).toBe(403);
  });

  it('clamps runs 50 to 10 with clamped:true', async () => {
    const res = await POST(scanRequest({ targetId: 'hardened-bot', testId: 'BC-1', runs: 50 }));
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s.runs).toHaveLength(10);
    expect(s.clamped).toBe(true);
    expect(s.runsRequested).toBe(50);
  });

  it('429 after 60 requests per minute from one IP, with Retry-After; other IPs unaffected', async () => {
    const ip = '203.0.113.7';
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      const ok = await POST(scanRequest({ targetId: 'hardened-bot', testId: 'BC-3' }, ip));
      expect(ok.status).toBe(200);
    }
    const limited = await POST(scanRequest({ targetId: 'hardened-bot', testId: 'BC-3' }, ip));
    expect(limited.status).toBe(429);
    expect((await errorOf(limited)).code).toBe('rate_limited');
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);

    const other = await POST(scanRequest({ targetId: 'hardened-bot', testId: 'BC-3' }, '203.0.113.8'));
    expect(other.status).toBe(200);
  });

  it('flaky-bot returns 200 with error runs, not a 5xx', async () => {
    const res = await POST(scanRequest({ targetId: 'flaky-bot', testId: 'LK-1', runs: 5 }));
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s.errors).toBe(3);
    expect(s.runs.map((r: { errorKind?: string }) => r.errorKind)).toEqual([
      undefined, 'timeout', 'error', 'malformed', undefined,
    ]);
  });

  it('policy tests without a judge return 200 with judge_unavailable error runs', async () => {
    const res = await POST(scanRequest({ targetId: 'vulnerable-bot', testId: 'PV-1', runs: 2 }));
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s.aiJudged).toBe(true);
    expect(s.verdict).toBe('ERROR');
    expect(s.runs[0].detail).toBe('judge_unavailable');
  });
});

describe('GET /api/targets', () => {
  const originalUseMock = process.env.USE_MOCK;
  afterEach(() => {
    if (originalUseMock === undefined) delete process.env.USE_MOCK;
    else process.env.USE_MOCK = originalUseMock;
  });

  it('returns the three allowlisted targets, the 12 tests and the mode', async () => {
    process.env.USE_MOCK = 'true';
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.targets.map((t: { id: string }) => t.id)).toEqual(['vulnerable-bot', 'hardened-bot', 'flaky-bot']);
    expect(json.tests).toHaveLength(12);
    expect(json.mode).toBe('mock');
  });

  it('reports live mode when USE_MOCK is not true', async () => {
    process.env.USE_MOCK = 'false';
    expect((await (await GET()).json()).mode).toBe('live');
  });

  it('never exposes keys or env values', async () => {
    process.env.GEMINI_API_KEY = 'FAKE_TEST_KEY_VALUE';
    try {
      const text = await (await GET()).text();
      expect(text).not.toContain('FAKE_TEST_KEY_VALUE');
    } finally {
      delete process.env.GEMINI_API_KEY;
    }
  });
});
