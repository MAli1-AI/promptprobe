import React, { useState } from 'react';
import { probeTarget } from '../lib/ui/api';

export function AllowlistDemo() {
  const [typedTarget, setTypedTarget] = useState<string>('https://example.com');
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedTarget.trim()) return;

    setIsLoading(true);
    setResultMessage(null);

    // Sends typed text as targetId to POST /api/scan with testId 'LK-1' and runs 1.
    // The browser never fetches the typed URL or text directly.
    const res = await probeTarget(typedTarget.trim());
    setIsLoading(false);
    setResultMessage(res.message);
  };

  return (
    <section
      aria-labelledby="allowlist-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-4">
        <h2
          id="allowlist-heading"
          className="text-lg font-bold text-slate-900 dark:text-slate-100"
        >
          Allowlist Enforcement Demo
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Only allowlisted demo bots can be scanned. Anything else, including URLs, is refused.
        </p>
      </div>

      <form onSubmit={handleTest} className="space-y-4 max-w-xl">
        <div className="space-y-1.5">
          <label
            htmlFor="allowlist-target-input"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Target ID or Arbitrary URL to test
          </label>
          <div className="flex gap-2">
            <input
              id="allowlist-target-input"
              type="text"
              value={typedTarget}
              onChange={(e) => setTypedTarget(e.target.value)}
              placeholder="e.g. https://example.com or attacker-bot"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={isLoading || !typedTarget.trim()}
              className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-2xs transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              {isLoading ? 'Checking…' : 'Test target'}
            </button>
          </div>
        </div>

        {resultMessage && (
          <div
            role="status"
            className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-850 dark:text-slate-200"
          >
            <div className="font-semibold text-slate-600 dark:text-slate-400 mb-1">
              API Response:
            </div>
            <pre className="whitespace-pre-wrap break-words">{resultMessage}</pre>
          </div>
        )}
      </form>
    </section>
  );
}
