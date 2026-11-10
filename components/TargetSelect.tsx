'use client';

import React from 'react';
import { Target } from '../lib/types';

interface TargetSelectProps {
  targets: Target[];
  selectedId: string;
  onChange: (targetId: string) => void;
  disabled?: boolean;
}

export function TargetSelect({
  targets,
  selectedId,
  onChange,
  disabled = false,
}: TargetSelectProps) {
  const currentTarget = targets.find((t) => t.id === selectedId);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label
        htmlFor="target-select"
        className="text-sm font-semibold text-gray-800 dark:text-gray-200"
      >
        Target Bot
      </label>
      <select
        id="target-select"
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 transition"
      >
        {targets.map((target) => (
          <option key={target.id} value={target.id}>
            {target.name} ({target.id})
          </option>
        ))}
      </select>
      {currentTarget && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {currentTarget.description}
        </p>
      )}
    </div>
  );
}
