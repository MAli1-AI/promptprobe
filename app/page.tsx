'use client';

import React, { useEffect, useState } from 'react';
import { Target, TestCase, TestSummary } from '../lib/types';
import { getTargets, runScan, isApiError, isUseFixtures } from '../lib/ui/api';
import { SampleDataBanner } from '../components/SampleDataBanner';
import { TargetSelect } from '../components/TargetSelect';
import { RunsInput } from '../components/RunsInput';
import { ScanProgress } from '../components/ScanProgress';
import { ResultsTable } from '../components/ResultsTable';

export default function Home() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [tests, setTests] = useState<TestCase[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [runs, setRuns] = useState<number>(3);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number; activeTitle?: string }>({
    current: 0,
    total: 0,
  });
  const [results, setResults] = useState<TestSummary[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isLoadingTargets, setIsLoadingTargets] = useState<boolean>(true);

  const showFixtureBanner = isUseFixtures();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await getTargets();
        if (mounted) {
          setTargets(data.targets);
          setTests(data.tests);
          if (data.targets.length > 0) {
            setSelectedTarget(data.targets[0].id);
          }
          setProgress({ current: 0, total: data.tests.length });
        }
      } catch (err) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : 'Failed to load targets';
          setErrorBanner(msg);
        }
      } finally {
        if (mounted) {
          setIsLoadingTargets(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRunScan = async () => {
    if (!selectedTarget || tests.length === 0 || isScanning) {
      return;
    }

    setIsScanning(true);
    setResults([]);
    setErrorBanner(null);

    const totalTests = tests.length;

    for (let i = 0; i < totalTests; i++) {
      const currentTest = tests[i];
      setProgress({
        current: i + 1,
        total: totalTests,
        activeTitle: currentTest.title,
      });

      const response = await runScan(selectedTarget, currentTest.id, runs);

      if (isApiError(response)) {
        setErrorBanner(`Scan request failed on ${currentTest.id} (${response.status}): ${response.message}`);
        // Create an error summary so table captures failure
        const errorSummary: TestSummary = {
          targetId: selectedTarget,
          testId: currentTest.id,
          category: currentTest.category,
          title: currentTest.title,
          aiJudged: currentTest.aiJudged,
          runsRequested: runs,
          clamped: runs > 10,
          flagged: 0,
          clean: 0,
          errors: runs,
          successRate: null,
          verdict: 'ERROR',
          severity: 'None',
          explanation: `Error ${response.status}: ${response.message}`,
          mitigation: 'Investigate target connectivity and error logs.',
          mode: 'mock',
          runs: [],
        };
        setResults((prev) => [...prev, errorSummary]);
      } else {
        setResults((prev) => [...prev, response]);
      }
    }

    setIsScanning(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <SampleDataBanner show={showFixtureBanner} />

      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
              PromptProbe
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Automated AI Chatbot Security &amp; Robustness Testing
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span>Tests: <strong className="text-gray-700 dark:text-gray-200">{tests.length}</strong></span>
            <span>&bull;</span>
            <span>Targets: <strong className="text-gray-700 dark:text-gray-200">{targets.length}</strong></span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6 flex flex-col gap-6">
        {errorBanner && (
          <div
            role="alert"
            className="w-full bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 px-4 py-3 rounded-md text-sm flex items-start justify-between"
          >
            <span>{errorBanner}</span>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-xs font-semibold underline ml-4 hover:opacity-80 focus:ring-1 focus:ring-rose-500 rounded px-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Scan Control Panel */}
        <section
          aria-labelledby="controls-heading"
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5 shadow-sm flex flex-col gap-5"
        >
          <h2 id="controls-heading" className="text-base font-bold text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-800 pb-2">
            Scan Configuration
          </h2>

          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 w-full">
              <TargetSelect
                targets={targets}
                selectedId={selectedTarget}
                onChange={setSelectedTarget}
                disabled={isScanning || isLoadingTargets}
              />
            </div>

            <RunsInput
              runs={runs}
              onChange={setRuns}
              disabled={isScanning || isLoadingTargets}
            />

            <div className="w-full sm:w-auto">
              <button
                type="button"
                onClick={handleRunScan}
                disabled={isScanning || isLoadingTargets || targets.length === 0}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold px-6 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isScanning ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-1 h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
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
                    Scanning...
                  </>
                ) : (
                  'Run scan'
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Progress Section */}
        {(isScanning || progress.current > 0) && (
          <ScanProgress
            current={progress.current}
            total={progress.total}
            isScanning={isScanning}
            activeTestTitle={progress.activeTitle}
          />
        )}

        {/* Results Table Section */}
        <section aria-labelledby="results-heading">
          <ResultsTable results={results} isScanning={isScanning} />
        </section>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4 mt-auto text-center text-xs text-gray-500 dark:text-gray-400">
        PromptProbe &bull; Red-teaming &amp; Security Verification Suite
      </footer>
    </div>
  );
}
