import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(await readFile(new URL('../db/002_sources_and_changes.sql', import.meta.url), 'utf8'));
  process.stdout.write('資料庫更新完成\n');
} finally {
  await pool.end();
}
