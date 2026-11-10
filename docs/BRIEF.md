# Event Brief (organizer text)

Source: CUI Tech Fest FA'26, "AI-Powered SE-MAX" rule book and the organizers' idea-approval message. Text below is copied from the organizers; only the layout is ours.

## Event
AI-Powered SE-MAX is a 6-hour software engineering hackathon. Teams use AI tools to take an approved idea through planning, building, testing and deployment, and deliver a small, working, shippable product. The event is not about who builds the biggest app. It rewards the team that applies sound engineering practice and ships the product with the fewest defects.

- Date: 10 Nov 2026, 9:00-5:30, CL-11 / CL-12. Team size 2-4.
- Round 2, Build Day (9:00 AM - 3:00 PM): plan, build, test and deploy the product, and submit the repository and short documents.
- Final Round, Judging (3:00 PM - 5:30 PM): live demo, judge questions and standardized defect checks, followed by awards.

## Approved idea
**PromptProbe - AI Chatbot Security Testing Tool.** PromptProbe is an AI-powered security testing tool designed to identify prompt injection vulnerabilities and potential information leaks in AI chatbots. It allows developers to test their chatbots against predefined adversarial prompts and evaluate how effectively they handle malicious instructions.

The system executes a collection of security test cases, analyzes chatbot responses, and identifies potential vulnerabilities such as instruction override, confidential information leakage, and policy violations. It then generates a security assessment report containing test results, vulnerability categories, risk levels, and suggested mitigation measures.

Key features: automated prompt injection testing; predefined adversarial test cases; detection of potential information leaks and instruction overrides; vulnerability classification and risk scoring; pass/fail test results with explanations; automated security assessment reports.

Objective: help developers identify and understand security weaknesses in AI chatbots before deploying them, promoting safer and more reliable AI-powered applications.

## Approved with required changes
1. **Authorized targets only:** the tool may test only your own demo chatbots or an explicit allowlist. Do not target other teams' applications or third-party chatbots. The deployed version must not be usable as a general attack proxy.
2. **Deterministic detection where possible:** use canary secrets and canary instructions so leaks and overrides are detected exactly by code. Clearly label any AI-judged results.
3. **Statistical results:** run each test multiple times and report success rates.
4. **Test targets:** build a deliberately vulnerable bot and a hardened bot. Your tool must distinguish them.
5. **Scoring:** severity from a stated rubric; mitigations fixed per category.
6. **Quota:** budget your AI calls and keep keys server-side.

## Judges will check at least
- The vulnerable bot's planted secret is detected as leaked.
- The hardened bot is not falsely flagged across repeated runs.
- Non-allowlisted targets are refused.
- Target timeouts, errors and malformed responses are handled.
- Reports match the raw results.

## Judging criteria
| Criterion | Weight |
|---|---|
| Shippable product (works end to end, few defects, deployed) | 25% |
| Testing and edge-case handling | 20% |
| Engineering quality and Git practice | 13% |
| Requirements and design | 12% |
| Demo, README and Q&A | 12% |
| Market value (real user and problem) | 10% |
| Responsible AI use | 8% |

## Rules (excerpt)
- Start from zero: no pre-written project code, designs or documents. Research, public libraries, frameworks and official documentation are allowed. Create the repository from the organizers' template when the clock starts.
- Any language, framework or AI tool is allowed. You must understand your code, test what AI writes, and keep a short AI usage log.
- No real personal data, no passwords or API keys in the repository, and no illegal, harmful or discriminatory projects.
- Never attack, scan or disrupt other teams' applications or the venue network.
- Cheating or plagiarism, including fake test results or copying another team, leads to disqualification.
- The build clock does not stop for breaks or for tool or network problems.
