import process from 'node:process';
import pg from 'pg';

const sourceIndex = process.argv.indexOf('--source');
const source = sourceIndex >= 0 ? process.argv[sourceIndex + 1] : null;
if (sourceIndex >= 0 && (!source || !/^[a-z0-9-]{1,50}$/.test(source))) {
  throw new Error('--source 需要有效館別 ID');
}
if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query(`SELECT museum_id AS "museumId",provider,source_key AS "sourceKey",
    source_url AS "sourceUrl",reason,
    COALESCE(raw_record->>'特展名稱',raw_record->>'title') AS title,
    first_seen_at AS "firstSeenAt",
    last_seen_at AS "lastSeenAt" FROM source_records
    WHERE status='review' AND ($1::text IS NULL OR museum_id=$1)
    ORDER BY last_seen_at DESC,museum_id,source_key LIMIT 200`, [source]);
  process.stdout.write(`${JSON.stringify({ items: result.rows,
    note: '僅本機待審清單；須回館方頁核對後，才可建立帶證據的修正。最多顯示 200 筆。' }, null, 2)}\n`);
} finally {
  await pool.end();
}
