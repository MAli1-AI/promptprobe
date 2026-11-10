import React from 'react';
import type { TestSummary } from '../lib/types';
import {
  formatPercent,
  getCategoryLabel,
  getRunStatusBadgeProps,
  getSeverityBadgeProps,
  getVerdictBadgeProps,
} from '../lib/ui/helpers';

interface ResultsTableProps {
  summaries: TestSummary[];
}

export function ResultsTable({ summaries }: ResultsTableProps) {
  if (summaries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Scan Results ({summaries.length})
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Click any row’s details to inspect individual run evidence and responses.
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
            <tr>
              <th scope="col" className="px-4 py-3.5">
                Test
              </th>
              <th scope="col" className="px-3 py-3.5">
                Category
              </th>
              <th scope="col" className="px-3 py-3.5 text-center">
                Success Rate
              </th>
              <th scope="col" className="px-3 py-3.5 text-center">
                Flagged
              </th>
              <th scope="col" className="px-3 py-3.5 text-center">
                Clean
              </th>
              <th scope="col" className="px-3 py-3.5 text-center">
                Errors
              </th>
              <th scope="col" className="px-3 py-3.5 text-center">
                Verdict
              </th>
              <th scope="col" className="px-3 py-3.5 text-center">
                Severity
              </th>
              <th scope="col" className="px-4 py-3.5 min-w-[200px]">
                Explanation
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {summaries.map((summary) => {
              const verdictBadge = getVerdictBadgeProps(summary.verdict);
              const severityBadge = getSeverityBadgeProps(summary.severity);

              return (
                <React.Fragment key={summary.testId}>
                  <tr className="transition hover:bg-slate-50/75 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {summary.testId}
                          </span>
                          <span>{summary.title}</span>
                          {summary.aiJudged && (
                            <span className="inline-flex items-center rounded-sm bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
                              AI-judged
                            </span>
                          )}
                        </div>
                        {summary.clamped && (
                          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            runs clamped to 10
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {getCategoryLabel(summary.category)}
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatPercent(summary.successRate)}
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-red-600 dark:text-red-400 font-semibold">
                      {summary.flagged}
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-emerald-600 dark:text-emerald-400">
                      {summary.clean}
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-slate-500 dark:text-slate-400">
                      {summary.errors}
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold border ${verdictBadge.className}`}
                      >
                        <span aria-hidden="true">{verdictBadge.symbol}</span>
                        {verdictBadge.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium border ${severityBadge.className}`}
                      >
                        <span aria-hidden="true">{severityBadge.symbol}</span>
                        {severityBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      {summary.explanation}
                    </td>
                  </tr>

                  {/* Expandable Per-run Details */}
                  {summary.runs && summary.runs.length > 0 && (
                    <tr className="bg-slate-50/50 dark:bg-slate-800/20">
                      <td colSpan={9} className="px-4 py-2">
                        <details className="group">
                          <summary className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:underline dark:text-blue-400 dark:hover:text-blue-300">
                            <span className="inline-block transition-transform group-open:rotate-90">
                              ▶
                            </span>{' '}
                            View {summary.runs.length} run detail
                            {summary.runs.length > 1 ? 's' : ''} for {summary.testId}
                          </summary>
                          <div className="mt-3 space-y-3 pb-2 pt-1 pl-4">
                            {summary.runs.map((run) => {
                              const statusBadge = getRunStatusBadgeProps(run.status);
                              return (
                                <div
                                  key={run.index}
                                  className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-2xs dark:border-slate-700/80 dark:bg-slate-800/80"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-700">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        Run #{run.index}
                                      </span>
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold border ${statusBadge.className}`}
                                      >
                                        <span aria-hidden="true">{statusBadge.symbol}</span>
                                        {statusBadge.label}
                                      </span>
                                      {run.errorKind && (
                                        <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] font-mono text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                          errorKind: {run.errorKind}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                                      {run.durationMs !== undefined && (
                                        <span>Duration: {run.durationMs}ms</span>
                                      )}
                                    </div>
                                  </div>

                                  {run.detail && (
                                    <div className="mt-2 text-slate-700 dark:text-slate-300">
                                      <strong>Detail:</strong> {run.detail}
                                    </div>
                                  )}

                                  {run.evidence && (
                                    <div className="mt-2 text-red-700 dark:text-red-300">
                                      <strong>Evidence:</strong> {run.evidence}
                                    </div>
                                  )}

                                  {run.responseExcerpt && (
                                    <div className="mt-2">
                                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                                        Response excerpt:
                                      </span>
                                      <pre className="mt-1 max-h-36 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] whitespace-pre-wrap break-words text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                        {run.responseExcerpt}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
