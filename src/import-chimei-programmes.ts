import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { importChimeiProgrammeSnapshot } from './chimei-programmes.ts';
import type { ChimeiActivitySnapshot } from './sources/chimei-activities.ts';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');
  const snapshot = JSON.parse(await readFile(new URL('../data/chimei-activities.json', import.meta.url), 'utf8')) as ChimeiActivitySnapshot;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await importChimeiProgrammeSnapshot(pool, snapshot);
    process.stdout.write(`奇美活動候選匯入：新增 ${result.inserted}、異動 ${result.updated}、未變 ${result.unchanged}；來源清單消失項目未自動刪除\n`);
  } finally { await pool.end(); }
}

main().catch((error: unknown) => {
  process.stderr.write(`奇美活動候選匯入失敗：${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
