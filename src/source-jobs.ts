import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { retryDelaysMs } from './retry-policy.ts';

export const queuedSources = ['nmns', 'npm-south', 'npm-north', 'nmmba', 'nstm', 'ntmofa'] as const;
export type QueuedSource = typeof queuedSources[number];
export type SourceJob = {
  id: string; museum_id: QueuedSource; status: string; attempts: number;
  worker_token: string; run_date: string;
};

export function validRunDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function taiwanDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export async function enqueueSourceJob(pool: pg.Pool, source: string, runDate: string): Promise<{ id: string; created: boolean }> {
  if (!queuedSources.includes(source as QueuedSource) || !validRunDate(runDate)) {
    throw new Error('來源或日期無效');
  }
  const key = `daily:${source}:${runDate}`;
  const inserted = await pool.query<{ id: string }>(`INSERT INTO source_jobs
    (idempotency_key,museum_id,run_date) VALUES ($1,$2,$3)
    ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`, [key, source, runDate]);
  if (inserted.rows[0]) return { id: inserted.rows[0].id, created: true };
  const existing = await pool.query<{ id: string }>(
    'SELECT id FROM source_jobs WHERE idempotency_key=$1', [key]);
  if (!existing.rows[0]) throw new Error('工作去重衝突後找不到既有工作');
  return { id: existing.rows[0].id, created: false };
}

/** Expired leases are recorded as failed attempts before another worker can claim them. */
export async function claimSourceJob(pool: pg.Pool, token: string = randomUUID(), targetId?: string): Promise<SourceJob | null> {
  if (targetId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
    throw new Error('工作 ID 無效');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const expired = await client.query<{ id: string; museum_id: string; attempts: number; started_at: Date }>(`
      SELECT id,museum_id,attempts,started_at FROM source_jobs
      WHERE status='running' AND lease_until<=now()
        AND ($1::uuid IS NULL OR id=$1)
      ORDER BY lease_until,id FOR UPDATE SKIP LOCKED LIMIT 20`, [targetId ?? null]);
    for (const job of expired.rows) {
      const dead = job.attempts >= 3;
      const delay = dead ? 0 : retryDelaysMs[job.attempts - 1];
      await client.query(`UPDATE source_jobs SET status=$2,available_at=now()+($3::int * interval '1 millisecond'),
        lease_until=NULL,worker_token=NULL,started_at=NULL,
        last_error='worker lease expired',updated_at=now() WHERE id=$1`,
      [job.id, dead ? 'dead' : 'pending', delay]);
      const duration = Math.max(0, Math.min(2_147_483_647,
        Date.now() - new Date(job.started_at).getTime()));
      await client.query(`INSERT INTO sync_attempts
        (sync_id,museum_id,attempt_no,status,retryable,duration_ms,error_message)
        VALUES ($1,$2,$3,'failed',true,$4,'worker lease expired')
        ON CONFLICT (sync_id,attempt_no) DO NOTHING`,
      [job.id, job.museum_id, job.attempts, duration]);
    }
    const next = await client.query<{ id: string }>(`SELECT id FROM source_jobs
      WHERE status='pending' AND available_at<=now() AND attempts<max_attempts
        AND ($1::uuid IS NULL OR id=$1)
      ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1`, [targetId ?? null]);
    if (!next.rows[0]) { await client.query('COMMIT'); return null; }
    const claimed = await client.query<SourceJob>(`UPDATE source_jobs SET status='running',
      attempts=attempts+1,worker_token=$2,started_at=now(),
      lease_until=now()+interval '3 minutes',updated_at=now()
      WHERE id=$1 RETURNING id,museum_id,status,attempts,worker_token,run_date::text`,
    [next.rows[0].id, token]);
    await client.query('COMMIT');
    return claimed.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export type JobOutcome = { succeeded: boolean; retryable: boolean; durationMs: number; error: string };

export async function finishSourceJob(pool: pg.Pool, job: SourceJob, outcome: JobOutcome): Promise<boolean> {
  const duration = Math.max(0, Math.min(2_147_483_647, Math.floor(outcome.durationMs)));
  const retry = !outcome.succeeded && outcome.retryable && job.attempts < 3;
  const status = outcome.succeeded ? 'succeeded' : retry ? 'pending' : 'dead';
  const delay = retry ? retryDelaysMs[job.attempts - 1] : 0;
  const safeError = outcome.error.replace(/https?:\/\/\S+/g, '[網址]').slice(-1000);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(`UPDATE source_jobs SET status=$3,
      available_at=now()+($4::int * interval '1 millisecond'),
      lease_until=NULL,worker_token=NULL,started_at=NULL,
      last_error=$5,updated_at=now()
      WHERE id=$1 AND worker_token=$2 AND status='running' AND lease_until>now()
      RETURNING id`, [job.id, job.worker_token, status, delay,
      outcome.succeeded ? null : safeError || 'source import failed']);
    if (!updated.rows.length) { await client.query('ROLLBACK'); return false; }
    await client.query(`INSERT INTO sync_attempts
      (sync_id,museum_id,attempt_no,status,retryable,duration_ms,error_message)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [job.id, job.museum_id, job.attempts,
      outcome.succeeded ? 'succeeded' : 'failed', outcome.retryable, duration,
      outcome.succeeded ? null : safeError || 'source import failed']);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function replayDeadJob(pool: pg.Pool, id: string): Promise<string> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('工作 ID 無效');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const source = await client.query<{ museum_id: string; run_date: string }>(`
      SELECT museum_id,run_date::text FROM source_jobs WHERE id=$1 AND status='dead' FOR UPDATE`, [id]);
    if (!source.rows[0]) throw new Error('找不到可重跑的死信工作');
    const replay = await client.query<{ id: string }>(`INSERT INTO source_jobs
      (idempotency_key,museum_id,run_date,replay_of)
      VALUES ($1,$2,$3,$4) RETURNING id`,
    [`replay:${randomUUID()}`, source.rows[0].museum_id, source.rows[0].run_date, id]);
    await client.query('COMMIT');
    return replay.rows[0].id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
