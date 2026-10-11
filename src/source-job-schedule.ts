import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { claimSourceJob, enqueueSourceJob, finishSourceJob,
  type JobOutcome, type SourceJob } from './source-jobs.ts';

export type ScheduledJobResult = {
  id: string; source: string; runDate: string; created: boolean;
  status: 'succeeded' | 'dead'; attempts: number; lastError: string | null;
};

type State = {
  status: 'pending' | 'running' | 'succeeded' | 'dead';
  attempts: number; available_at: Date; lease_until: Date | null; last_error: string | null;
};

/** Run only the named scheduled job; another source's due job must never be claimed here. */
export async function runScheduledSourceJob(
  pool: pg.Pool, source: string, runDate: string,
  execute: (job: SourceJob) => Promise<JobOutcome>,
  options: { timeoutMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<ScheduledJobResult> {
  const { id, created } = await enqueueSourceJob(pool, source, runDate);
  const deadline = Date.now() + (options.timeoutMs ?? 8 * 60_000);
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (;;) {
    const stateResult = await pool.query<State>(`SELECT status,attempts,available_at,lease_until,last_error
      FROM source_jobs WHERE id=$1`, [id]);
    const state = stateResult.rows[0];
    if (!state) throw new Error(`找不到來源工作 ${id}`);
    if (state.status === 'succeeded' || state.status === 'dead') {
      return { id, source, runDate, created, status: state.status,
        attempts: state.attempts, lastError: state.last_error };
    }
    if (Date.now() >= deadline) throw new Error(`來源工作 ${id} 等待逾時；可查 jobs:status`);

    const job = await claimSourceJob(pool, randomUUID(), id);
    if (job) {
      const started = Date.now();
      let outcome: JobOutcome;
      try {
        outcome = await execute(job);
      } catch (cause) {
        outcome = { succeeded: false, retryable: false,
          durationMs: Date.now() - started,
          error: cause instanceof Error ? cause.message : String(cause) };
      }
      await finishSourceJob(pool, job, outcome);
      continue;
    }

    // A retry delay or another worker's lease may be in effect. Poll until this job is due.
    const due = state.status === 'running' ? state.lease_until : state.available_at;
    const remaining = deadline - Date.now();
    await sleep(Math.max(1, Math.min(5000, remaining, (due?.getTime() ?? Date.now()) - Date.now())));
  }
}
