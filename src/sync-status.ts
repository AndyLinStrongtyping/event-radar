import process from 'node:process';
import pg from 'pg';
import { loadSourceHealth } from './source-health-report.ts';

if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const items = await loadSourceHealth(pool);
  process.stdout.write(`${JSON.stringify({ items,
    note: '七日失敗率以每次 sync_id 的最終結果計算，重試不當成獨立工作；無紀錄不代表成功。健康狀態是本機資料來源提示，不代表館方展覽內容正確。' }, null, 2)}\n`);
} finally {
  await pool.end();
}
