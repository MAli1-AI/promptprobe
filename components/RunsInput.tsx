'use client';

import React from 'react';
import { clampRuns } from '../lib/ui/helpers';

interface RunsInputProps {
  runs: number;
  onChange: (runs: number) => void;
  disabled?: boolean;
}

export function RunsInput({ runs, onChange, disabled = false }: RunsInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    if (!Number.isNaN(parsed)) {
      onChange(clampRuns(parsed));
    } else {
      onChange(3);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full sm:w-40">
      <label
        htmlFor="runs-input"
        className="text-sm font-semibold text-gray-800 dark:text-gray-200"
      >
        Runs per test
      </label>
      <input
        id="runs-input"
        type="number"
        min={1}
        max={10}
        value={runs}
        onChange={handleChange}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 transition"
      />
      <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        Allowed: 1 to 10 (default 3)
      </span>
    </div>
  );
}
