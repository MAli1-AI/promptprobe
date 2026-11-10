import { describe, it, expect, afterEach } from 'vitest';
import { runTest, MAX_CONCURRENCY, EXCERPT_MAX_CHARS } from './runner';
import type { JudgeFn } from './runner';
import { TEST_CASES, getTestCase } from '../testlib/cases';
import { mockVulnerableTarget, mockHardenedTarget } from '../targets/mock';
import { flakyTarget } from '../targets/flaky';
import { CANARY_SECRET } from '../canaries';
import type { ChatTarget, TargetReply, TestCase } from '../types';

function tc(id: string): TestCase {
  const found = getTestCase(id);
  if (!found) throw new Error(`missing test case ${id}`);
  return found;
}

function fixedTarget(reply: TargetReply | ((i: number) => TargetReply)): ChatTarget {
  return {
    id: 'fixed',
    async ask(_p, ctx) {
      return typeof reply === 'function' ? reply(ctx.runIndex) : reply;
    },
  };
}

describe('runTest (lib/engine/runner.ts)', () => {
  const originalUseMock = process.env.USE_MOCK;
  afterEach(() => {
    if (originalUseMock === undefined) delete process.env.USE_MOCK;
    else process.env.USE_MOCK = originalUseMock;
  });

  it('counts add up: flagged + clean + errors === runs.length', async () => {
    const s = await runTest(flakyTarget, tc('LK-1'), 5);
    expect(s.runs).toHaveLength(5);
    expect(s.flagged + s.clean + s.errors).toBe(5);
    expect(s.runs.map((r) => r.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('excludes errors from the success rate', async () => {
    // 4 flagged, 1 clean, plus 5 errors out of 10 runs
    const target = fixedTarget((i) =>
      i < 4
        ? { status: 'ok', text: `leak ${CANARY_SECRET}` }
        : i === 4
          ? { status: 'ok', text: 'nothing here' }
          : { status: 'error', detail: 'boom' }
    );
    const s = await runTest(target, tc('LK-1'), 10);
    expect(s.flagged).toBe(4);
    expect(s.clean).toBe(1);
    expect(s.errors).toBe(5);
    expect(s.successRate).toBeCloseTo(0.8);
    expect(s.verdict).toBe('FAIL');
    expect(s.severity).toBe('Critical');
    expect(s.explanation).toContain('5 error run(s) excluded');
  });

  it('detects the leak on the vulnerable mock (LK-1)', async () => {
    const s = await runTest(mockVulnerableTarget, tc('LK-1'), 5, { mode: 'mock' });
    expect(s.flagged).toBeGreaterThan(0);
    expect(s.verdict).toBe('FAIL');
    expect(s.runs.find((r) => r.status === 'flagged')?.evidence).toBe(CANARY_SECRET);
    expect(s.mode).toBe('mock');
  });

  it('detects the override marker on the vulnerable mock (OV-1)', async () => {
    const s = await runTest(mockVulnerableTarget, tc('OV-1'), 5);
    expect(s.flagged).toBeGreaterThan(0);
    expect(s.verdict).toBe('FAIL');
  });

  it('reports 100% leak rate as Critical (regression: rate of exactly 1 is 100%, not 1%)', async () => {
    const s = await runTest(fixedTarget({ status: 'ok', text: CANARY_SECRET }), tc('LK-2'), 3);
    expect(s.successRate).toBe(1);
    expect(s.severity).toBe('Critical');
  });

  it('keeps the hardened mock clean over 20 runs on every non-policy case', async () => {
    const nonPolicy = TEST_CASES.filter((c) => c.category !== 'policy_violation');
    expect(nonPolicy.length).toBeGreaterThan(0);
    for (const testCase of nonPolicy) {
      let flagged = 0;
      let clean = 0;
      // runs are clamped to 10, so 2 x 10 = 20 runs
      for (let batch = 0; batch < 2; batch++) {
        const s = await runTest(mockHardenedTarget, testCase, 10);
        flagged += s.flagged;
        clean += s.clean;
      }
      expect(flagged, `${testCase.id} flagged`).toBe(0);
      expect(clean, `${testCase.id} clean`).toBe(20);
    }
  });

  it('keeps benign controls clean on the vulnerable mock', async () => {
    for (const id of ['BC-1', 'BC-2', 'BC-3']) {
      const s = await runTest(mockVulnerableTarget, tc(id), 3);
      expect(s.flagged, id).toBe(0);
      expect(s.verdict, id).toBe('PASS');
      expect(s.severity, id).toBe('None');
    }
  });

  it('handles the flaky bot: timeout, error and malformed become error runs with kind and detail', async () => {
    const s = await runTest(flakyTarget, tc('LK-1'), 5);
    expect(s.errors).toBe(3);
    expect(s.clean).toBe(2);
    const byIndex = (i: number) => s.runs[i];
    expect(byIndex(1).status).toBe('error');
    expect(byIndex(1).errorKind).toBe('timeout');
    expect(byIndex(2).errorKind).toBe('error');
    expect(byIndex(2).detail).toContain('simulated upstream error');
    expect(byIndex(3).errorKind).toBe('malformed');
    expect(byIndex(3).detail).toContain('malformed');
    expect(s.verdict).toBe('PASS');
  });

  it('returns verdict ERROR and null rate when every run errors', async () => {
    const s = await runTest(fixedTarget({ status: 'timeout' }), tc('LK-1'), 3);
    expect(s.errors).toBe(3);
    expect(s.successRate).toBeNull();
    expect(s.verdict).toBe('ERROR');
    expect(s.severity).toBe('None');
  });

  describe('budget', () => {
    it('turns runs beyond maxCalls into budget_exhausted error runs', async () => {
      const s = await runTest(mockVulnerableTarget, tc('LK-1'), 5, { maxCalls: 2 });
      expect(s.runs).toHaveLength(5);
      const exhausted = s.runs.filter((r) => r.detail === 'budget_exhausted');
      expect(exhausted).toHaveLength(3);
      expect(exhausted.every((r) => r.status === 'error')).toBe(true);
      expect(s.runs[0].status).not.toBe('error');
      expect(s.runs[1].status).not.toBe('error');
    });

    it('never calls the target more than maxCalls times', async () => {
      let calls = 0;
      const target: ChatTarget = {
        id: 't',
        async ask() {
          calls += 1;
          return { status: 'ok', text: 'hi' };
        },
      };
      await runTest(target, tc('LK-1'), 10, { maxCalls: 4 });
      expect(calls).toBe(4);
    });

    it('with maxCalls 0 every run is budget_exhausted and the target is never called', async () => {
      let calls = 0;
      const target: ChatTarget = {
        id: 't',
        async ask() {
          calls += 1;
          return { status: 'ok', text: 'hi' };
        },
      };
      const s = await runTest(target, tc('LK-1'), 3, { maxCalls: 0 });
      expect(calls).toBe(0);
      expect(s.errors).toBe(3);
      expect(s.verdict).toBe('ERROR');
    });

    it('reads the default budget from MAX_CALLS_PER_SCAN', async () => {
      const original = process.env.MAX_CALLS_PER_SCAN;
      process.env.MAX_CALLS_PER_SCAN = '2';
      try {
        const s = await runTest(mockVulnerableTarget, tc('LK-1'), 5);
        expect(s.runs.filter((r) => r.detail === 'budget_exhausted')).toHaveLength(3);
      } finally {
        if (original === undefined) delete process.env.MAX_CALLS_PER_SCAN;
        else process.env.MAX_CALLS_PER_SCAN = original;
      }
    });

    it('counts judge calls against the budget', async () => {
      const judge: JudgeFn = async () => ({ violated: false, reason: 'ok' });
      // budget 3: run0 reserves ask+judge (2); run1 needs 2 but only 1 is left; run2 likewise
      const s = await runTest(mockVulnerableTarget, tc('PV-1'), 3, { maxCalls: 3, judge });
      expect(s.runs[0].status).toBe('clean');
      expect(s.runs[1].detail).toBe('budget_exhausted');
      expect(s.runs[2].detail).toBe('budget_exhausted');
    });

    it('does not call the target for a judged run whose judge call cannot be afforded', async () => {
      let asks = 0;
      const target: ChatTarget = {
        id: 't',
        async ask() {
          asks += 1;
          return { status: 'ok', text: 'hi' };
        },
      };
      const judge: JudgeFn = async () => ({ violated: false, reason: '' });
      await runTest(target, tc('PV-1'), 3, { maxCalls: 3, judge });
      expect(asks).toBe(1);
    });
  });

  describe('concurrency and clamping', () => {
    it('never has more than 3 target calls in flight, and does use 3', async () => {
      let inFlight = 0;
      let peak = 0;
      const target: ChatTarget = {
        id: 't',
        async ask() {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await new Promise((r) => setTimeout(r, 10));
          inFlight -= 1;
          return { status: 'ok', text: 'hi' };
        },
      };
      await runTest(target, tc('BC-1'), 10);
      expect(MAX_CONCURRENCY).toBe(3);
      expect(peak).toBe(3);
    });

    it('clamps runs above 10 and sets clamped', async () => {
      const s = await runTest(fixedTarget({ status: 'ok', text: 'hi' }), tc('BC-1'), 50);
      expect(s.runs).toHaveLength(10);
      expect(s.clamped).toBe(true);
      expect(s.runsRequested).toBe(50);
    });

    it('clamps runs below 1 (0 and negative) up to 1', async () => {
      for (const n of [0, -5]) {
        const s = await runTest(fixedTarget({ status: 'ok', text: 'hi' }), tc('BC-1'), n);
        expect(s.runs).toHaveLength(1);
        expect(s.clamped).toBe(true);
      }
    });

    it('treats NaN and Infinity as 1 run and clamped, without throwing', async () => {
      for (const n of [NaN, Infinity, -Infinity]) {
        const s = await runTest(fixedTarget({ status: 'ok', text: 'hi' }), tc('BC-1'), n);
        expect(s.runs).toHaveLength(1);
        expect(s.clamped).toBe(true);
      }
    });

    it('does not set clamped for in-range runs', async () => {
      const s = await runTest(fixedTarget({ status: 'ok', text: 'hi' }), tc('BC-1'), 3);
      expect(s.clamped).toBe(false);
      expect(s.runsRequested).toBe(3);
      expect(s.runs).toHaveLength(3);
    });
  });

  describe('robustness', () => {
    it('turns a throwing target into error runs and never throws', async () => {
      const target: ChatTarget = {
        id: 'bad',
        async ask() {
          throw new Error(`secret detail ${CANARY_SECRET}`);
        },
      };
      const s = await runTest(target, tc('LK-1'), 3);
      expect(s.errors).toBe(3);
      expect(s.runs.every((r) => r.detail === 'unexpected_error')).toBe(true);
      // exception text must not leak into the summary
      expect(JSON.stringify(s)).not.toContain(CANARY_SECRET);
    });

    it('survives a target returning garbage instead of a TargetReply', async () => {
      const target = {
        id: 'garbage',
        async ask() {
          return { status: 'ok', text: 42 } as unknown as TargetReply;
        },
      } as ChatTarget;
      const s = await runTest(target, tc('LK-1'), 2);
      expect(s.errors).toBe(2);
      expect(s.runs[0].errorKind).toBe('malformed');
    });

    it('truncates responseExcerpt to 300 chars', async () => {
      const s = await runTest(
        fixedTarget({ status: 'ok', text: 'x'.repeat(5000) }),
        tc('BC-1'),
        1
      );
      expect(s.runs[0].responseExcerpt).toHaveLength(EXCERPT_MAX_CHARS);
    });

    it('records durationMs and aiJudged on every run', async () => {
      const s = await runTest(flakyTarget, tc('LK-1'), 5);
      for (const r of s.runs) {
        expect(typeof r.durationMs).toBe('number');
        expect(r.durationMs).toBeGreaterThanOrEqual(0);
        expect(r.aiJudged).toBe(false);
      }
    });
  });

  describe('policy_violation and the AI judge', () => {
    it('without a judge, every run is an error run with detail judge_unavailable', async () => {
      const s = await runTest(mockVulnerableTarget, tc('PV-1'), 3);
      expect(s.errors).toBe(3);
      expect(s.runs.every((r) => r.detail === 'judge_unavailable')).toBe(true);
      expect(s.verdict).toBe('ERROR');
      expect(s.aiJudged).toBe(true);
      expect(s.runs.every((r) => r.aiJudged)).toBe(true);
    });

    it('uses an injected judge: violated -> flagged with reason as evidence', async () => {
      const judge: JudgeFn = async () => ({ violated: true, reason: 'promised refund' });
      const s = await runTest(mockVulnerableTarget, tc('PV-1'), 2, { judge });
      expect(s.flagged).toBe(2);
      expect(s.runs[0].evidence).toBe('promised refund');
      expect(s.runs[0].aiJudged).toBe(true);
      expect(s.severity).toBe('Medium');
    });

    it('judge says not violated -> clean', async () => {
      const judge: JudgeFn = async () => ({ violated: false, reason: 'refused' });
      const s = await runTest(mockHardenedTarget, tc('PV-1'), 2, { judge });
      expect(s.clean).toBe(2);
      expect(s.verdict).toBe('PASS');
    });

    it('a throwing judge becomes an error run, never a pass or fail', async () => {
      const judge: JudgeFn = async () => {
        throw new Error('judge down');
      };
      const s = await runTest(mockVulnerableTarget, tc('PV-2'), 2, { judge });
      expect(s.errors).toBe(2);
      expect(s.runs[0].detail).toBe('judge_failed');
      expect(s.flagged + s.clean).toBe(0);
    });

    it('a malformed judge verdict becomes an error run', async () => {
      const judge = (async () => ({ nope: true })) as unknown as JudgeFn;
      const s = await runTest(mockVulnerableTarget, tc('PV-1'), 1, { judge });
      expect(s.errors).toBe(1);
      expect(s.runs[0].errorKind).toBe('malformed');
    });

    it('does not call the judge when the target itself errored', async () => {
      let judged = 0;
      const judge: JudgeFn = async () => {
        judged += 1;
        return { violated: false, reason: '' };
      };
      await runTest(fixedTarget({ status: 'timeout' }), tc('PV-1'), 2, { judge });
      expect(judged).toBe(0);
    });
  });

  describe('summary metadata', () => {
    it('fills identity, mitigation and fixed fields', async () => {
      const s = await runTest(mockVulnerableTarget, tc('LK-1'), 2);
      expect(s.targetId).toBe('vulnerable-bot');
      expect(s.testId).toBe('LK-1');
      expect(s.category).toBe('secret_leak');
      expect(s.title).toBe(tc('LK-1').title);
      expect(s.mitigation).toContain('do not place secrets in prompts');
      expect(s.explanation.length).toBeGreaterThan(0);
    });

    it('derives mode from USE_MOCK unless overridden', async () => {
      process.env.USE_MOCK = 'true';
      expect((await runTest(fixedTarget({ status: 'ok', text: 'hi' }), tc('BC-1'), 1)).mode).toBe('mock');
      process.env.USE_MOCK = 'false';
      expect((await runTest(fixedTarget({ status: 'ok', text: 'hi' }), tc('BC-1'), 1)).mode).toBe('live');
      expect(
        (await runTest(fixedTarget({ status: 'ok', text: 'hi' }), tc('BC-1'), 1, { mode: 'mock' })).mode
      ).toBe('mock');
    });
  });
});
