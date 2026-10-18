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
  archive = await backup();
  await restoreCheck(archive);

  const restored = new pg.Client({ connectionString: targetUrl.toString() });
  await restored.connect();
  try {
    for (const table of ['schema_migrations', 'museums', 'exhibitions', 'ingestion_runs']) {
      const originalCount = await admin.query(`SELECT count(*)::int AS count FROM ${table}`);
      const restoredCount = await restored.query(`SELECT count(*)::int AS count FROM ${table}`);
      assert.equal(restoredCount.rows[0].count, originalCount.rows[0].count, `${table} 筆數不同`);
    }
  } finally {
    await restored.end();
  }
  process.stdout.write('備份與隔離還原資料表筆數一致。\n');
} finally {
  await admin.query(`DROP DATABASE IF EXISTS ${targetName} WITH (FORCE)`);
  await admin.end();
  if (archive) await rm(archive, { force: true });
}
