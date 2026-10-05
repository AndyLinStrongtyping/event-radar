import process from 'node:process';
import pg from 'pg';
import { approveReview } from './review-service.ts';

function arg(name: string): string {
  const position = process.argv.indexOf(name);
  const value = position < 0 ? '' : process.argv[position + 1]?.trim();
  if (!value) throw new Error(`缺少 ${name}`);
  return value;
}

if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const correctionId = await approveReview(pool, {
    museum: arg('--source'), key: arg('--key'), startDate: arg('--start'),
    endDate: arg('--end'), evidenceUrl: arg('--evidence'), reviewer: arg('--reviewer'),
    note: arg('--note'),
  });
  process.stdout.write(`${JSON.stringify({ correctionId,
    message: '已留存人工核對證據；下次匯入相同原始紀錄時才會套用補正。' })}\n`);
} finally {
  await pool.end();
}
