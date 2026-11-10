import React from 'react';
import type { Mode, TestSummary } from '../lib/types';
import { buildReport, toMarkdown } from '../lib/report/buildReport';

interface DownloadButtonsProps {
  summaries: TestSummary[];
  mode: Mode;
  targetId: string;
  runsPerTest: number;
  isScanning: boolean;
}

export function DownloadButtons({
  summaries,
  mode,
  targetId,
  runsPerTest,
  isScanning,
}: DownloadButtonsProps) {
  const isEnabled = !isScanning && summaries.length > 0;

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    if (!isEnabled) return;
    const report = buildReport(summaries, {
      generatedAt: new Date().toISOString(),
      mode,
      targetId,
      runsPerTest,
    });
    const jsonContent = JSON.stringify(report, null, 2);
    triggerDownload(jsonContent, `promptprobe-report-${targetId}.json`, 'application/json');
  };

  const handleDownloadMarkdown = () => {
    if (!isEnabled) return;
    const report = buildReport(summaries, {
      generatedAt: new Date().toISOString(),
      mode,
      targetId,
      runsPerTest,
    });
    const mdContent = toMarkdown(report);
    triggerDownload(mdContent, `promptprobe-report-${targetId}.md`, 'text/markdown;charset=utf-8');
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={!isEnabled}
        onClick={handleDownloadJson}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <span aria-hidden="true">⬇</span> Download JSON
      </button>

      <button
        type="button"
        disabled={!isEnabled}
        onClick={handleDownloadMarkdown}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <span aria-hidden="true">📄</span> Download Markdown
      </button>
    </div>
  );
}
