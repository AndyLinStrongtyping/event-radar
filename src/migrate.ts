import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const file of ['002_sources_and_changes.sql', '003_source_review.sql',
    '004_review_corrections.sql', '005_sync_attempts.sql', '006_nstm.sql']) {
    await pool.query(await readFile(new URL(`../db/${file}`, import.meta.url), 'utf8'));
  }
  process.stdout.write('資料庫更新完成\n');
} finally {
  await pool.end();
}
