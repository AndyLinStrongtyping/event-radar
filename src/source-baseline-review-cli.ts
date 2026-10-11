import process from 'node:process';
import pg from 'pg';
import { acceptBaselineCandidate, inspectBaselineCandidate } from './source-baseline-review.ts';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const action = process.argv[2];
const museum = arg('--source');
const provider = arg('--provider') || museum;
if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');
if (!museum || !provider || !['inspect', 'accept'].includes(action)) {
  throw new Error('用法：coverage:baseline inspect|accept --source <館別> [--provider <來源>]');
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  if (action === 'inspect') {
    process.stdout.write(`${JSON.stringify(await inspectBaselineCandidate(pool, museum, provider), null, 2)}\n`);
  } else {
    const runId = arg('--run');
    const evidenceUrl = arg('--evidence');
    const reviewer = arg('--reviewer');
    const note = arg('--note');
    if (!runId || !evidenceUrl || !reviewer || !note) {
      throw new Error('核准需提供 --run、--evidence 官方網址、--reviewer 與 --note；先執行 inspect');
    }
    const id = await acceptBaselineCandidate(pool, { museum, provider, runId,
      evidenceUrl, reviewer, note });
    process.stdout.write(`${JSON.stringify({ reviewId: id, runId,
      note: '僅更新清單比較基準，未變更展覽公開狀態；下次成功的官方同步才會重新評估完整度與缺席候選。' })}\n`);
  }
} finally { await pool.end(); }
