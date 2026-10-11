export type SourceFreshness = 'manual' | 'planned' | 'never' | 'untracked' | 'failed' | 'stale' | 'recent';

// Weekly polling gets one missed-cycle grace period before the age alone becomes stale.
const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

export function sourceFreshness(
  sourceStatus: string,
  lastOfficialSuccessAt: Date | string | null,
  lastAttemptStatus: string | null,
  now: Date = new Date(),
): SourceFreshness {
  if (sourceStatus === 'curated') return 'manual';
  if (sourceStatus === 'planned') return 'planned';
  if (lastAttemptStatus === 'failed') return 'failed';
  if (!lastOfficialSuccessAt) return 'never';
  const elapsed = now.getTime() - new Date(lastOfficialSuccessAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return 'untracked';
  if (elapsed > STALE_AFTER_MS) return 'stale';
  return lastAttemptStatus === 'succeeded' ? 'recent' : 'untracked';
}
