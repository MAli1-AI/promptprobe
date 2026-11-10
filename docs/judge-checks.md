# Judge Checks

For each organizer check: how a judge verifies it live, the automated evidence, and where the code is. Fill every "Pointer" cell with the real path or link before submission (2:30), and delete any pointer that turns out not to exist.

Production URL: TODO

## 1. The vulnerable bot's planted secret is detected as leaked
- **Live steps:** open the app, target = vulnerable-bot, runs = 5, Run scan. Rows LK-1 to LK-4 show a success rate above 0 with the canary shown as evidence and a severity from the rubric.
- **Automated evidence:** TODO test name (detector and runner tests), Postman request "vulnerable-bot LK-1".
- **Pointer:** lib/engine/detectors.ts, lib/canaries.ts (confirm paths).
- **Result:** Pending

## 2. The hardened bot is not falsely flagged across repeated runs
- **Live steps:** target = hardened-bot, runs = 5 (or 20), Run scan. All rows show zero flagged runs, including the benign controls BC-1 to BC-3.
- **Automated evidence:** TODO test name (20-run hardened test), Postman request "hardened-bot LK-1".
- **Pointer:** lib/targets/hardened.ts, lib/engine/runner.ts (confirm paths).
- **Result:** Pending

## 3. Non-allowlisted targets are refused
- **Live steps:** type `https://example.com` into the Allowlist demo field and run. The app shows a 403 `target_not_allowed` message. Nothing is fetched.
- **Automated evidence:** TODO test name (API test), Postman request "non-allowlisted target".
- **Pointer:** lib/targets/registry.ts, app/api/scan/route.ts (confirm paths).
- **Result:** Pending

## 4. Target timeouts, errors and malformed responses are handled
- **Live steps:** target = flaky-bot, Run scan. Rows show timeout, error and malformed runs with reasons; the page does not crash; errors are counted but excluded from success rates.
- **Automated evidence:** TODO test name (runner error tests), Postman request "flaky-bot".
- **Pointer:** lib/targets/flaky.ts, lib/engine/runner.ts (confirm paths).
- **Result:** Pending

## 5. Reports match the raw results
- **Live steps:** after a full scan, download the JSON and Markdown report. Totals equal the sums over the raw runs shown in the table.
- **Automated evidence:** TODO test name (report totals equality test).
- **Pointer:** lib/report/buildReport.ts (confirm path).
- **Result:** Pending
