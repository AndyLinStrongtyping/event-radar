import process from 'node:process';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query(`SELECT m.id AS "museumId",m.name,
    m.last_success_at AS "lastSuccessAt",
    latest.status AS "lastAttemptStatus",latest.created_at AS "lastAttemptAt",
    latest.duration_ms AS "lastAttemptDurationMs",latest.error_message AS "lastError",
    COALESCE(stats.attempts,0)::int AS "attempts7d",
    COALESCE(stats.failures,0)::int AS "failures7d",
    COALESCE(stats.retries,0)::int AS "retries7d",
    COALESCE(review.pending,0)::int AS "pendingReview"
    FROM museums m
    LEFT JOIN LATERAL (SELECT status,created_at,duration_ms,error_message
      FROM sync_attempts WHERE museum_id=m.id ORDER BY created_at DESC,id DESC LIMIT 1) latest ON true
    LEFT JOIN LATERAL (SELECT count(*) AS attempts,
      count(*) FILTER (WHERE status='failed') AS failures,
      count(*) FILTER (WHERE attempt_no>1) AS retries
      FROM sync_attempts WHERE museum_id=m.id AND created_at>=now()-interval '7 days') stats ON true
    LEFT JOIN LATERAL (SELECT count(*) AS pending FROM source_records
      WHERE museum_id=m.id AND status='review') review ON true
    WHERE m.id IN ('nmns','npm-south','npm-north','nmmba','nstm') ORDER BY m.id`);
  process.stdout.write(`${JSON.stringify({ items: result.rows,
    note: '最近七天是本機 sync 嘗試統計；沒有紀錄不代表成功。資料集本身不一定每日更新。' }, null, 2)}\n`);
} finally {
  await pool.end();
}
