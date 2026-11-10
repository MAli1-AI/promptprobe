import { describe, it, expect } from 'vitest';
import { flakyTarget, getFlakyReply, FLAKY_CYCLE } from './flaky';

describe('Flaky Target (lib/targets/flaky.ts)', () => {
  it('has the expected target id', () => {
    expect(flakyTarget.id).toBe('flaky-bot');
  });

  it('cycles deterministic replies: ok, timeout, error, malformed, ok across runIndex 0..4', async () => {
    const expectedStatuses = ['ok', 'timeout', 'error', 'malformed', 'ok'];

    for (let index = 0; index < 5; index++) {
      const reply = await flakyTarget.ask('Test prompt', {
        testId: 'LK-1',
        runIndex: index,
      });

      expect(reply.status).toBe(expectedStatuses[index]);

      if (reply.status === 'ok') {
        expect(reply.text).toBeDefined();
      } else if (reply.status === 'error' || reply.status === 'malformed') {
        expect(reply.detail).toBeDefined();
      }
    }
  });

  it('repeats the exact 5-step cycle for runIndex 5..9', async () => {
    const expectedStatuses = ['ok', 'timeout', 'error', 'malformed', 'ok'];

    for (let index = 5; index < 10; index++) {
      const direct = getFlakyReply(index);
      const targetReply = await flakyTarget.ask('Another prompt', {
        testId: 'OV-1',
        runIndex: index,
      });

      expect(direct.status).toBe(expectedStatuses[index % 5]);
      expect(targetReply.status).toBe(expectedStatuses[index % 5]);
    }
  });

  it('correctly handles arbitrary and negative indices using modulo arithmetic', () => {
    expect(getFlakyReply(10).status).toBe('ok');
    expect(getFlakyReply(11).status).toBe('timeout');
    expect(getFlakyReply(12).status).toBe('error');
    expect(getFlakyReply(13).status).toBe('malformed');
    expect(getFlakyReply(14).status).toBe('ok');

    expect(getFlakyReply(-1).status).toBe('ok'); // -1 mod 5 -> 4
    expect(getFlakyReply(-5).status).toBe('ok'); // -5 mod 5 -> 0
  });

  it('defines the FLAKY_CYCLE array with exactly 5 items', () => {
    expect(FLAKY_CYCLE).toHaveLength(5);
    expect(FLAKY_CYCLE[0].status).toBe('ok');
    expect(FLAKY_CYCLE[1].status).toBe('timeout');
    expect(FLAKY_CYCLE[2].status).toBe('error');
    expect(FLAKY_CYCLE[3].status).toBe('malformed');
    expect(FLAKY_CYCLE[4].status).toBe('ok');
  });
});
