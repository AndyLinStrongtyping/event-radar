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
  await testDb.query(await readFile(join(project, 'db/003_source_review.sql'), 'utf8'));
  await testDb.query(await readFile(join(project, 'db/004_review_corrections.sql'), 'utf8'));
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

  const seaSnapshot = await fixture('nmmba-snapshot.json', [
    { Source: 'https://www.nmmba.gov.tw/News_Content.aspx?n=3&s=good',
      '特展名稱': '海洋特展', '展出地點': '特展廳', 'app用開始時間': '1150618', 'app用結束時間': '1160301' },
    { Source: 'https://www.nmmba.gov.tw/News_Content.aspx?n=3&s=review',
      '特展名稱': '缺結束日展覽', '展出地點': '特展廳', 'app用開始時間': '2023-12-15', 'app用結束時間': '' },
  ]);
  const seaArgs = ['--experimental-strip-types', 'src/ingest.ts', '--source', 'nmmba', '--snapshot', seaSnapshot];
  const seaEnv = { ...process.env, DATABASE_URL: testUrl.href };
  const seaFirst = JSON.parse(execFileSync(process.execPath, seaArgs,
    { cwd: project, env: seaEnv, encoding: 'utf8' }));
  assert.equal(seaFirst.inserted, 1);
  assert.equal(seaFirst.review, 1);
  execFileSync(process.execPath, seaArgs, { cwd: project, env: seaEnv, encoding: 'utf8' });
  result = await testDb.query(`SELECT status,reason FROM source_records
    WHERE museum_id='nmmba' AND status='review'`);
  assert.equal(result.rows.length, 1);
  assert.match(result.rows[0].reason, /缺少展期/);
  result = await testDb.query("SELECT count(*)::int AS count FROM exhibitions WHERE museum_id='nmmba'");
  assert.equal(result.rows[0].count, 1, '重跑不得新增同一特展，也不得公開待審資料');
  const reviewOnly = await fixture('nmmba-review-only.json', [
    { Source: 'https://www.nmmba.gov.tw/News_Content.aspx?n=3&s=only-review',
      '特展名稱': '未確認展期', 'app用開始時間': '', 'app用結束時間': '' },
  ]);
  const reviewResult = JSON.parse(execFileSync(process.execPath,
    ['--experimental-strip-types', 'src/ingest.ts', '--source', 'nmmba', '--snapshot', reviewOnly],
    { cwd: project, env: seaEnv, encoding: 'utf8' }));
  assert.equal(reviewResult.inserted, 0);
  assert.equal(reviewResult.review, 1, '全部不合格時仍須保存待審原始資料');
  result = await testDb.query("SELECT count(*)::int AS count FROM exhibitions WHERE museum_id='nmmba'");
  assert.equal(result.rows[0].count, 1);
  const approvedUrl = 'https://www.nmmba.gov.tw/News_Content.aspx?n=3&s=only-review';
  execFileSync(process.execPath, ['--experimental-strip-types', 'src/approve-review.ts',
    '--source', 'nmmba', '--key', approvedUrl, '--start', '2026-09-01', '--end', '2026-12-31',
    '--evidence', approvedUrl, '--reviewer', 'integration-test', '--note', '館方詳情頁已核對展期'],
  { cwd: project, env: seaEnv, encoding: 'utf8' });
  const correctedRun = JSON.parse(execFileSync(process.execPath,
    ['--experimental-strip-types', 'src/ingest.ts', '--source', 'nmmba', '--snapshot', reviewOnly],
    { cwd: project, env: seaEnv, encoding: 'utf8' }));
  assert.equal(correctedRun.inserted, 1);
  result = await testDb.query("SELECT status FROM source_records WHERE museum_id='nmmba' AND source_key=$1", [approvedUrl]);
  assert.equal(result.rows[0].status, 'approved');
  result = await testDb.query('SELECT count(*)::int AS count FROM review_corrections');
  assert.equal(result.rows[0].count, 1, '人工核對必須留下證據及審查歷史');
  const changedReview = await fixture('nmmba-source-changed.json', [
    { Source: approvedUrl, '特展名稱': '來源已變更的展覽',
      'app用開始時間': '', 'app用結束時間': '' },
  ]);
  execFileSync(process.execPath,
    ['--experimental-strip-types', 'src/ingest.ts', '--source', 'nmmba', '--snapshot', changedReview],
    { cwd: project, env: seaEnv, encoding: 'utf8' });
  result = await testDb.query('SELECT visible FROM exhibitions WHERE museum_id=$1 AND source_url=$2',
    ['nmmba', approvedUrl]);
  assert.equal(result.rows[0].visible, false, '來源變更時舊人工補正不得繼續公開');
  const northSnapshot = await fixture('npm-north-snapshot.json', [
    { sno: '04014505', link: 'https://www.npm.gov.tw/Articles.aspx?sno=04014505',
      title: '故宮北院特展', time: '2026-05-09 ~ 2026-11-08', location: '北部院區　第一展覽館' },
    { sno: '04014534', link: 'https://www.npm.gov.tw/Articles.aspx?sno=04014534',
      title: '故宮南院特展', time: '2026-05-09 ~ 2026-11-08', location: '南部院區' },
    { sno: '04012832', link: 'https://www.npm.gov.tw/Articles.aspx?sno=04012832',
      title: '未有結束日的展示', time: '2021-12-24 ~ ', location: '北部院區' },
  ]);
  const northArgs = ['--experimental-strip-types', 'src/ingest.ts', '--source', 'npm-north',
    '--snapshot', northSnapshot];
  const northResult = JSON.parse(execFileSync(process.execPath, northArgs,
    { cwd: project, env: seaEnv, encoding: 'utf8' }));
  assert.equal(northResult.inserted, 1);
  assert.equal(northResult.skipped, 1);
  assert.equal(northResult.review, 1);
  result = await testDb.query("SELECT count(*)::int AS count FROM exhibitions WHERE museum_id='npm-north'");
  assert.equal(result.rows[0].count, 1);
  const northReview = await fixture('npm-north-review.json', [
    { sno: '04012832', link: 'https://www.npm.gov.tw/Articles.aspx?sno=04012832',
      title: '未有結束日的展示', time: '2021-12-24 ~ ', location: '北部院區' },
  ]);
  const northReviewArgs = ['--experimental-strip-types', 'src/ingest.ts', '--source', 'npm-north',
    '--snapshot', northReview];
  execFileSync(process.execPath, ['--experimental-strip-types', 'src/approve-review.ts',
    '--source', 'npm-north', '--key', '04012832', '--start', '2026-09-01',
    '--end', '2026-12-31', '--evidence', 'https://www.npm.gov.tw/Articles.aspx?sno=04012832',
    '--reviewer', 'integration-test', '--note', '館方展期已人工核對'],
  { cwd: project, env: seaEnv, encoding: 'utf8' });
  execFileSync(process.execPath, northReviewArgs, { cwd: project, env: seaEnv, encoding: 'utf8' });
  result = await testDb.query("SELECT visible FROM exhibitions WHERE museum_id='npm-north' AND source_key='04012832'");
  assert.equal(result.rows[0].visible, true);
  const northChangedLink = await fixture('npm-north-changed-link.json', [
    { sno: '04012832', link: 'https://www.npm.gov.tw/Articles.aspx?sno=04012833',
      title: '未有結束日的展示', time: '2021-12-24 ~ ', location: '北部院區' },
  ]);
  execFileSync(process.execPath,
    ['--experimental-strip-types', 'src/ingest.ts', '--source', 'npm-north', '--snapshot', northChangedLink],
    { cwd: project, env: seaEnv, encoding: 'utf8' });
  result = await testDb.query("SELECT visible FROM exhibitions WHERE museum_id='npm-north' AND source_key='04012832'");
  assert.equal(result.rows[0].visible, false, '館方連結改變時舊補正展覽必須隱藏');
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
