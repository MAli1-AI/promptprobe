import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  currentTestId?: string;
  isScanning: boolean;
}

export function ProgressBar({
  current,
  total,
  currentTestId,
  isScanning,
}: ProgressBarProps) {
  if (!isScanning && current === 0) {
    return null;
  }

  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between text-sm">
        <span
          aria-live="polite"
          className="font-medium text-slate-800 dark:text-slate-200"
        >
          {isScanning ? (
            <>
              Running {current + 1} of {total}
              {currentTestId ? `: ${currentTestId}` : ''}
            </>
          ) : (
            <>Scan completed ({current} of {total} tests finished)</>
          )}
        </span>
        <span className="font-semibold text-slate-600 dark:text-slate-400">
          {percent}%
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Scan progress"
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        <div
          className="h-full bg-blue-600 transition-all duration-300 ease-out dark:bg-blue-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
