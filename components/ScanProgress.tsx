'use client';

import React from 'react';
import { formatProgress } from '../lib/ui/helpers';

interface ScanProgressProps {
  current: number;
  total: number;
  isScanning: boolean;
  activeTestTitle?: string;
}

export function ScanProgress({
  current,
  total,
  isScanning,
  activeTestTitle,
}: ScanProgressProps) {
  if (total === 0 && !isScanning) {
    return null;
  }

  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const progressText = formatProgress(current, total);

  return (
    <div
      role="region"
      aria-label="Scan progress"
      className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 shadow-sm flex flex-col gap-2.5"
    >
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {isScanning && (
            <span
              className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"
              aria-hidden="true"
            />
          )}
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {isScanning ? 'Scan in progress:' : current >= total && total > 0 ? 'Scan completed:' : 'Status:'}
          </span>
          <span
            className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900"
            data-testid="progress-text"
          >
            {progressText}
          </span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
          {percent}%
        </span>
      </div>

      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
        <div
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Scan completion progress"
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {isScanning && activeTestTitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          Running: <span className="font-medium text-gray-700 dark:text-gray-300">{activeTestTitle}</span>
        </p>
      )}
    </div>
  );
}
