import process from 'node:process';
import pg from 'pg';
import { correctedDraft, sourceHash } from './corrections.ts';

function arg(name: string): string {
  const position = process.argv.indexOf(name);
  const value = position < 0 ? '' : process.argv[position + 1]?.trim();
  if (!value) throw new Error(`缺少 ${name}`);
  return value;
}

const museum = arg('--source');
const key = arg('--key');
const startDate = arg('--start');
const endDate = arg('--end');
const evidenceUrl = arg('--evidence');
const reviewer = arg('--reviewer');
const note = arg('--note');
if (!['nmmba', 'npm-north'].includes(museum)) throw new Error('此來源尚不支援人工補正');
if (reviewer.length > 100 || note.length > 500 || evidenceUrl.length > 1000) {
  throw new Error('審查欄位過長');
}
if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [museum]);
  const result = await client.query<{ raw_record: Record<string, unknown>; status: string; source_url: string | null }>(
    `SELECT raw_record,status,source_url FROM source_records
      WHERE museum_id=$1 AND provider=$1 AND source_key=$2 FOR UPDATE`, [museum, key]);
  if (result.rows.length !== 1 || !['review', 'approved'].includes(result.rows[0].status)) {
    throw new Error('找不到可補正的待審來源紀錄');
  }
  const raw = result.rows[0].raw_record;
  correctedDraft(museum, raw, startDate, endDate, evidenceUrl);
  const inserted = await client.query<{ id: string }>(`INSERT INTO review_corrections
    (museum_id,provider,source_key,source_hash,source_url,start_date,end_date,evidence_url,reviewer,note)
    VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
  [museum, key, sourceHash(raw), result.rows[0].source_url,
    startDate, endDate, evidenceUrl, reviewer, note]);
  await client.query('COMMIT');
  process.stdout.write(`${JSON.stringify({ correctionId: inserted.rows[0].id,
    message: '已留存人工核對證據；下次匯入相同原始紀錄時才會套用補正。' })}\n`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
