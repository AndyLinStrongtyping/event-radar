import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--baseline-existing') || args.length > 1) {
  throw new Error('只支援 --baseline-existing，供既有且已更新至最新結構的資料庫使用');
}
const baselineExisting = args.includes('--baseline-existing');
const files = (await readdir(new URL('../db/', import.meta.url)))
  .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/.test(file)).sort();
if (!files.length || files[0] !== '001_init.sql') throw new Error('找不到初始 migration');
const migrations = await Promise.all(files.map(async (file) => {
  const sql = await readFile(new URL(`../db/${file}`, import.meta.url), 'utf8');
  return { file, sql, checksum: createHash('sha256').update(sql).digest('hex') };
}));

// 001 的館所參考列是必要資料；不將模擬展覽寫進正式環境。
const requiredColumns: Record<string, string[]> = {
  museums: ['id', 'source_status', 'last_official_success_at'],
  exhibitions: ['id', 'primary_provider', 'visible'],
  ingestion_runs: ['id', 'review_count', 'missing_count', 'coverage_status', 'coverage_baseline_row_count', 'source_identity_keys'],
  exhibition_sources: ['museum_id', 'provider', 'source_key', 'exhibition_id'],
  exhibition_changes: ['id', 'exhibition_id', 'field_name'],
  source_records: ['museum_id', 'provider', 'source_key', 'status'],
  review_corrections: ['id', 'source_hash', 'source_url'],
  sync_attempts: ['id', 'museum_id', 'status'],
  source_missing_candidates: ['museum_id', 'source_key', 'reviewed_missed_runs'],
  source_missing_reviews: ['id', 'observed_missed_runs', 'decision'],
  source_jobs: ['id', 'idempotency_key', 'worker_token'],
  official_source_baselines: ['museum_id', 'provider', 'row_count', 'identity_keys'],
  source_baseline_reviews: ['id', 'ingestion_run_id', 'evidence_url'],
  programme_events: ['id', 'museum_id', 'source_type', 'source_event_id', 'raw_date', 'schedule_type'],
  programme_event_changes: ['id', 'event_id', 'field_name'],
};
const requiredIndexes = [
  'exhibitions_source_identity', 'exhibitions_dates_idx', 'exhibitions_title_idx',
  'source_records_review_idx', 'source_jobs_due_idx', 'source_jobs_expired_idx',
  'programme_events_source_identity', 'programme_event_changes_event_idx',
];

function migrationBody(sql: string): string {
  // 舊腳本自行包 BEGIN/COMMIT；交由 runner 包住 SQL 與帳本寫入，才會一起回滾。
  return sql.replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '');
}

async function verifyLegacySchema(client: pg.PoolClient): Promise<void> {
  const columns = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema()`);
  const found = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missing = Object.entries(requiredColumns).flatMap(([table, names]) =>
    names.filter((name) => !found.has(`${table}.${name}`)).map((name) => `${table}.${name}`));
  const indexes = await client.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname=current_schema()`);
  const indexNames = new Set(indexes.rows.map((row) => row.indexname));
  missing.push(...requiredIndexes.filter((name) => !indexNames.has(name)).map((name) => `index:${name}`));
  if (missing.length) {
    throw new Error(`既有資料庫尚未具備最新結構，拒絕登記基線：${missing.join(', ')}`);
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let client: pg.PoolClient | undefined;
try {
  client = await pool.connect();
  await client.query(`SELECT pg_advisory_lock(hashtext('event-radar-schema-migrations'))`);
  const ledgerExists = (await client.query<{ exists: string | null }>(
    `SELECT to_regclass('schema_migrations')::text AS exists`)).rows[0].exists !== null;
  const legacyExists = (await client.query<{ exists: string | null }>(
    `SELECT to_regclass('museums')::text AS exists`)).rows[0].exists !== null;

  if (!ledgerExists && legacyExists && !baselineExisting) {
    throw new Error('偵測到舊版資料庫且沒有 migration 帳本。先備份並確認已套用所有 migration，再執行 npm run migrate -- --baseline-existing');
  }
  if (baselineExisting && (ledgerExists || !legacyExists)) {
    throw new Error('--baseline-existing 只適用於已有結構、但沒有 migration 帳本的資料庫');
  }
  await client.query('BEGIN');
  try {
    if (baselineExisting) await verifyLegacySchema(client);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    if (baselineExisting) {
      for (const migration of migrations) {
        await client.query('INSERT INTO schema_migrations(filename,checksum) VALUES ($1,$2)',
          [migration.file, migration.checksum]);
      }
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }

  let applied = 0;
  for (const migration of migrations) {
    const recorded = await client.query<{ checksum: string }>(
      'SELECT checksum FROM schema_migrations WHERE filename=$1', [migration.file]);
    if (recorded.rows.length) {
      if (recorded.rows[0].checksum.trim() !== migration.checksum) {
        throw new Error(`${migration.file} 內容與已套用版本不同；不可修改舊 migration，請新增下一版`);
      }
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(migrationBody(migration.sql));
      await client.query('INSERT INTO schema_migrations(filename,checksum) VALUES ($1,$2)',
        [migration.file, migration.checksum]);
      await client.query('COMMIT');
      applied += 1;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  }
  process.stdout.write(`資料庫更新完成：新套用 ${applied} 份，共 ${migrations.length} 份\n`);
} finally {
  if (client) {
    try { await client.query(`SELECT pg_advisory_unlock(hashtext('event-radar-schema-migrations'))`); }
    finally { client.release(); }
  }
  await pool.end();
}
