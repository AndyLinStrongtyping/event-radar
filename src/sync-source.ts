import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';
import { isTransientSyncFailure, retryDelaysMs } from './retry-policy.ts';

const position = process.argv.indexOf('--source');
const source = position < 0 ? '' : process.argv[position + 1];
if (!['nmns', 'npm-south', 'npm-north', 'nmmba', 'nstm'].includes(source)) {
  throw new Error('用法：npm run sync -- --source <nmns|npm-south|npm-north|nmmba|nstm>');
}
const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL }) : null;
const syncId = randomUUID();

if (process.argv.includes('--failed-only')) {
  if (!pool) throw new Error('只重跑失敗來源需要 DATABASE_URL');
  const latest = await pool.query<{ status: string }>(
    `SELECT status FROM sync_attempts WHERE museum_id=$1
      ORDER BY created_at DESC,id DESC LIMIT 1`, [source]);
  if (!latest.rows.length || latest.rows[0].status !== 'failed') {
    process.stdout.write(`來源 ${source} 最近一次同步沒有失敗紀錄，無需重跑。\n`);
    await pool.end();
    process.exit(0);
  }
}

async function recordAttempt(attempt: number, status: 'succeeded' | 'failed',
  retryable: boolean, durationMs: number, error: string): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(`INSERT INTO sync_attempts
      (sync_id,museum_id,attempt_no,status,retryable,duration_ms,error_message)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [syncId, source, attempt, status, retryable, durationMs, error.slice(-1000) || null]);
  } catch (cause) {
    process.stderr.write(`同步嘗試紀錄寫入失敗：${cause instanceof Error ? cause.message : String(cause)}\n`);
  }
}

async function runOnce(): Promise<{ code: number; error: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath,
      ['--experimental-strip-types', 'src/ingest.ts', '--source', source, '--official'],
      { cwd: new URL('..', import.meta.url), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let error = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 90_000);
    child.stdout.on('data', (chunk: Buffer) => process.stdout.write(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      error = (error + chunk.toString()).slice(-4000);
      process.stderr.write(chunk);
    });
    child.on('error', (cause: Error) => {
      clearTimeout(timer);
      resolve({ code: 1, error: cause.message });
    });
    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, error: timedOut ? `${error} timeout` : error });
    });
  });
}

let exitCode = 1;
for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
  const started = Date.now();
  const result = await runOnce();
  const transient = isTransientSyncFailure(result.error);
  await recordAttempt(attempt + 1, result.code === 0 ? 'succeeded' : 'failed',
    transient, Date.now() - started, result.error);
  if (result.code === 0) { exitCode = 0; break; }
  if (attempt === retryDelaysMs.length || !transient) {
    process.stderr.write(`來源 ${source} 同步失敗；已嘗試 ${attempt + 1} 次。\n`);
    break;
  }
  const delay = retryDelaysMs[attempt];
  process.stderr.write(`來源 ${source} 暫時失敗，${delay / 1000} 秒後重試。\n`);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
if (pool) await pool.end();
process.exitCode = exitCode;
