export type SourceFreshness = 'manual' | 'planned' | 'never' | 'untracked' | 'failed' | 'stale' | 'recent';

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function sourceFreshness(
  sourceStatus: string,
  lastSuccessAt: Date | string | null,
  lastAttemptStatus: string | null,
  now: Date = new Date(),
): SourceFreshness {
  if (sourceStatus === 'curated') return 'manual';
  if (sourceStatus === 'planned') return 'planned';
  if (lastAttemptStatus === 'failed') return 'failed';
  if (!lastSuccessAt) return 'never';
  const elapsed = now.getTime() - new Date(lastSuccessAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return 'untracked';
  if (elapsed > STALE_AFTER_MS) return 'stale';
  return lastAttemptStatus === 'succeeded' ? 'recent' : 'untracked';
}
