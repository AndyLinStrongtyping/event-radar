import { spawnSync } from 'node:child_process';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('首次部署需要 DATABASE_URL');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function publicUpcomingCount() {
  const result = await pool.query(`SELECT count(*)::int AS count FROM exhibitions
    WHERE visible = TRUE AND is_sample = FALSE
      AND end_date >= (now() AT TIME ZONE 'Asia/Taipei')::date`);
  return result.rows[0].count;
}

try {
  if (await publicUpcomingCount() > 0) {
    process.stdout.write('已有可展示的限期展，略過首次匯入。\n');
  } else {
    for (const source of ['npm-north', 'nstm', 'npm-south']) {
      process.stdout.write(`首次匯入官方來源：${source}\n`);
      const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['run', 'sync', '--', '--source', source],
        { stdio: 'inherit', env: process.env, timeout: 360_000 });
      if (result.error) process.stderr.write(`${source} 執行失敗：${result.error.message}\n`);
      if (result.status !== 0) process.stderr.write(`${source} 未成功，嘗試下一來源。\n`);
      if (await publicUpcomingCount() > 0) break;
    }
    if (await publicUpcomingCount() === 0) {
      throw new Error('官方來源未匯入可展示的限期展，拒絕發布空白預覽站');
    }
  }
  process.stdout.write(`首次資料檢查通過：${await publicUpcomingCount()} 筆可展示限期展。\n`);
} finally {
  await pool.end();
}
