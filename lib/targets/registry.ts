import { ChatTarget, Target } from '../types';
import { vulnerableTarget } from './vulnerable';
import { hardenedTarget } from './hardened';
import { flakyTarget } from './flaky';
import { mockVulnerableTarget, mockHardenedTarget } from './mock';

/**
 * Allowlist of demo target IDs.
 * Only these targets can be queried. All other identifiers, including arbitrary URLs, are rejected.
 */
export const ALLOWED_TARGET_IDS = ['vulnerable-bot', 'hardened-bot', 'flaky-bot'] as const;
export type AllowedTargetId = (typeof ALLOWED_TARGET_IDS)[number];

/**
 * Typed error thrown when a requested target ID is not in the allowlist.
 */
export class NotAllowedError extends Error {
  readonly code = 'target_not_allowed';

  constructor(targetId: string) {
    super(`Target not allowed: ${targetId}`);
    this.name = 'NotAllowedError';
    Object.setPrototypeOf(this, NotAllowedError.prototype);
  }
}

/**
 * Metadata for all allowlisted demo targets.
 */
export const TARGETS: Target[] = [
  {
    id: 'vulnerable-bot',
    name: 'Vulnerable Bot',
    description: 'Store assistant with canary secret in system prompt and no prompt-injection defenses.',
  },
  {
    id: 'hardened-bot',
    name: 'Hardened Bot',
    description: 'Store assistant with defensive system prompt and deterministic output guard.',
  },
  {
    id: 'flaky-bot',
    name: 'Flaky Bot',
    description: 'Deterministic test target that cycles through ok, timeout, error, and malformed responses.',
  },
];

/**
 * Type guard checking if an id is an allowlisted target ID.
 */
export function isAllowedTarget(id: string): id is AllowedTargetId {
  return (ALLOWED_TARGET_IDS as readonly string[]).includes(id);
}

export interface GetTargetOptions {
  useMock?: boolean;
}

/**
 * Returns the ChatTarget for the given target ID.
 * Throws a typed NotAllowedError if the target ID is not in the allowlist (including URLs).
 * When USE_MOCK=true (or options.useMock=true), returns mock versions of vulnerable and hardened targets.
 */
export function getTarget(id: string, options?: GetTargetOptions): ChatTarget {
  if (!isAllowedTarget(id)) {
    throw new NotAllowedError(id);
  }

  const useMock = options?.useMock ?? (process.env.USE_MOCK === 'true');

  switch (id) {
    case 'vulnerable-bot':
      return useMock ? mockVulnerableTarget : vulnerableTarget;
    case 'hardened-bot':
      return useMock ? mockHardenedTarget : hardenedTarget;
    case 'flaky-bot':
      return flakyTarget;
  }
}

/**
 * Returns the list of all allowlisted targets.
 */
export function listTargets(): Target[] {
  return TARGETS;
}
