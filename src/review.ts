import process from 'node:process';
import pg from 'pg';

const sourceIndex = process.argv.indexOf('--source');
const source = sourceIndex >= 0 ? process.argv[sourceIndex + 1] : null;
const includeApproved = process.argv.includes('--all');
if (sourceIndex >= 0 && (!source || !/^[a-z0-9-]{1,50}$/.test(source))) {
  throw new Error('--source 需要有效館別 ID');
}
if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query(`SELECT s.museum_id AS "museumId",s.provider,
    s.source_key AS "sourceKey",s.source_url AS "sourceUrl",s.status,s.reason,
    COALESCE(s.raw_record->>'特展名稱',s.raw_record->>'title') AS title,
    s.first_seen_at AS "firstSeenAt",s.last_seen_at AS "lastSeenAt",
    c.evidence_url AS "evidenceUrl",c.reviewer,c.note AS "reviewNote",
    c.created_at AS "reviewedAt" FROM source_records s
    LEFT JOIN LATERAL (SELECT evidence_url,reviewer,note,created_at
      FROM review_corrections c WHERE c.museum_id=s.museum_id
        AND c.provider=s.provider AND c.source_key=s.source_key
      ORDER BY c.created_at DESC,c.id DESC LIMIT 1) c ON true
    WHERE (s.status='review' OR ($2::boolean AND s.status='approved'))
      AND ($1::text IS NULL OR s.museum_id=$1)
    ORDER BY s.last_seen_at DESC,s.museum_id,s.source_key LIMIT 200`, [source, includeApproved]);
  process.stdout.write(`${JSON.stringify({ items: result.rows,
    note: '僅本機待審清單；須回館方頁核對後，才可建立帶證據的修正。最多顯示 200 筆。' }, null, 2)}\n`);
} finally {
  await pool.end();
}
