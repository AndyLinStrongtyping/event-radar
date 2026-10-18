import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backupDir = resolve(process.env.EVENT_RADAR_BACKUP_DIR || join(root, 'private', 'backups'));
const requiredTables = ['schema_migrations', 'museums', 'exhibitions', 'ingestion_runs'];

export function connectionParts(connectionString) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error('DATABASE_URL 必須是完整的 PostgreSQL 連線網址');
  }
  return {
    host: url.hostname,
    port: url.port || '5432',
    database: decodeURIComponent(url.pathname.slice(1)),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    sslMode: url.searchParams.get('sslmode') || 'prefer',
    channelBinding: url.searchParams.get('channel_binding') || 'prefer',
  };
}

export function assertRestoreTarget(sourceUrl, targetUrl) {
  const source = connectionParts(sourceUrl);
  const target = connectionParts(targetUrl);
  if (!/^event_radar_restore_[a-z0-9_]+$/.test(target.database)) {
    throw new Error('還原驗證只能使用 event_radar_restore_* 命名的隔離資料庫');
  }
  if (source.host === target.host && source.port === target.port && source.database === target.database) {
    throw new Error('還原目標不可與來源資料庫相同');
  }
  return target;
}

function pgEnvironment(parts, passwordOverride) {
  return {
    ...process.env,
    PGHOST: parts.host,
    PGPORT: parts.port,
    PGDATABASE: parts.database,
    PGUSER: parts.user,
    PGPASSWORD: passwordOverride || parts.password,
    PGSSLMODE: parts.sslMode,
    PGCHANNELBINDING: parts.channelBinding,
  };
}

async function run(binary, args, env) {
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(binary, args, { env, stdio: 'ignore', windowsHide: true, timeout: 180_000 });
    child.once('error', rejectRun);
    child.once('close', (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${binary} 失敗（exit=${code ?? 'none'}, signal=${signal ?? 'none'}）；請確認工具版本、連線及權限`));
    });
  });
}

async function checksum(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function backup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('缺少 DATABASE_URL');
  const source = connectionParts(connectionString);
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const file = join(backupDir, `event-radar-${stamp}-${randomBytes(4).toString('hex')}.dump`);
  try {
    await run(process.env.PG_DUMP_BIN || 'pg_dump',
      ['--format=custom', '--no-owner', '--no-acl', `--file=${file}`, source.database],
      pgEnvironment(source, process.env.PGPASSWORD));
    await chmod(file, 0o600);
    const { size } = await stat(file);
    if (size === 0) throw new Error('備份檔為空');
    process.stdout.write(`備份完成：${relative(root, file)}（${size} bytes，SHA-256 ${await checksum(file)}）\n`);
    return file;
  } catch (error) {
    await rm(file, { force: true });
    throw error;
  }
}

export async function restoreCheck(input) {
  if (!process.env.DATABASE_URL || !process.env.RESTORE_DATABASE_URL) {
    throw new Error('還原驗證需要 DATABASE_URL 與 RESTORE_DATABASE_URL');
  }
  if (!input) throw new Error('請指定 private/backups/ 內的 .dump 備份檔');
  const target = assertRestoreTarget(process.env.DATABASE_URL, process.env.RESTORE_DATABASE_URL);
  const file = resolve(root, input);
  if (!file.startsWith(`${backupDir}${sep}`) || !file.endsWith('.dump')) {
    throw new Error('僅接受 private/backups/ 內的 .dump 備份檔');
  }
  await stat(file);
  const client = new pg.Client({ connectionString: process.env.RESTORE_DATABASE_URL });
  await client.connect();
  try {
    const existing = await client.query(`SELECT count(*)::int AS count FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')`);
    if (existing.rows[0].count !== 0) throw new Error('隔離還原資料庫不是空白，拒絕覆寫');
  } finally {
    await client.end();
  }
  await run(process.env.PG_RESTORE_BIN || 'pg_restore',
    ['--exit-on-error', '--single-transaction', '--no-owner', '--no-acl', '--dbname', target.database, file],
    pgEnvironment(target));
  const restored = new pg.Client({ connectionString: process.env.RESTORE_DATABASE_URL });
  await restored.connect();
  try {
    const result = {};
    for (const table of requiredTables) {
      const { rows } = await restored.query(`SELECT count(*)::int AS count FROM ${table}`);
      result[table] = rows[0].count;
    }
    process.stdout.write(`隔離資料庫還原成功：${JSON.stringify(result)}；備份 SHA-256 ${await checksum(file)}\n`);
  } finally {
    await restored.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, input, ...extra] = process.argv.slice(2);
  if (extra.length || !['backup', 'restore-check'].includes(command)) {
    process.stderr.write('用法：npm run backup:db，或 npm run restore:check -- private/backups/<檔案>.dump\n');
    process.exitCode = 1;
  } else {
    try {
      if (command === 'backup') await backup();
      else await restoreCheck(input);
    } catch (error) {
      process.stderr.write(`資料庫備份／還原驗證失敗：${error.code === 'ENOENT' ? '找不到 PostgreSQL 用戶端工具（pg_dump／pg_restore）' : error.message}\n`);
      process.exitCode = 1;
    }
  }
}
