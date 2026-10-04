export const retryDelaysMs = [30_000, 120_000] as const;

export function isTransientSyncFailure(message: string): boolean {
  return /fetch failed|timed? ?out|timeout|abort|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|connection terminated|HTTP 5\d\d|HTTP 429/i
    .test(message);
}
