import { sourceFreshness } from './source-freshness.ts';

export type HealthInput = {
  sourceStatus: string;
  lastOfficialSuccessAt: Date | string | null;
  lastAttemptStatus: string | null;
  pendingReview: number;
  missingNeedsReview: number;
};

export type HealthState = 'failed' | 'stale' | 'never' | 'untracked' | 'needs_review' | 'healthy';

export function sourceHealth(input: HealthInput, now: Date = new Date()): HealthState {
  const freshness = sourceFreshness(input.sourceStatus, input.lastOfficialSuccessAt,
    input.lastAttemptStatus, now);
  if (freshness === 'failed') return 'failed';
  if (freshness === 'stale') return 'stale';
  if (freshness === 'never') return 'never';
  if (freshness !== 'recent') return 'untracked';
  return input.pendingReview > 0 || input.missingNeedsReview > 0 ? 'needs_review' : 'healthy';
}
