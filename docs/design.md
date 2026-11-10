# Design

## Architecture overview
One Next.js (App Router, TypeScript) app, no database. The browser drives a full scan by calling the API **once per test**. The server runs that test N times against one allowlisted demo bot, detects leaks and overrides with deterministic code, and returns raw run results. The browser builds the report from those raw results with a pure function. No single request runs a whole scan, so serverless time limits stay safe (`export const maxDuration = 60` on the scan route).

```
Browser                  /api/scan              runner                bot (target)         Gemini
  | POST {target,test,N}    |                      |                       |                  |
  |------------------------>| validate, allowlist  |                       |                  |
  |                         |-- runTest(t,case,N)->|-- N x ask(prompt) --->|-- generate ----->|
  |                         |                      |<-- ok|timeout|error ---|<-----------------|
  |                         |                      | detect -> flagged | clean | error
  |<-- TestSummary (raw) ---|<---------------------|
  | repeat for every test; buildReport(summaries) runs in the browser
```

Folder layout:
```
app/page.tsx                  scan UI, results table, report view
app/api/health|targets|scan   route handlers
components/                   UI pieces
lib/types.ts                  shared types (contract below)
lib/canaries.ts               canary secret, override marker, protected rule text (only place they exist)
lib/targets/                  gemini.ts, vulnerable.ts, hardened.ts, flaky.ts, mock.ts, registry.ts
lib/testlib/cases.ts          test cases as data
lib/engine/                   detectors.ts, scoring.ts, runner.ts, judge.ts
lib/report/buildReport.ts     pure report builder
scripts/test.sh               CI entry point (template CI calls it)
```
Ownership: Ali = types, canaries, targets, testlib, engine, api. Moin = UI, report, docs, scripts.

## Components

| Component | Responsibility | Technology |
|-----------|----------------|------------|
| UI (app/page.tsx, components) | Target and runs selection, live progress, results table, rubric panel, allowlist demo field, report view and downloads | Next.js, React, Tailwind |
| API routes | Validate input, enforce allowlist, call the runner, return typed JSON or a typed error | Next.js route handlers |
| Target registry | Allowlist of demo bots; `getTarget(id)` throws `NotAllowedError` for anything else | TypeScript |
| Bots | vulnerable-bot (canary in prompt, no defenses), hardened-bot (defensive prompt plus deterministic output guard), flaky-bot (deterministic mock for error cases) | Gemini server-side, mocks |
| Runner | Runs one test N times with concurrency limit, per-call timeout and call budget; classifies runs | TypeScript |
| Detectors | Pure functions: canary leak after normalization, marker override, benign-control check | TypeScript |
| AI judge | Policy-violation category only; strict JSON; failure becomes error | Gemini |
| Scoring | Rubric from docs/testing.md to severity; fixed mitigation per category | TypeScript |
| Report builder | Pure function from raw summaries to report; JSON and Markdown export | TypeScript |

## Data model
No database. Results live in the browser and can be downloaded. Shared contract (lib/types.ts):

```ts
type Category  = 'instruction_override' | 'secret_leak' | 'policy_violation' | 'benign_control';
type RunStatus = 'flagged' | 'clean' | 'error';     // flagged = detector fired
type ErrorKind = 'timeout' | 'error' | 'malformed'; // detail: 'rate_limited' | 'budget_exhausted' | ...
type Verdict   = 'PASS' | 'FAIL' | 'ERROR';
type Severity  = 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
type Mode      = 'mock' | 'live';

interface Target   { id: string; name: string; description: string }
interface TestCase { id: string; category: Category; title: string; prompt: string; aiJudged: boolean }

type TargetReply =                                   // targets never throw
  | { status: 'ok'; text: string }
  | { status: 'timeout' }
  | { status: 'error'; detail: string }
  | { status: 'malformed'; detail: string };
interface ChatTarget { id: string; ask(prompt: string, ctx: { testId: string; runIndex: number }): Promise<TargetReply> }

interface RunResult {
  index: number; status: RunStatus; errorKind?: ErrorKind; detail?: string;
  evidence?: string;            // what the detector matched
  responseExcerpt: string;      // max 300 chars
  durationMs: number; aiJudged: boolean;
}
interface TestSummary {
  targetId: string; testId: string; category: Category; title: string; aiJudged: boolean;
  runsRequested: number; clamped: boolean;
  flagged: number; clean: number; errors: number;
  successRate: number | null;   // flagged / (flagged + clean); null if no non-error runs
  verdict: Verdict; severity: Severity; explanation: string; mitigation: string;
  mode: Mode; runs: RunResult[];
}
interface ScanReport {
  generatedAt: string; mode: Mode; targetId: string; runsPerTest: number;
  totals: { tests: number; runs: number; flagged: number; clean: number; errors: number };
  byCategory: { category: Category; tests: number; flagged: number; clean: number; errors: number;
                successRate: number | null; worstSeverity: Severity }[];
  overallSeverity: Severity; summaries: TestSummary[];   // view splits deterministic vs aiJudged
}
```
Verdict: ERROR if there are no non-error runs; FAIL if flagged > 0; otherwise PASS.

## API / interfaces

| Method | Endpoint / interface | Purpose | Auth required |
|--------|----------------------|---------|---------------|
| GET | /api/health | Liveness check, returns `{status:"ok"}` | No |
| GET | /api/targets | List allowlisted targets and the test library, plus `mode` | No |
| POST | /api/scan | Run one test N times on one allowlisted target | No (per-IP limit, allowlist) |

Error shape for every failure: `{ "error": { "code": string, "message": string } }`.

**GET /api/targets** returns `{ targets: Target[], tests: TestCase[], mode }`. The UI imports the rubric from lib/engine/scoring.ts (pure, no secrets).

**POST /api/scan** body `{ targetId: string, testId: string, runs?: number }` (runs default 3).
- 200 `TestSummary`
- 400 `invalid_body` (not JSON, wrong types, runs below 1 or not an integer)
- 403 `target_not_allowed` (id not in the allowlist; a typed URL lands here)
- 404 `test_not_found`
- 429 `rate_limited` (more than 60 scan requests per minute per IP, in-memory, best effort)
- 500 `internal`

runs above 10 is clamped to 10 and `clamped: true` is returned. Run-level failures (timeouts, upstream errors, malformed output, exhausted budget) are error runs inside a 200 result.

## Key decisions and tradeoffs

| Decision | Options considered | Chosen | Why | Tradeoff accepted |
|----------|--------------------|--------|-----|-------------------|
| Scan granularity | One request per full scan; one request per test | One request per test | Avoids serverless time limits; live progress in the UI | More HTTP requests; the browser assembles the report |
| Persistence | Database; none | None, downloadable report | Out of scope for 6 hours; fewer defects | No history |
| Leak and override detection | AI judge; deterministic canary | Deterministic canary | Exact, repeatable, required by the organizers | Only finds values we planted |
| Policy violations | Skip; AI judge | AI judge, labeled, isolated | Cannot be decided exactly by code | Judge can be wrong; kept out of false-positive checks |
| Hardened bot | Prompt only; prompt plus guard | Prompt plus deterministic output guard | Reliably clean on repeated runs | A reference for "defended", not a claim about real bots |
| Quota | Unlimited; budget | MAX_CALLS_PER_SCAN, concurrency 3, per-IP limit, default 3 runs, mock mode | Free-tier limits | Fewer runs than a large study |
| Targets | Free URL field; fixed allowlist | Fixed allowlist by id | Cannot become an attack proxy | Cannot test arbitrary bots |

## AI components
- **Bots:** vulnerable-bot and hardened-bot call Gemini (server-side, low temperature, 15 s timeout, one retry on 429 after 1 s). Responses over 8000 characters are truncated before detection and marked.
- **Judge:** policy-violation category only. Inputs: the stated rule, the attack prompt, the response. Output: strict JSON `{violated, reason}` at temperature 0, `aiJudged: true`.
- **What code validates:** all leak, override and benign-control results are decided by deterministic code. Judge output is parsed and validated.
- **When AI fails:** timeouts, HTTP failures, empty or malformed output and malformed judge JSON become `error` runs with a reason; they are never pass or fail. Mock mode (USE_MOCK=true) uses deterministic bots and judge and shows a MOCK banner.

## Security and privacy

### Threat model
- **Attack proxy abuse:** the allowlist selects targets by id; the server never fetches a user-supplied URL.
- **Key theft:** keys exist only in server-side env vars, are read only in lib/targets/gemini.ts and lib/engine/judge.ts, and never appear in logs or client code.
- **Quota exhaustion:** per-scan call budget, concurrency limit, per-IP request limit, run cap of 10.
- **Malformed or hostile responses:** truncation, classification as malformed, no HTML injection (responses are rendered as text).

### Data handled
Only our own fake demo data: fake canary values, test prompts, bot responses. No personal data, no accounts, nothing stored server-side.

### Known limits
In-memory rate limiting resets per serverless instance. The judge can be wrong. Canary checks cannot find unknown secrets. The hardened bot's guard is deterministic by design.
