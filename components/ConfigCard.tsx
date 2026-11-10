import React, { useState } from 'react';
import type { Target } from '../lib/types';
import { validateRuns } from '../lib/ui/helpers';

interface ConfigCardProps {
  targets: Target[];
  selectedTargetId: string;
  onTargetChange: (targetId: string) => void;
  runs: number;
  onRunsChange: (runs: number) => void;
  onRunScan: () => void;
  isScanning: boolean;
}

export function ConfigCard({
  targets,
  selectedTargetId,
  onTargetChange,
  runs,
  onRunsChange,
  onRunScan,
  isScanning,
}: ConfigCardProps) {
  const [runsInput, setRunsInput] = useState<string>(String(runs));
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleRunsBlur = () => {
    const res = validateRuns(runsInput);
    if (!res.valid) {
      setValidationError(res.error ?? 'Invalid runs');
    } else {
      setValidationError(null);
      if (res.value !== undefined) {
        onRunsChange(res.value);
      }
    }
  };

  const handleRunsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRunsInput(val);
    const res = validateRuns(val);
    if (res.valid && res.value !== undefined) {
      setValidationError(null);
      onRunsChange(res.value);
    } else if (res.error) {
      setValidationError(res.error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isScanning) return;
    const res = validateRuns(runsInput);
    if (!res.valid) {
      setValidationError(res.error ?? 'Invalid runs');
      return;
    }
    setValidationError(null);
    if (res.value !== undefined) {
      onRunsChange(res.value);
    }
    onRunScan();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Target Selection */}
          <div className="space-y-1.5">
            <label
              htmlFor="target-select"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Target Bot
            </label>
            <select
              id="target-select"
              value={selectedTargetId}
              disabled={isScanning || targets.length === 0}
              onChange={(e) => onTargetChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/50"
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.id})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {targets.find((t) => t.id === selectedTargetId)?.description ||
                'Select a bot to evaluate'}
            </p>
          </div>

          {/* Runs Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="runs-input"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Runs Per Test (1–10)
            </label>
            <input
              id="runs-input"
              type="number"
              min={1}
              max={10}
              step={1}
              value={runsInput}
              disabled={isScanning}
              onChange={handleRunsChange}
              onBlur={handleRunsBlur}
              aria-invalid={validationError !== null}
              aria-describedby={validationError ? 'runs-error' : 'runs-helper'}
              className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/50 ${
                validationError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500/20 dark:border-slate-700'
              }`}
            />
            {validationError ? (
              <p id="runs-error" role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                {validationError}
              </p>
            ) : (
              <p id="runs-helper" className="text-xs text-slate-500 dark:text-slate-400">
                Default 3. Suggest 5 runs for the demo.
              </p>
            )}
          </div>

          {/* Run Scan Action */}
          <div className="flex flex-col justify-end">
            <button
              type="submit"
              disabled={isScanning || validationError !== null || targets.length === 0}
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-xs transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
            >
              {isScanning ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Running scan…
                </span>
              ) : (
                'Run scan'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
