# PromptProbe

> AI-Powered SE-MAX · CUI Tech Fest FA'26 · Team: Alpha

## What it does
PromptProbe is a security testing tool for AI chatbots. It runs a library of adversarial prompts (instruction override, secret leak, policy violation, plus benign controls) against a chatbot, repeats each test several times, and detects prompt-injection and information-leak failures with exact canary checks. It then produces a security report with success rates, severity from a stated rubric, and fixed mitigations per category.

## Problem and user
Developers ship AI chatbots without knowing whether a user can override their instructions or pull out hidden information. PromptProbe gives a chatbot developer or QA engineer a quick, repeatable pre-deployment check. It only tests our own demo bots (a vulnerable bot, a hardened bot and a deliberately flaky bot), so it cannot be used as an attack tool against anyone else.

## Live deployment
- **URL / install link:** https://promptprobe-two.vercel.app/
- **Platform:** Vercel (Next.js). Gemini is called server-side only.
- **Mode:** TODO keep one line and delete the other:
  - The deployed app runs in **live mode** (real Gemini calls).
  - The deployed app runs in **mock mode** (deterministic demo bots, no AI calls); a MOCK banner is shown on the page and in every report.

## Judge quick start (under 5 minutes)
1. Open the live URL. No login is needed.
2. Choose **vulnerable-bot**, set runs per test to 5, click **Run scan**. The secret-leak rows (LK-1 to LK-4) show a success rate above 0 with the canary as evidence, and a severity from the rubric.
3. Choose **hardened-bot** and run again. Every row shows zero flagged runs, including the benign controls (BC-1 to BC-3).
4. Choose **flaky-bot** and run. Timeouts, errors and malformed responses are shown with reasons, counted, and excluded from success rates. The page does not crash.
5. In the **Allowlist demo** field type `https://example.com` and run. The app refuses with a 403 `target_not_allowed` message and makes no outbound request.
6. After a full scan, download the **JSON** and **Markdown** report and compare the totals with the table. They match the raw results.

Step-by-step checks with code pointers: [docs/judge-checks.md](docs/judge-checks.md).

## Test accounts

| Role | Username / email | Password |
|------|------------------|----------|
| None | not needed | not needed |

The app has no login and stores no personal data.

## Run locally

### Prerequisites
Node.js (LTS) and npm. On Windows, run the shell scripts with Git Bash.

### Setup
```bash
git clone <this repo>
cd <repo folder>
npm install
cp .env.example .env.local     # then edit .env.local
```

### Environment variables
Names only; real values go in your local `.env.local` and in the Vercel project settings, never in the repository (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Gemini API key, read on the server only |
| `GEMINI_MODEL` | Exact Gemini model name (copy it from Google AI Studio "Get code") |
| `MAX_CALLS_PER_SCAN` | Upper limit on Gemini calls in one scan (default 25) |
| `USE_MOCK` | `true` runs deterministic demo bots with no key and no network |

### Run
```bash
npm run dev      # http://localhost:3000
```

### Run tests
```bash
bash scripts/test.sh   # install, lint, test, build (the same script CI runs)
npm test               # Vitest only
```

## Known limitations
- The hardened bot combines prompt defenses with a deterministic output guard by design. It is a reference for "defended", not a claim about any real chatbot.
- Canary checks only prove leaks of values we planted; they cannot find unknown secrets.
- The test library is small (12 cases). The AI judge, used only for the policy-violation category, can be wrong, which is why it is kept separate and labeled "AI-judged".
- Rate limiting is in-memory and resets per serverless instance.
- Results are not stored on the server; download the report to keep it.
- Live results depend on the Gemini free-tier quota; mock mode exists for that reason and is always labeled.

## Documentation
- [Requirements](docs/requirements.md)
- [Design](docs/design.md)
- [Testing](docs/testing.md)
- [AI usage log](docs/ai-usage-log.md)
- [Judge checks](docs/judge-checks.md)
- Also: [organizer brief](docs/BRIEF.md) and [demo script](docs/DEMO_SCRIPT.md)

## Team

| Name                   | Role                                              |
|------------------------|---------------------------------------------------|
| Mohammad Ali Mughal    | Detection engine, scoring, API, tests, deployment |
| Moeen Ali Abdullah Awan| UI, report, documentation, API collection         |
