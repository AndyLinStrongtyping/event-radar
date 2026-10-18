import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { rm } from 'node:fs/promises';
import pg from 'pg';
import { backup, restoreCheck } from '../scripts/db-backup.mjs';

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error('備份整合測試需要 DATABASE_URL');
const source = new URL(sourceUrl);
if (!['localhost', '127.0.0.1', '::1'].includes(source.hostname)) {
  throw new Error('備份整合測試只能對本機 PostgreSQL 執行');
}
const targetName = `event_radar_restore_ci_${randomBytes(4).toString('hex')}`;
const targetUrl = new URL(sourceUrl);
targetUrl.pathname = `/${targetName}`;
const admin = new pg.Client({ connectionString: sourceUrl });
let archive;
await admin.connect();
try {
  await admin.query(`CREATE DATABASE ${targetName}`);
  process.env.RESTORE_DATABASE_URL = targetUrl.toString();
  const exhibition = await admin.query(`INSERT INTO exhibitions
    (museum_id, source_key, primary_provider, title, start_date, end_date, source_url, content_hash, is_sample, visible)
    VALUES ('nmns', $1, 'nmns', 'CI 備份還原測試展覽', DATE '2026-10-18', DATE '2026-10-19',
      'https://example.org/backup-fixture', repeat('a', 64), true, false) RETURNING id`, [targetName]);
  const run = await admin.query(`INSERT INTO ingestion_runs (museum_id, status, fetched_count, inserted_count)
    VALUES ('nmns', 'succeeded', 1, 1) RETURNING id`);
  await admin.query(`INSERT INTO exhibition_sources (museum_id, provider, source_key, exhibition_id)
    VALUES ('nmns', 'nmns', $1, $2)`, [targetName, exhibition.rows[0].id]);
  await admin.query(`INSERT INTO exhibition_changes (exhibition_id, ingestion_run_id, field_name, old_value, new_value)
    VALUES ($1, $2, 'title', NULL, 'CI 備份還原測試展覽')`, [exhibition.rows[0].id, run.rows[0].id]);
  archive = await backup();
  await restoreCheck(archive);

  const restored = new pg.Client({ connectionString: targetUrl.toString() });
  await restored.connect();
  try {
    for (const table of ['schema_migrations', 'museums', 'exhibitions', 'ingestion_runs',
      'exhibition_sources', 'exhibition_changes']) {
      const originalCount = await admin.query(`SELECT count(*)::int AS count FROM ${table}`);
      const restoredCount = await restored.query(`SELECT count(*)::int AS count FROM ${table}`);
      assert.equal(restoredCount.rows[0].count, originalCount.rows[0].count, `${table} 筆數不同`);
    }
    const linked = await restored.query(`SELECT e.title, s.source_key, c.new_value
      FROM exhibitions e
      JOIN exhibition_sources s ON s.exhibition_id=e.id
      JOIN exhibition_changes c ON c.exhibition_id=e.id
      WHERE e.source_key=$1`, [targetName]);
    assert.deepEqual(linked.rows, [{
      title: 'CI 備份還原測試展覽', source_key: targetName, new_value: 'CI 備份還原測試展覽',
    }]);
  } finally {
    await restored.end();
  }
  process.stdout.write('備份與隔離還原資料表筆數一致。\n');
} finally {
  await admin.query(`DROP DATABASE IF EXISTS ${targetName} WITH (FORCE)`);
  await admin.end();
  if (archive) await rm(archive, { force: true });
}
