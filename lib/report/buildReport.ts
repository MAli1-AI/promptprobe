import type { Category, Mode, ScanReport, Severity, TestSummary } from '../types';
import {
  computeOverallSeverity,
  computeSuccessRate,
  getMitigation,
  SEVERITY_RUBRIC,
} from '../engine/scoring';

export interface ReportMeta {
  generatedAt: string; // ISO timestamp, passed in so buildReport stays pure
  mode: Mode;
  targetId: string;
  runsPerTest: number;
}

const CATEGORY_ORDER: Category[] = [
  'instruction_override',
  'secret_leak',
  'policy_violation',
  'benign_control',
];

const CATEGORY_LABEL: Record<Category, string> = {
  instruction_override: 'Instruction override',
  secret_leak: 'Secret leak',
  policy_violation: 'Policy violation',
  benign_control: 'Benign control',
};

/** Pure: raw results -> ScanReport. Totals are sums over the raw runs, never over summary counters. */
export function buildReport(summaries: TestSummary[], meta: ReportMeta): ScanReport {
  const totals = { tests: summaries.length, runs: 0, flagged: 0, clean: 0, errors: 0 };
  const perCategory = new Map<
    Category,
    { tests: number; flagged: number; clean: number; errors: number; severities: Severity[] }
  >();

  for (const s of summaries) {
    const bucket = perCategory.get(s.category) ?? {
      tests: 0, flagged: 0, clean: 0, errors: 0, severities: [],
    };
    bucket.tests += 1;
    bucket.severities.push(s.severity);

    for (const r of s.runs) {
      totals.runs += 1;
      if (r.status === 'flagged') { totals.flagged += 1; bucket.flagged += 1; }
      else if (r.status === 'clean') { totals.clean += 1; bucket.clean += 1; }
      else { totals.errors += 1; bucket.errors += 1; }
    }
    perCategory.set(s.category, bucket);
  }

  const byCategory = CATEGORY_ORDER.filter((c) => perCategory.has(c)).map((category) => {
    const b = perCategory.get(category)!;
    return {
      category,
      tests: b.tests,
      flagged: b.flagged,
      clean: b.clean,
      errors: b.errors,
      successRate: computeSuccessRate(b.flagged, b.clean),
      worstSeverity: computeOverallSeverity(b.severities),
    };
  });

  return {
    generatedAt: meta.generatedAt,
    mode: meta.mode,
    targetId: meta.targetId,
    runsPerTest: meta.runsPerTest,
    totals,
    byCategory,
    overallSeverity: computeOverallSeverity(summaries.map((s) => s.severity)),
    summaries: [...summaries],
  };
}

/** Escape text for a Markdown table cell. */
function cell(value: string | number | null): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function pct(rate: number | null): string {
  return rate === null ? 'n/a' : `${Math.round(rate * 100)}%`;
}

function resultsTable(rows: TestSummary[]): string[] {
  if (rows.length === 0) return ['_No results in this section._', ''];
  const lines = [
    '| Test | Category | Success rate | Flagged / Clean / Error | Verdict | Severity | Explanation |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const s of rows) {
    lines.push(
      `| ${cell(s.testId)} ${cell(s.title)} | ${cell(CATEGORY_LABEL[s.category])} | ${pct(s.successRate)} | ` +
        `${s.flagged} / ${s.clean} / ${s.errors} | ${cell(s.verdict)} | ${cell(s.severity)} | ${cell(s.explanation)} |`
    );
  }
  lines.push('');
  return lines;
}

/**
 * Readable Markdown report built only from the ScanReport (same data as the JSON download).
 * Model-written text (response excerpts, judge reasons) is deliberately left out so a bot
 * reply can never inject Markdown or links into the report.
 */
export function toMarkdown(report: ScanReport): string {
  const { totals } = report;
  const deterministic = report.summaries.filter((s) => !s.aiJudged);
  const aiJudged = report.summaries.filter((s) => s.aiJudged);
  const out: string[] = [];

  out.push('# PromptProbe scan report', '');
  out.push(`- Target: \`${cell(report.targetId)}\``);
  out.push(`- Mode: ${report.mode === 'mock' ? 'MOCK (deterministic simulated bots, not a live model)' : 'live'}`);
  out.push(`- Generated: ${cell(report.generatedAt)}`);
  out.push(`- Runs per test: ${report.runsPerTest}`);
  out.push(`- Overall severity: **${report.overallSeverity}**`, '');

  out.push('## Totals', '');
  out.push('| Tests | Runs | Flagged | Clean | Errors |', '| --- | --- | --- | --- | --- |');
  out.push(`| ${totals.tests} | ${totals.runs} | ${totals.flagged} | ${totals.clean} | ${totals.errors} |`, '');
  out.push('Success rate = flagged / (flagged + clean). Error runs are excluded from every rate.', '');

  out.push('## By category', '');
  if (report.byCategory.length === 0) {
    out.push('_No results._', '');
  } else {
    out.push(
      '| Category | Tests | Flagged | Clean | Errors | Success rate | Worst severity |',
      '| --- | --- | --- | --- | --- | --- | --- |'
    );
    for (const c of report.byCategory) {
      out.push(
        `| ${CATEGORY_LABEL[c.category]} | ${c.tests} | ${c.flagged} | ${c.clean} | ${c.errors} | ${pct(c.successRate)} | ${c.worstSeverity} |`
      );
    }
    out.push('');
  }

  out.push('## Deterministic results', '', 'Decided by deterministic detector code (no AI involved).', '');
  out.push(...resultsTable(deterministic));

  out.push('## AI-judged results', '', 'Decided by an AI judge. Treat as advisory: judge output can be wrong.', '');
  out.push(...resultsTable(aiJudged));

  out.push('## Recommended mitigations', '');
  if (report.byCategory.length === 0) {
    out.push('_None._', '');
  } else {
    for (const c of report.byCategory) {
      out.push(`- **${CATEGORY_LABEL[c.category]}:** ${getMitigation(c.category)}`);
    }
    out.push('');
  }

  out.push('## Severity rubric', '');
  out.push('| Category | 0% | 1-24% | 25-59% | 60-100% |', '| --- | --- | --- | --- | --- |');
  for (const c of CATEGORY_ORDER) {
    const r = SEVERITY_RUBRIC[c];
    out.push(`| ${CATEGORY_LABEL[c]} | ${r['0%']} | ${r['1-24%']} | ${r['25-59%']} | ${r['60-100%']} |`);
  }
  out.push('', '_Benign controls never carry a severity: a flag there means a detector issue._', '');

  return out.join('\n');
}
