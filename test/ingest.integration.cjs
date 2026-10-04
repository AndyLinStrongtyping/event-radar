const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFile, writeFile, mkdtemp, unlink, rmdir } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const pg = require('pg');

if (!process.env.DATABASE_URL) throw new Error('整合測試需要 DATABASE_URL');
const project = resolve(__dirname, '..');
const testDbName = `event_radar_it_${Date.now().toString(36)}`;
const maintenanceUrl = new URL(process.env.DATABASE_URL);
maintenanceUrl.pathname = '/postgres';
const testUrl = new URL(process.env.DATABASE_URL);
testUrl.pathname = `/${testDbName}`;
const maintenance = new pg.Pool({ connectionString: maintenanceUrl.href });
const files = [];
let testDb;
let directory;
let created = false;

function ingest(file, provider) {
  const args = ['--experimental-strip-types', 'src/ingest.ts', '--source', 'chimei', '--file', file];
  if (provider) args.push('--provider', provider);
  return execFileSync(process.execPath, args, {
    cwd: project, env: { ...process.env, DATABASE_URL: testUrl.href },
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function fixture(name, value) {
  const path = join(directory, name);
  files.push(path);
  await writeFile(path, JSON.stringify(value), 'utf8');
  return path;
}

async function main() {
  await maintenance.query(`CREATE DATABASE "${testDbName}"`);
  created = true;
  testDb = new pg.Pool({ connectionString: testUrl.href });
  await testDb.query(await readFile(join(project, 'db/001_init.sql'), 'utf8'));
  await testDb.query(await readFile(join(project, 'db/002_sources_and_changes.sql'), 'utf8'));
  directory = await mkdtemp(join(tmpdir(), 'event-radar-it-'));
  const [original] = JSON.parse(await readFile(join(project, 'test/fixtures/chimei.json'), 'utf8'));

  const originalFile = await fixture('original.json', [original]);
  ingest(originalFile);
  ingest(originalFile);
  let result = await testDb.query('SELECT count(*)::int AS count FROM exhibitions');
  assert.equal(result.rows[0].count, 1, '同來源重跑不可重複新增');

  const invalidFile = await fixture('invalid.json', [original, { ...original, endDate: 'bad-date' }]);
  assert.throws(() => ingest(invalidFile), /Command failed/);
  result = await testDb.query('SELECT status FROM ingestion_runs ORDER BY started_at DESC LIMIT 1');
  assert.equal(result.rows[0].status, 'failed', '任何錯誤資料都要標記整批失敗');
  result = await testDb.query('SELECT count(*)::int AS count FROM exhibitions');
  assert.equal(result.rows[0].count, 1, '失敗批次不可留下部分寫入');

  const duplicateFile = await fixture('duplicate.json', [{
    ...original, sourceUrl: 'https://www.chimeimuseum.org/special-exhibition/alternate',
  }]);
  const linked = JSON.parse(ingest(duplicateFile, 'culture'));
  assert.equal(linked.linked, 1, '第二來源應連到既有展覽');
  result = await testDb.query('SELECT count(*)::int AS count FROM exhibitions');
  assert.equal(result.rows[0].count, 1);
  result = await testDb.query('SELECT count(*)::int AS count FROM exhibition_sources');
  assert.equal(result.rows[0].count, 2);

  const changedFile = await fixture('changed.json', [{ ...original, endDate: '2027-01-11' }]);
  ingest(changedFile);
  result = await testDb.query(`SELECT field_name,old_value,new_value FROM exhibition_changes
    ORDER BY id DESC LIMIT 1`);
  assert.deepEqual(result.rows[0], {
    field_name: 'endDate', old_value: '2027-01-10', new_value: '2027-01-11',
  });
  process.stdout.write('匯入回滾、同源與跨來源去重、欄位異動紀錄：通過\n');
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
}).finally(async () => {
  if (testDb) await testDb.end();
  if (created) await maintenance.query(`DROP DATABASE "${testDbName}" WITH (FORCE)`);
  await maintenance.end();
  for (const path of files) await unlink(path);
  if (directory) await rmdir(directory);
});
