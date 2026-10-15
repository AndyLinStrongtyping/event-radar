import process from 'node:process';
import pg from 'pg';
import { reviewNttSession, type ReviewedSessionStatus } from './performance-session-review.ts';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

if (!process.env.DATABASE_URL) throw new Error('需要 DATABASE_URL');
const action = process.argv[2];
const sourceKey = arg('--source-key');
const startsAt = arg('--starts-at');
const status = arg('--status');
const evidenceUrl = arg('--evidence');
const reviewer = arg('--reviewer');
const note = arg('--note');
if (action !== 'pending' && action !== 'set') {
  throw new Error('用法：review:performance -- pending | set --source-key <來源鍵> --starts-at <含時區 ISO 時間> --status <scheduled|sold_out|cancelled|postponed|unknown> --evidence <館方網址> --reviewer <核對者> --note <20–500 字>');
}
if (action === 'set' && (!sourceKey || !startsAt || !status || !evidenceUrl || !reviewer || !note)) {
  throw new Error('逐場核對需提供 --source-key、--starts-at、--status、--evidence、--reviewer、--note');
}
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL});
try {
  if (action === 'pending') {
    const pending = await pool.query(`SELECT d.source_key AS "sourceKey",d.title,
      d.source_url AS "sourceUrl",s.session_key AS "sessionKey",
      s.starts_at AS "startsAt" FROM event_sessions s
      JOIN domain_events d ON d.id=s.event_id
      WHERE d.source_id='ntt' AND s.status='unknown' AND s.starts_at >= now()
      ORDER BY s.starts_at,d.source_key LIMIT 100`);
    process.stdout.write(`${JSON.stringify({items:pending.rows,limit:100})}\n`);
  } else {
    const result = await reviewNttSession(pool,{sourceKey:sourceKey!,startsAt:startsAt!,
      status:status as ReviewedSessionStatus,evidenceUrl:evidenceUrl!,reviewer:reviewer!,note:note!});
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
} finally { await pool.end(); }
