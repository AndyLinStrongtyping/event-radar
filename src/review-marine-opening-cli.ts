import pg from 'pg';
import { reviewNmmbaOpening } from './marine-opening-review.ts';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('需要 DATABASE_URL');
  if (process.argv[2] !== 'set') throw new Error('用法：review:marine-opening -- set --date YYYY-MM-DD --status open|closed --evidence 官方網址 --reviewer 姓名 --note 核對說明 [--opens HH:MM --closes HH:MM]');
  const pool = new pg.Pool({connectionString:process.env.DATABASE_URL});
  try {
    const result = await reviewNmmbaOpening(pool,{
      date:arg('date') ?? '',status:arg('status') as 'open' | 'closed',
      opensAt:arg('opens'),closesAt:arg('closes'),evidenceUrl:arg('evidence') ?? '',
      reviewer:arg('reviewer') ?? '',note:arg('note') ?? '',
    });
    process.stdout.write(JSON.stringify({museum:'nmmba',date:arg('date'),...result})+'\n');
  } finally { await pool.end(); }
}

main().catch((error:unknown) => {
  process.stderr.write(`特殊開館核對失敗：${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
