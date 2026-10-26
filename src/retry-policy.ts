export const retryDelaysMs = [30_000, 120_000] as const;

/** The fixed prefix survives the importer child process boundary without exposing request URLs. */
export class SourceRequestError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(`${retryable ? 'SOURCE_TRANSIENT' : 'SOURCE_PERMANENT'}: ${message}`);
    this.name = 'SourceRequestError';
    this.retryable = retryable;
  }
}

export function isTransientSyncFailure(message: string): boolean {
  if (message.includes('SOURCE_TRANSIENT:')) return true;
  if (message.includes('SOURCE_PERMANENT:')) return false;
  return /來源連線失敗|fetch failed|timed? ?out|timeout|abort|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|connection terminated|HTTP 5\d\d|HTTP 429/i
    .test(message);
}
