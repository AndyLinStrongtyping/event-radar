import { spawn } from 'node:child_process';
import process from 'node:process';
import { isTransientSyncFailure, retryDelaysMs } from './retry-policy.ts';

const position = process.argv.indexOf('--source');
const source = position < 0 ? '' : process.argv[position + 1];
if (!['nmns', 'npm-south', 'npm-north', 'nmmba'].includes(source)) {
  throw new Error('用法：npm run sync -- --source <nmns|npm-south|npm-north|nmmba>');
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

for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
  const result = await runOnce();
  if (result.code === 0) process.exit(0);
  if (attempt === retryDelaysMs.length || !isTransientSyncFailure(result.error)) {
    process.stderr.write(`來源 ${source} 同步失敗；已嘗試 ${attempt + 1} 次。\n`);
    process.exit(1);
  }
  const delay = retryDelaysMs[attempt];
  process.stderr.write(`來源 ${source} 暫時失敗，${delay / 1000} 秒後重試。\n`);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
