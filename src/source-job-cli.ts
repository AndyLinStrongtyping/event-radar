import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';
import { isTransientSyncFailure } from './retry-policy.ts';
import { claimSourceJob, enqueueSourceJob, finishSourceJob,
  queuedSources, replayDeadJob, taiwanDate, type SourceJob } from './source-jobs.ts';

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at < 0 ? undefined : process.argv[at + 1];
}

async function runImport(job: SourceJob): Promise<{ succeeded: boolean; retryable: boolean; durationMs: number; error: string }> {
  const started = Date.now();
  const result = await new Promise<{ code: number; error: string; timedOut: boolean }>((resolve) => {
    const child = spawn(process.execPath,
      ['--experimental-strip-types', 'src/ingest.ts', '--source', job.museum_id, '--official'],
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
      clearTimeout(timer); resolve({ code: 1, error: cause.message, timedOut });
    });
    child.on('close', (code: number | null) => {
      clearTimeout(timer); resolve({ code: code ?? 1, error, timedOut });
    });
  });
  const error = result.timedOut ? `${result.error} timeout` : result.error;
  return { succeeded: result.code === 0 && !result.timedOut,
    retryable: result.timedOut || isTransientSyncFailure(error),
    durationMs: Date.now() - started, error };
}

if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');
const command = process.argv[2];
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  if (command === 'enqueue') {
    const source = arg('--source');
    const runDate = arg('--date') ?? taiwanDate();
    const sources: readonly string[] = source === 'all' ? queuedSources : source ? [source] : [];
    if (!sources.length) throw new Error('請指定 --source <館別|all>');
    const items = [];
    for (const item of sources) items.push({ source: item,
      ...await enqueueSourceJob(pool, item, runDate) });
    process.stdout.write(`${JSON.stringify({ runDate, items }, null, 2)}\n`);
  } else if (command === 'work') {
    const loop = process.argv.includes('--loop');
    do {
      const job = await claimSourceJob(pool, randomUUID());
      if (!job) {
        if (!loop) process.stdout.write('目前沒有可執行的來源工作。\n');
        else await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      process.stdout.write(`領取 ${job.museum_id} 工作 ${job.id}，第 ${job.attempts} 次。\n`);
      const outcome = await runImport(job);
      const recorded = await finishSourceJob(pool, job, outcome);
      if (!recorded) process.stderr.write(`工作 ${job.id} 租約已失效，結果未寫入；下次領取時會處理。\n`);
      else process.stdout.write(`工作 ${job.id} ${outcome.succeeded ? '成功' : '失敗'}；${outcome.retryable ? '可重試' : '不重試'}。\n`);
      if (!loop && (!recorded || !outcome.succeeded)) process.exitCode = 1;
    } while (loop);
  } else if (command === 'status') {
    const result = await pool.query(`SELECT id,museum_id AS "museumId",run_date AS "runDate",
      status,attempts,max_attempts AS "maxAttempts",available_at AS "availableAt",
      lease_until AS "leaseUntil",last_error AS "lastError",replay_of AS "replayOf"
      FROM source_jobs ORDER BY created_at DESC,id DESC LIMIT 100`);
    process.stdout.write(`${JSON.stringify({ items: result.rows,
      note: '只顯示最近 100 筆；pending 可待執行、running 有租約、dead 需人工確認再重播。' }, null, 2)}\n`);
  } else if (command === 'replay') {
    const id = arg('--id');
    if (!id) throw new Error('請指定 --id <死信工作 UUID>');
    const newId = await replayDeadJob(pool, id);
    process.stdout.write(`${JSON.stringify({ replayOf: id, id: newId,
      note: '已建立新工作；原死信與嘗試紀錄保留。請手動執行 jobs:work。' })}\n`);
  } else throw new Error('請指定 enqueue、work、status 或 replay');
} finally {
  await pool.end();
}
