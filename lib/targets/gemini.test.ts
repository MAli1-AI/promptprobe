import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGemini, setGeminiFetch } from './gemini';
 
const TEST_KEY = 'test-api-key-12345';
 
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
 
function geminiText(text: string): unknown {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}
 
function abortError(): Error {
  const err = new Error('The operation was aborted');
  err.name = 'AbortError';
  return err;
}
 
function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
 
describe('Gemini client (lib/targets/gemini.ts)', () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
 
  beforeEach(() => {
    process.env.GEMINI_API_KEY = TEST_KEY;
    process.env.GEMINI_MODEL = 'test-model';
    setGeminiFetch(undefined);
  });
 
  afterEach(() => {
    restoreEnv('GEMINI_API_KEY', originalApiKey);
    restoreEnv('GEMINI_MODEL', originalModel);
    setGeminiFetch(undefined);
    vi.restoreAllMocks();
  });
 
  describe('Timeout handling', () => {
    it('returns timeout when fetch rejects with an AbortError', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockRejectedValue(abortError());
 
      const reply = await callGemini('Hello', { fetch: mockFetch, timeoutMs: 100 });
 
      expect(reply.status).toBe('timeout');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
 
    it('returns timeout when the request hangs until the abort signal fires', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(abortError()));
        });
      });
 
      const reply = await callGemini('Hello', { fetch: mockFetch, timeoutMs: 50 });
 
      expect(reply.status).toBe('timeout');
    });
 
    it('returns timeout when headers arrive but the body never finishes', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
        const stalled = {
          ok: true,
          status: 200,
          statusText: 'OK',
          body: null,
          text: () =>
            new Promise<string>((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(abortError()));
            }),
        } as unknown as Response;
        return Promise.resolve(stalled);
      });
 
      const reply = await callGemini('Hello', { fetch: mockFetch, timeoutMs: 50 });
 
      expect(reply.status).toBe('timeout');
    });
  });
 
  describe('HTTP errors and 429 retry', () => {
    it('retries once on HTTP 429 and succeeds if the retry returns 200', async () => {
      const mockFetch = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response('Rate limit exceeded', { status: 429 }))
        .mockResolvedValueOnce(jsonResponse(geminiText('Response after 429 retry')));
 
      const reply = await callGemini('Test 429', { fetch: mockFetch, retryDelayMs: 1 });
 
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(reply).toEqual({ status: 'ok', text: 'Response after 429 retry' });
    });
 
    it('returns rate_limited when the retry also returns 429', async () => {
      const mockFetch = vi
        .fn<typeof fetch>()
        .mockImplementation(async () => new Response('Rate limit exceeded', { status: 429 }));
 
      const reply = await callGemini('Test 429 exhausted', { fetch: mockFetch, retryDelayMs: 1 });
 
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(reply).toEqual({ status: 'error', detail: 'rate_limited' });
    });
 
    it('returns timeout when the retry after a 429 times out', async () => {
      const mockFetch = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response('Rate limit exceeded', { status: 429 }))
        .mockRejectedValueOnce(abortError());
 
      const reply = await callGemini('Hello', { fetch: mockFetch, retryDelayMs: 1 });
 
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(reply.status).toBe('timeout');
    });
 
    it('returns an error without retrying on HTTP 500', async () => {
      const mockFetch = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('boom', { status: 500, statusText: 'Server Error' }));
 
      const reply = await callGemini('Hello', { fetch: mockFetch, retryDelayMs: 1 });
 
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(reply.status).toBe('error');
      if (reply.status === 'error') {
        expect(reply.detail).toContain('HTTP 500');
      }
    });
  });
 
  describe('Malformed response handling', () => {
    it('returns malformed when the body is not valid JSON', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('<html>Internal Server Error</html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      );
 
      const reply = await callGemini('Hello', { fetch: mockFetch });
 
      expect(reply.status).toBe('malformed');
      if (reply.status === 'malformed') {
        expect(reply.detail).toContain('Invalid JSON');
      }
    });
 
    it('returns malformed when the JSON is not an object', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse('just a string'));
 
      const reply = await callGemini('Hello', { fetch: mockFetch });
 
      expect(reply.status).toBe('malformed');
      if (reply.status === 'malformed') {
        expect(reply.detail).toContain('not a JSON object');
      }
    });
 
    it('returns malformed when candidates is empty', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ candidates: [] }));
 
      const reply = await callGemini('Hello', { fetch: mockFetch });
 
      expect(reply.status).toBe('malformed');
      if (reply.status === 'malformed') {
        expect(reply.detail).toContain('No candidates returned');
      }
    });
 
    it('includes the block reason when the prompt is blocked', async () => {
      const mockFetch = vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse({ promptFeedback: { blockReason: 'SAFETY' } }));
 
      const reply = await callGemini('Hello', { fetch: mockFetch });
 
      expect(reply.status).toBe('malformed');
      if (reply.status === 'malformed') {
        expect(reply.detail).toContain('SAFETY');
      }
    });
 
    it('returns malformed when the candidate has no parts', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }],
        })
      );
 
      const reply = await callGemini('Hello', { fetch: mockFetch });
 
      expect(reply.status).toBe('malformed');
      if (reply.status === 'malformed') {
        expect(reply.detail).toContain('Candidate missing content parts');
      }
    });
 
    it('returns malformed when the candidate text is empty or whitespace', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(geminiText('   \n\t  ')));
 
      const reply = await callGemini('Hello', { fetch: mockFetch });
 
      expect(reply.status).toBe('malformed');
      if (reply.status === 'malformed') {
        expect(reply.detail).toContain('Empty text');
      }
    });
  });
 
  describe('Successful responses', () => {
    it('joins multiple text parts', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: 'Hello ' }, { text: 'world' }] } }],
        })
      );
 
      const reply = await callGemini('Hi', { fetch: mockFetch });
 
      expect(reply).toEqual({ status: 'ok', text: 'Hello world' });
    });
 
    it('truncates responses over 8000 characters to exactly 8000', async () => {
      const mockFetch = vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse(geminiText('A'.repeat(10500))));
 
      const reply = await callGemini('Generate long', { fetch: mockFetch });
 
      expect(reply.status).toBe('ok');
      if (reply.status === 'ok') {
        expect(reply.text).toBe('A'.repeat(8000));
      }
    });
 
    it('leaves a response of exactly 8000 characters untouched', async () => {
      const mockFetch = vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse(geminiText('B'.repeat(8000))));
 
      const reply = await callGemini('Hello', { fetch: mockFetch });
 
      expect(reply).toEqual({ status: 'ok', text: 'B'.repeat(8000) });
    });
 
    it('leaves short responses untouched', async () => {
      const shortText = 'Standard store assistant reply.';
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(geminiText(shortText)));
 
      const reply = await callGemini('Hello', { fetch: mockFetch });
 
      expect(reply).toEqual({ status: 'ok', text: shortText });
    });
  });
 
  describe('Request shape and key safety', () => {
    it('sends the key only in a header, never in the URL', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(geminiText('ok')));
 
      await callGemini('Hello', { fetch: mockFetch });
 
      const [url, init] = mockFetch.mock.calls[0];
      expect(String(url)).not.toContain(TEST_KEY);
      expect(String(url)).not.toContain('key=');
      expect(String(url)).toContain('generativelanguage.googleapis.com');
      expect(String(url)).toContain('test-model:generateContent');
      const headers = init?.headers as Record<string, string>;
      expect(headers['x-goog-api-key']).toBe(TEST_KEY);
    });
 
    it('strips a leading "models/" from the model name', async () => {
      process.env.GEMINI_MODEL = 'models/test-model';
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(geminiText('ok')));
 
      await callGemini('Hello', { fetch: mockFetch });
 
      const [url] = mockFetch.mock.calls[0];
      expect(String(url)).toContain('/models/test-model:generateContent');
      expect(String(url)).not.toContain('models%2F');
    });
 
    it('sends the prompt, system prompt and default low temperature', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(geminiText('ok')));
 
      await callGemini('User question', { fetch: mockFetch, systemPrompt: 'You are a shop bot.' });
 
      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(String(init?.body)) as {
        contents: { parts: { text: string }[] }[];
        systemInstruction: { parts: { text: string }[] };
        generationConfig: { temperature: number };
      };
      expect(body.contents[0].parts[0].text).toBe('User question');
      expect(body.systemInstruction.parts[0].text).toBe('You are a shop bot.');
      expect(body.generationConfig.temperature).toBe(0.1);
    });
 
    it('redacts the key if it appears in a network error message', async () => {
      const mockFetch = vi
        .fn<typeof fetch>()
        .mockRejectedValue(new Error(`request failed for ${TEST_KEY}`));
 
      const reply = await callGemini('Hello', { fetch: mockFetch });
 
      expect(reply.status).toBe('error');
      if (reply.status === 'error') {
        expect(reply.detail).not.toContain(TEST_KEY);
        expect(reply.detail).toContain('[redacted]');
      }
    });
  });
 
  describe('Configuration and resilience', () => {
    it('returns an error when GEMINI_API_KEY is not set', async () => {
      delete process.env.GEMINI_API_KEY;
 
      const reply = await callGemini('Hello');
 
      expect(reply.status).toBe('error');
      if (reply.status === 'error') {
        expect(reply.detail).toContain('Missing GEMINI_API_KEY');
      }
    });
 
    it('returns an error when GEMINI_MODEL is not set', async () => {
      delete process.env.GEMINI_MODEL;
      const mockFetch = vi.fn<typeof fetch>();
 
      const reply = await callGemini('Hello', { fetch: mockFetch });
 
      expect(reply.status).toBe('error');
      if (reply.status === 'error') {
        expect(reply.detail).toContain('Missing GEMINI_MODEL');
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });
 
    it('never throws when fetch rejects', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error('Fatal socket failure'));
 
      const reply = await callGemini('Hello', { fetch: mockFetch });
 
      expect(reply).toEqual({ status: 'error', detail: 'Fatal socket failure' });
    });
 
    it('never throws when fetch rejects with a non-Error value', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockRejectedValue('weird failure');
 
      const reply = await callGemini('Hello', { fetch: mockFetch });
 
      expect(reply.status).toBe('error');
    });
 
    it('uses a fetch injected with setGeminiFetch', async () => {
      const mockFetch = vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse(geminiText('Response via setGeminiFetch')));
      setGeminiFetch(mockFetch);
 
      const reply = await callGemini('Hello');
 
      expect(reply).toEqual({ status: 'ok', text: 'Response via setGeminiFetch' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
 
    it('accepts a fetch function as the second argument', async () => {
      const mockFetch = vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse(geminiText('Response via argument')));
 
      const reply = await callGemini('Hello', mockFetch);
 
      expect(reply).toEqual({ status: 'ok', text: 'Response via argument' });
    });
  });
});
 