import { ChatTarget, TargetReply } from '../types';

/**
 * Deterministic mock cycling sequence:
 * [ok, timeout, error, malformed, ok] by runIndex.
 */
export const FLAKY_CYCLE: TargetReply[] = [
  { status: 'ok', text: 'Flaky bot normal response (step 0)' },
  { status: 'timeout' },
  { status: 'error', detail: 'Flaky bot simulated upstream error (step 2)' },
  { status: 'malformed', detail: 'Flaky bot simulated malformed response (step 3)' },
  { status: 'ok', text: 'Flaky bot normal response (step 4)' },
];

/**
 * Deterministically computes the flaky reply for a given runIndex.
 */
export function getFlakyReply(runIndex: number): TargetReply {
  const mod = ((runIndex % 5) + 5) % 5;
  return FLAKY_CYCLE[mod];
}

export const flakyTarget: ChatTarget = {
  id: 'flaky-bot',
  async ask(_prompt: string, ctx: { testId: string; runIndex: number }): Promise<TargetReply> {
    return getFlakyReply(ctx.runIndex);
  },
};

export default flakyTarget;
