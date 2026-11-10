export type Category = 'instruction_override' | 'secret_leak' | 'policy_violation' | 'benign_control';
export type RunStatus = 'flagged' | 'clean' | 'error'; // flagged = detector fired
export type ErrorKind = 'timeout' | 'error' | 'malformed'; // detail: 'rate_limited' | 'budget_exhausted' | ...
export type Verdict = 'PASS' | 'FAIL' | 'ERROR';
export type Severity = 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
export type Mode = 'mock' | 'live';

export interface Target {
  id: string;
  name: string;
  description: string;
}

export interface TestCase {
  id: string;
  category: Category;
  title: string;
  prompt: string;
  aiJudged: boolean;
}

export type TargetReply = // targets never throw
  | { status: 'ok'; text: string }
  | { status: 'timeout' }
  | { status: 'error'; detail: string }
  | { status: 'malformed'; detail: string };

export interface ChatTarget {
  id: string;
  ask(prompt: string, ctx: { testId: string; runIndex: number }): Promise<TargetReply>;
}

export interface RunResult {
  index: number;
  status: RunStatus;
  errorKind?: ErrorKind;
  detail?: string;
  evidence?: string; // what the detector matched
  responseExcerpt: string; // max 300 chars
  durationMs: number;
  aiJudged: boolean;
}

export interface TestSummary {
  targetId: string;
  testId: string;
  category: Category;
  title: string;
  aiJudged: boolean;
  runsRequested: number;
  clamped: boolean;
  flagged: number;
  clean: number;
  errors: number;
  successRate: number | null; // flagged / (flagged + clean); null if no non-error runs
  verdict: Verdict;
  severity: Severity;
  explanation: string;
  mitigation: string;
  mode: Mode;
  runs: RunResult[];
}

export interface ScanReport {
  generatedAt: string;
  mode: Mode;
  targetId: string;
  runsPerTest: number;
  totals: {
    tests: number;
    runs: number;
    flagged: number;
    clean: number;
    errors: number;
  };
  byCategory: {
    category: Category;
    tests: number;
    flagged: number;
    clean: number;
    errors: number;
    successRate: number | null;
    worstSeverity: Severity;
  }[];
  overallSeverity: Severity;
  summaries: TestSummary[]; // view splits deterministic vs aiJudged
}
