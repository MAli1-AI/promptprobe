'use client';

import React from 'react';

interface SampleDataBannerProps {
  show?: boolean;
}

export function SampleDataBanner({ show = true }: SampleDataBannerProps) {
  if (!show) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-amber-400 text-amber-950 font-bold px-4 py-2.5 text-center text-sm border-b border-amber-500 shadow-sm flex items-center justify-center gap-2"
    >
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs uppercase font-extrabold bg-amber-500 text-amber-950 border border-amber-600">
        Demo Mode
      </span>
      <span className="tracking-wide">
        SAMPLE DATA: Fixture mode active. API calls return realistic offline sample data.
      </span>
    </div>
  );
}
