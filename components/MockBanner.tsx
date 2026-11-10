import React from 'react';
import type { Mode } from '../lib/types';

interface MockBannerProps {
  mode: Mode;
}

export function MockBanner({ mode }: MockBannerProps) {
  if (mode !== 'mock') {
    return null;
  }

  return (
    <aside
      role="status"
      aria-label="Simulation notice"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-xs dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl select-none" aria-hidden="true">
          ⚠️
        </span>
        <div className="text-sm font-medium">
          <strong className="font-semibold uppercase tracking-wide">MOCK MODE:</strong>{' '}
          results come from simulated bots, not a live model.
        </div>
      </div>
    </aside>
  );
}
