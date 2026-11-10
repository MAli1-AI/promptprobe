'use client';

import React from 'react';
import { TestSummary } from '../lib/types';
import {
  formatCategory,
  formatSuccessRate,
  getVerdictBadgeClasses,
} from '../lib/ui/helpers';

interface ResultsTableProps {
  results: TestSummary[];
  isScanning?: boolean;
}

export function ResultsTable({ results, isScanning = false }: ResultsTableProps) {
  if (results.length === 0) {
    return (
      <div className="w-full text-center py-12 px-4 border border-dashed border-gray-300 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-900/30">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          No scan results yet.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          Select a target and click &ldquo;Run scan&rdquo; above to execute the security test suite.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm bg-white dark:bg-gray-900">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/80">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Scan Results ({results.length} {results.length === 1 ? 'test' : 'tests'})
        </h2>
        {isScanning && (
          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium animate-pulse">
            Updating live...
          </span>
        )}
      </div>

      <div
        className="overflow-x-auto focus:outline-none focus:ring-1 focus:ring-blue-500"
        tabIndex={0}
        aria-label="Security scan results table"
      >
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-sm">
          <thead className="bg-gray-50/80 dark:bg-gray-800/50 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            <tr>
              <th scope="col" className="px-4 py-3">
                Test ID
              </th>
              <th scope="col" className="px-4 py-3">
                Category
              </th>
              <th scope="col" className="px-4 py-3 text-center">
                Success Rate
              </th>
              <th scope="col" className="px-4 py-3 text-center">
                Flagged
              </th>
              <th scope="col" className="px-4 py-3 text-center">
                Clean
              </th>
              <th scope="col" className="px-4 py-3 text-center">
                Error
              </th>
              <th scope="col" className="px-4 py-3 text-center">
                Verdict
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
            {results.map((r) => (
              <tr
                key={r.testId}
                className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors focus-within:bg-blue-50/30 dark:focus-within:bg-blue-950/20"
              >
                <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  <div>
                    <span>{r.testId}</span>
                    {r.aiJudged && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        AI Judge
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-normal text-gray-500 dark:text-gray-400 font-sans truncate max-w-xs">
                    {r.title}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                  {formatCategory(r.category)}
                </td>
                <td className="px-4 py-3 text-center font-mono font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {formatSuccessRate(r.successRate)}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <span
                    className={
                      r.flagged > 0
                        ? 'font-bold text-rose-600 dark:text-rose-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }
                  >
                    {r.flagged}
                  </span>
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <span
                    className={
                      r.clean > 0
                        ? 'font-medium text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }
                  >
                    {r.clean}
                  </span>
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <span
                    className={
                      r.errors > 0
                        ? 'font-bold text-amber-600 dark:text-amber-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }
                  >
                    {r.errors}
                  </span>
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getVerdictBadgeClasses(
                      r.verdict
                    )}`}
                  >
                    {r.verdict}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
