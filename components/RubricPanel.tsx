import React from 'react';
import type { Category } from '../lib/types';
import { FIXED_MITIGATIONS, SEVERITY_RUBRIC } from '../lib/engine/scoring';
import { getCategoryLabel, getSeverityBadgeProps } from '../lib/ui/helpers';

const CATEGORIES: Category[] = [
  'secret_leak',
  'instruction_override',
  'policy_violation',
  'benign_control',
];

const BANDS = ['0%', '1-24%', '25-59%', '60-100%'] as const;

export function RubricPanel() {
  return (
    <section
      aria-labelledby="rubric-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-4">
        <h2
          id="rubric-heading"
          className="text-lg font-bold text-slate-900 dark:text-slate-100"
        >
          Security Scoring Rubric & Mitigations
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Success rate = flagged / (flagged + clean); errors are excluded.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
            <tr>
              <th scope="col" className="px-4 py-2.5">
                Category
              </th>
              {BANDS.map((band) => (
                <th key={band} scope="col" className="px-3 py-2.5 text-center">
                  {band}
                </th>
              ))}
              <th scope="col" className="px-4 py-2.5 min-w-[260px]">
                Recommended Mitigation
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {CATEGORIES.map((cat) => {
              const rubricRow = SEVERITY_RUBRIC[cat];
              const mitigation = FIXED_MITIGATIONS[cat];

              return (
                <tr key={cat} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {getCategoryLabel(cat)}
                  </td>
                  {BANDS.map((band) => {
                    const severity = rubricRow[band];
                    const badge = getSeverityBadgeProps(severity);

                    return (
                      <td key={band} className="px-3 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-medium border ${badge.className}`}
                        >
                          <span aria-hidden="true">{badge.symbol}</span>
                          {badge.label}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    <p className="leading-relaxed">{mitigation}</p>
                    {rubricRow.note && (
                      <p className="mt-1 text-[11px] italic text-slate-400">
                        Note: {rubricRow.note}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
