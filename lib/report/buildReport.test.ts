import { describe, it, expect } from 'vitest';
import { buildReport, toMarkdown } from './buildReport';
import type { ReportMeta } from './buildReport';
import { runTest } from '../engine/runner';
import { TEST_CASES } from '../testlib/cases';
import { mockVulnerableTarget, mockHardenedTarget } from '../targets/mock';
import { flakyTarget } from '../targets/flaky';
import type { TestSummary } from '../types';

const META: ReportMeta = {
  generatedAt: '2026-11-10T09:00:00.000Z',
  mode: 'mock',
  targetId: 'vulnerable-bot',
  runsPerTest: 5,
};

async function fullScan(target = mockVulnerableTarget, runs = 5): Promise<TestSummary[]> {
  const out: TestSummary[] = [];
  for (const tc of TEST_CASES) out.push(await runTest(target, tc, runs));
  return out;
}

describe('buildReport', () => {
  it('totals equal the sums over the raw runs, including runs with errors', async () => {
    const summaries = [...(await fullScan()), ...(await fullScan(flakyTarget as never, 5))];
    const report = buildReport(summaries, META);
    const raw = summaries.flatMap((s) => s.runs);
    expect(report.totals.tests).toBe(summaries.length);
    expect(report.totals.runs).toBe(raw.length);
    expect(report.totals.flagged).toBe(raw.filter((r) => r.status === 'flagged').length);
    expect(report.totals.clean).toBe(raw.filter((r) => r.status === 'clean').length);
    expect(report.totals.errors).toBe(raw.filter((r) => r.status === 'error').length);
    expect(report.totals.errors).toBeGreaterThan(0);
    expect(report.totals.flagged + report.totals.clean + report.totals.errors).toBe(report.totals.runs);
  });

  it('uses raw runs, not summary counters, if they disagree', async () => {
    const [s] = await fullScan();
    const tampered = { ...s, flagged: 999, clean: 999, errors: 999 };
    const report = buildReport([tampered], META);
    expect(report.totals.runs).toBe(s.runs.length);
    expect(report.totals.flagged).not.toBe(999);
  });

  it('category success rates exclude errors and worst severity comes from the rubric', async () => {
    const report = buildReport(await fullScan(), META);
    const leak = report.byCategory.find((c) => c.category === 'secret_leak')!;
    expect(leak.tests).toBe(4);
    expect(leak.successRate).toBeCloseTo(leak.flagged / (leak.flagged + leak.clean));
    expect(leak.worstSeverity).toBe('Critical');
    const benign = report.byCategory.find((c) => c.category === 'benign_control')!;
    expect(benign.flagged).toBe(0);
    expect(benign.worstSeverity).toBe('None');
  });

  it('a category with only error runs has a null success rate', async () => {
    const report = buildReport(await fullScan(flakyTarget as never, 1), META);
    // runIndex 0 of the flaky bot is an ok reply, so use the policy category (judge_unavailable errors)
    const pv = report.byCategory.find((c) => c.category === 'policy_violation')!;
    expect(pv.flagged + pv.clean).toBe(0);
    expect(pv.successRate).toBeNull();
  });

  it('overall severity is the worst across tests; hardened mock is None', async () => {
    expect(buildReport(await fullScan(), META).overallSeverity).toBe('Critical');
    const hardened = buildReport(await fullScan(mockHardenedTarget), { ...META, targetId: 'hardened-bot' });
    expect(hardened.overallSeverity).toBe('None');
  });

  it('copies meta and keeps summaries in input order', async () => {
    const summaries = await fullScan();
    const report = buildReport(summaries, META);
    expect(report).toMatchObject(META);
    expect(report.summaries.map((s) => s.testId)).toEqual(summaries.map((s) => s.testId));
  });

  it('is pure: does not mutate its input and is deterministic', async () => {
    const summaries = await fullScan();
    const before = JSON.stringify(summaries);
    const a = buildReport(summaries, META);
    const b = buildReport(summaries, META);
    expect(JSON.stringify(summaries)).toBe(before);
    expect(a).toEqual(b);
  });

  it('handles empty input', () => {
    const report = buildReport([], META);
    expect(report.totals).toEqual({ tests: 0, runs: 0, flagged: 0, clean: 0, errors: 0 });
    expect(report.byCategory).toEqual([]);
    expect(report.overallSeverity).toBe('None');
    expect(report.summaries).toEqual([]);
    expect(() => toMarkdown(report)).not.toThrow();
    expect(toMarkdown(report)).toContain('_No results._');
  });
});

describe('toMarkdown', () => {
  it('keeps AI-judged results in their own labeled section', async () => {
    const md = toMarkdown(buildReport(await fullScan(), META));
    const detIdx = md.indexOf('## Deterministic results');
    const aiIdx = md.indexOf('## AI-judged results');
    const mitIdx = md.indexOf('## Recommended mitigations');
    expect(detIdx).toBeGreaterThan(-1);
    expect(aiIdx).toBeGreaterThan(detIdx);
    const det = md.slice(detIdx, aiIdx);
    const ai = md.slice(aiIdx, mitIdx);
    expect(ai).toContain('PV-1');
    expect(ai).toContain('PV-2');
    expect(ai).not.toContain('LK-1');
    expect(det).toContain('LK-1');
    expect(det).not.toContain('PV-1');
  });

  it('JSON and Markdown totals agree', async () => {
    const report = buildReport(await fullScan(), META);
    const md = toMarkdown(report);
    const { tests, runs, flagged, clean, errors } = report.totals;
    expect(md).toContain(`| ${tests} | ${runs} | ${flagged} | ${clean} | ${errors} |`);
    expect(md).toContain(`Overall severity: **${report.overallSeverity}**`);
  });

  it('includes mitigations per category present and the rubric reference', async () => {
    const md = toMarkdown(buildReport(await fullScan(), META));
    expect(md).toContain('do not place secrets in prompts');
    expect(md).toContain('treat user text as data');
    expect(md).toContain('## Severity rubric');
    expect(md).toContain('| Secret leak | None | Medium | High | Critical |');
  });

  it('flags mock mode clearly', async () => {
    expect(toMarkdown(buildReport([], META))).toContain('MOCK');
    expect(toMarkdown(buildReport([], { ...META, mode: 'live' }))).not.toContain('MOCK');
  });

  it('never includes model-written text and escapes table cells', async () => {
    const summaries = await fullScan();
    summaries[0] = {
      ...summaries[0],
      title: 'a | b\nc',
      explanation: 'x | y',
      runs: summaries[0].runs.map((r) => ({ ...r, responseExcerpt: '[evil](http://evil.example)', evidence: '<script>' })),
    };
    const md = toMarkdown(buildReport(summaries, META));
    expect(md).not.toContain('evil.example');
    expect(md).not.toContain('<script>');
    expect(md).toContain('a \\| b c');
    expect(md).toContain('x \\| y');
  });
});
