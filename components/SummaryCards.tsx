import React from 'react';
import type { Mode, TestSummary } from '../lib/types';
import { buildReport } from '../lib/report/buildReport';
import { getSeverityBadgeProps } from '../lib/ui/helpers';

interface SummaryCardsProps {
  summaries: TestSummary[];
  mode: Mode;
  targetId: string;
  runsPerTest: number;
}

export function SummaryCards({
  summaries,
  mode,
  targetId,
  runsPerTest,
}: SummaryCardsProps) {
  if (summaries.length === 0) {
    return null;
  }

  // Compute using buildReport so the UI and downloadable reports always strictly agree
  const report = buildReport(summaries, {
    generatedAt: new Date().toISOString(),
    mode,
    targetId,
    runsPerTest,
  });

  const { totals, overallSeverity } = report;
  const severityBadge = getSeverityBadgeProps(overallSeverity);

  const cards = [
    {
      label: 'Tests Scanned',
      value: totals.tests,
      symbol: '#',
      color: 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'Total Runs',
      value: totals.runs,
      symbol: 'Σ',
      color: 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'Flagged (Vulnerable)',
      value: totals.flagged,
      symbol: '✗',
      color: totals.flagged > 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'Clean',
      value: totals.clean,
      symbol: '✓',
      color: 'text-emerald-600 dark:text-emerald-400 font-semibold',
    },
    {
      label: 'Errors',
      value: totals.errors,
      symbol: '⚠',
      color: totals.errors > 0 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'Overall Severity',
      custom: (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold border ${severityBadge.className}`}
        >
          <span aria-hidden="true">{severityBadge.symbol}</span>
          {severityBadge.label}
        </span>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {card.label}
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            {card.custom ? (
              card.custom
            ) : (
              <>
                <span className={`text-2xl font-bold ${card.color}`}>
                  {card.value}
                </span>
                <span className="text-xs text-slate-400" aria-hidden="true">
                  {card.symbol}
                </span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
