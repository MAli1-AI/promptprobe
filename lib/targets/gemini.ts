import type { TargetReply } from '../types';
 
export interface GeminiCallOptions {
  systemPrompt?: string;
  temperature?: number;
  model?: string;
  apiKey?: string;
  timeoutMs?: number;
  retryDelayMs?: number;
  fetch?: typeof fetch;
}
 
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_RESPONSE_CHARS = 8_000;
 
let injectedFetch: typeof fetch | undefined;
 
/**
 * Configure an injectable fetch for Gemini calls (useful in test setups).
 * Pass undefined to go back to the global fetch.
 */
export function setGeminiFetch(fn: typeof fetch | undefined): void {
  injectedFetch = fn;
}
 
type Attempt =
  | { kind: 'response'; status: number; statusText: string; body: string }
  | { kind: 'timeout' }
  | { kind: 'error'; detail: string };
 
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
 
function malformed(detail: string): TargetReply {
  return { status: 'malformed', detail };
}
 
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
 
/** Free the connection when we do not need the body (non-2xx responses). */
async function discardBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // ignore: nothing useful to do if the stream cannot be cancelled
  }
}
 
/**
 * One request attempt. The abort timer covers the headers AND the body read,
 * so a response that stalls halfway still ends as a timeout.
 */
async function attemptRequest(
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number,
  fetchFn: typeof fetch
): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
 
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
 
    if (!res.ok) {
      await discardBody(res);
      return { kind: 'response', status: res.status, statusText: res.statusText, body: '' };
    }
 
    const text = await res.text();
    return { kind: 'response', status: res.status, statusText: res.statusText, body: text };
  } catch (err: unknown) {
    if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
      return { kind: 'timeout' };
    }
    const detail = err instanceof Error && err.message ? err.message : 'Network request failed';
    return { kind: 'error', detail };
  } finally {
    clearTimeout(timer);
  }
}
 
/** Turn a 2xx Gemini response body into a TargetReply. Never throws. */
function parseGeminiBody(body: string): TargetReply {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return malformed('Invalid JSON response from Gemini API');
  }
 
  if (!isRecord(data)) {
    return malformed('Response body is not a JSON object');
  }
 
  const candidates = data.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    const feedback = isRecord(data.promptFeedback) ? data.promptFeedback : undefined;
    const reason =
      typeof feedback?.blockReason === 'string' ? feedback.blockReason : 'No candidates returned';
    return malformed(`Gemini returned no candidates (${reason})`);
  }
 
  const candidate: unknown = candidates[0];
  const content = isRecord(candidate) && isRecord(candidate.content) ? candidate.content : undefined;
  const parts = content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    const reason =
      isRecord(candidate) && typeof candidate.finishReason === 'string'
        ? candidate.finishReason
        : 'No parts in candidate';
    return malformed(`Candidate missing content parts (${reason})`);
  }
 
  const text = parts
    .map((part: unknown) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .join('');
  if (text.trim().length === 0) {
    return malformed('Empty text returned by Gemini API');
  }
 
  return {
    status: 'ok',
    text: text.length > MAX_RESPONSE_CHARS ? text.slice(0, MAX_RESPONSE_CHARS) : text,
  };
}
 
/**
 * Server-only Gemini client using fetch against the Gemini REST API (no SDK).
 *
 * - Key from GEMINI_API_KEY, model from GEMINI_MODEL (no default: model names
 *   change, copy the exact name from AI Studio "Get code")
 * - The key is sent only in the x-goog-api-key header, never in the URL
 * - Low temperature (0.1), 15 s timeout per attempt (covers the body read)
 * - One retry after 1 s on HTTP 429, then error with detail "rate_limited"
 * - Response text truncated to 8000 characters
 * - Returns TargetReply (ok | timeout | error | malformed), never throws,
 *   never logs the key or full responses, and redacts the key from error details
 * - Fetch can be injected via options.fetch, as the second argument,
 *   or globally with setGeminiFetch
 */
export async function callGemini(
  prompt: string,
  optionsOrFetch?: GeminiCallOptions | typeof fetch,
  injectableFetch?: typeof fetch
): Promise<TargetReply> {
  let secret = '';
  const redact = (text: string): string => (secret ? text.split(secret).join('[redacted]') : text);
 
  try {
    const fetchFromArg = typeof optionsOrFetch === 'function' ? optionsOrFetch : undefined;
    const options: GeminiCallOptions =
      typeof optionsOrFetch === 'function' ? {} : (optionsOrFetch ?? {});
    const fetchFn: typeof fetch =
      injectableFetch ?? fetchFromArg ?? options.fetch ?? injectedFetch ?? globalThis.fetch;
 
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { status: 'error', detail: 'Missing GEMINI_API_KEY environment variable' };
    }
    secret = apiKey;
 
    const rawModel = options.model || process.env.GEMINI_MODEL;
    if (!rawModel) {
      return { status: 'error', detail: 'Missing GEMINI_MODEL environment variable' };
    }
    const model = rawModel.replace(/^models\//, '');
 
    const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
 
    const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    };
 
    const payload: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature },
    };
    if (options.systemPrompt) {
      payload.systemInstruction = { parts: [{ text: options.systemPrompt }] };
    }
    const bodyStr = JSON.stringify(payload);
 
    const send = (): Promise<Attempt> => attemptRequest(url, headers, bodyStr, timeoutMs, fetchFn);
 
    let attempt = await send();
 
    // HTTP 429: one retry after a short delay.
    if (attempt.kind === 'response' && attempt.status === 429) {
      if (retryDelayMs > 0) {
        await sleep(retryDelayMs);
      }
      attempt = await send();
      if (attempt.kind === 'response' && attempt.status === 429) {
        return { status: 'error', detail: 'rate_limited' };
      }
    }
 
    if (attempt.kind === 'timeout') {
      return { status: 'timeout' };
    }
    if (attempt.kind === 'error') {
      return { status: 'error', detail: redact(attempt.detail) };
    }
    if (attempt.status < 200 || attempt.status >= 300) {
      return {
        status: 'error',
        detail: `HTTP ${attempt.status}: ${attempt.statusText || 'Upstream error'}`,
      };
    }
 
    return parseGeminiBody(attempt.body);
  } catch (err: unknown) {
    // The client must never throw.
    const detail =
      err instanceof Error && err.message ? redact(err.message) : 'Unexpected Gemini client error';
    return { status: 'error', detail };
  }
}