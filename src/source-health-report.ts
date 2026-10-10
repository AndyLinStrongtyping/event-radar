import type pg from 'pg';
import { sourceHealth, type HealthState } from './source-health.ts';

type HealthRow = {
  museumId: string; name: string; sourceStatus: string;
  lastSuccessAt: Date | null; lastOfficialSuccessAt: Date | null;
  lastAttemptStatus: string | null; lastAttemptAt: Date | null;
  lastAttemptDurationMs: number | null; lastError: string | null;
  runs7d: number; failedRuns7d: number; retriedRuns7d: number;
  pendingReview: number; missingNeedsReview: number;
};

export type SourceHealthReport = HealthRow & {
  health: HealthState;
  failureRate7d: number | null;
};

export async function loadSourceHealth(pool: pg.Pool, now: Date = new Date()): Promise<SourceHealthReport[]> {
  const result = await pool.query<HealthRow>(`WITH final_attempts AS (
    SELECT DISTINCT ON (museum_id,sync_id)
      museum_id,sync_id,status,attempt_no,created_at
    FROM sync_attempts ORDER BY museum_id,sync_id,attempt_no DESC,id DESC
  ), seven_days AS (
    SELECT museum_id,count(*)::int AS runs,
      count(*) FILTER (WHERE status='failed')::int AS failures,
      count(*) FILTER (WHERE attempt_no>1)::int AS retries
    FROM final_attempts WHERE created_at>=now()-interval '7 days' GROUP BY museum_id
  )
  SELECT m.id AS "museumId",m.name,m.source_status AS "sourceStatus",
    m.last_success_at AS "lastSuccessAt",
    m.last_official_success_at AS "lastOfficialSuccessAt",
    latest.status AS "lastAttemptStatus",latest.created_at AS "lastAttemptAt",
    latest.duration_ms AS "lastAttemptDurationMs",latest.error_message AS "lastError",
    COALESCE(stats.runs,0)::int AS "runs7d",
    COALESCE(stats.failures,0)::int AS "failedRuns7d",
    COALESCE(stats.retries,0)::int AS "retriedRuns7d",
    COALESCE(review.pending,0)::int AS "pendingReview",
    COALESCE(missing.pending,0)::int AS "missingNeedsReview"
  FROM museums m
  LEFT JOIN LATERAL (SELECT status,created_at,duration_ms,error_message
    FROM sync_attempts WHERE museum_id=m.id ORDER BY created_at DESC,id DESC LIMIT 1) latest ON true
  LEFT JOIN seven_days stats ON stats.museum_id=m.id
  LEFT JOIN LATERAL (SELECT count(*) AS pending FROM source_records
    WHERE museum_id=m.id AND status='review') review ON true
  LEFT JOIN LATERAL (SELECT count(*) AS pending FROM source_missing_candidates
    WHERE museum_id=m.id AND status='pending' AND reviewed_missed_runs<missed_runs) missing ON true
  WHERE m.id IN ('nmns','npm-south','npm-north','nmmba','nstm') ORDER BY m.id`);
  return result.rows.map((row) => ({
    ...row,
    health: sourceHealth(row, now),
    failureRate7d: row.runs7d ? row.failedRuns7d / row.runs7d : null,
  }));
}
