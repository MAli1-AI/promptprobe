'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Mode, Target, TestCase, TestSummary } from '../lib/types';
import { getMitigation } from '../lib/engine/scoring';
import { fetchTargets, scanTest, ScanApiError } from '../lib/ui/api';
import { MockBanner } from '../components/MockBanner';
import { ConfigCard } from '../components/ConfigCard';
import { ProgressBar } from '../components/ProgressBar';
import { SummaryCards } from '../components/SummaryCards';
import { ResultsTable } from '../components/ResultsTable';
import { RubricPanel } from '../components/RubricPanel';
import { AllowlistDemo } from '../components/AllowlistDemo';
import { DownloadButtons } from '../components/DownloadButtons';

export default function Home() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [tests, setTests] = useState<TestCase[]>([]);
  const [mode, setMode] = useState<Mode>('live');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [runs, setRuns] = useState<number>(3);
  const [summaries, setSummaries] = useState<TestSummary[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{
    current: number;
    total: number;
    currentTestId?: string;
  }>({ current: 0, total: 0 });
  const [pageError, setPageError] = useState<string | null>(null);

  // Scanning lock to prevent double-click starting concurrent scans
  const scanLockRef = useRef<boolean>(false);

  // Load initial targets and tests on mount
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const data = await fetchTargets();
        if (!active) return;
        setTargets(data.targets);
        setTests(data.tests);
        setMode(data.mode);
        if (data.targets.length > 0) {
          setSelectedTargetId(data.targets[0].id);
        }
      } catch (err) {
        if (!active) return;
        setPageError(
          err instanceof Error
            ? `Failed to load targets: ${err.message}`
            : 'Failed to load initial scan configuration'
        );
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  // Switching target clears previous results
  const handleTargetChange = (newTargetId: string) => {
    if (isScanning) return;
    setSelectedTargetId(newTargetId);
    setSummaries([]);
    setScanProgress({ current: 0, total: 0 });
  };

  // Run sequential scan
  const handleRunScan = async () => {
    if (scanLockRef.current || isScanning || !selectedTargetId || tests.length === 0) {
      return;
    }

    scanLockRef.current = true;
    setIsScanning(true);
    setPageError(null);
    setSummaries([]);
    setScanProgress({ current: 0, total: tests.length, currentTestId: tests[0]?.id });

    try {
      // Loop over tests ONE sequential POST /api/scan per test (never in parallel)
      for (let i = 0; i < tests.length; i++) {
        const testCase = tests[i];
        setScanProgress({
          current: i,
          total: tests.length,
          currentTestId: testCase.id,
        });

        try {
          const summary = await scanTest(selectedTargetId, testCase.id, runs);
          setSummaries((prev) => [...prev, summary]);
        } catch (err) {
          // Error handling, never crash the page:
          // If a single request fails (network error, non-2xx, invalid JSON),
          // add an ERROR-styled row for that test with the message and continue with next test.
          let errorMessage = 'Request failed';
          if (err instanceof ScanApiError) {
            errorMessage = err.message;
          } else if (err instanceof Error) {
            errorMessage = err.message;
          }

          const fallbackSummary: TestSummary = {
            targetId: selectedTargetId,
            testId: testCase.id,
            category: testCase.category,
            title: testCase.title,
            aiJudged: testCase.aiJudged,
            runsRequested: runs,
            clamped: runs > 10,
            flagged: 0,
            clean: 0,
            errors: runs,
            successRate: null,
            verdict: 'ERROR',
            severity: 'None',
            explanation: errorMessage,
            mitigation: getMitigation(testCase.category),
            mode,
            runs: [
              {
                index: 1,
                status: 'error',
                errorKind: 'error',
                detail: errorMessage,
                durationMs: 0,
                responseExcerpt: '',
                aiJudged: testCase.aiJudged,
              },
            ],
          };

          setSummaries((prev) => [...prev, fallbackSummary]);
        }
      }
    } finally {
      setScanProgress((prev) => ({ ...prev, current: tests.length, currentTestId: undefined }));
      setIsScanning(false);
      scanLockRef.current = false;
    }
  };

  return (
    <main className="min-h-screen pb-16">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="space-y-2 border-b border-slate-200 pb-6 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
                PromptProbe
              </h1>
              <p className="mt-1 text-base text-slate-600 dark:text-slate-400">
                AI Chatbot Security Testing Tool — evaluate prompt injection, secret leaks, and policy adherence
              </p>
            </div>

            {/* Action buttons: Downloads */}
            <DownloadButtons
              summaries={summaries}
              mode={mode}
              targetId={selectedTargetId}
              runsPerTest={runs}
              isScanning={isScanning}
            />
          </div>
        </header>

        {/* MOCK Banner */}
        <MockBanner mode={mode} />

        {/* Global Page Error if target fetch fails */}
        {pageError && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
          >
            {pageError}
          </div>
        )}

        {/* Configuration Card */}
        <section aria-labelledby="scan-config-heading">
          <h2 id="scan-config-heading" className="sr-only">
            Scan Configuration
          </h2>
          <ConfigCard
            targets={targets}
            selectedTargetId={selectedTargetId}
            onTargetChange={handleTargetChange}
            runs={runs}
            onRunsChange={setRuns}
            onRunScan={handleRunScan}
            isScanning={isScanning}
          />
        </section>

        {/* Progress Bar */}
        <ProgressBar
          current={scanProgress.current}
          total={scanProgress.total}
          currentTestId={scanProgress.currentTestId}
          isScanning={isScanning}
        />

        {/* Summary Cards */}
        <SummaryCards
          summaries={summaries}
          mode={mode}
          targetId={selectedTargetId}
          runsPerTest={runs}
        />

        {/* Results Table */}
        <ResultsTable summaries={summaries} />

        {/* Visible Rubric Panel */}
        <RubricPanel />

        {/* Allowlist Demo Section */}
        <AllowlistDemo />
      </div>
    </main>
  );
}