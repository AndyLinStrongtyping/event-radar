const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
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

function assertExhibition(value) {
  assert.equal(typeof value.id, 'string');
  assert.match(value.id, /^[0-9a-f-]{36}$/i);
  for (const field of ['title', 'museumId', 'museumName', 'city', 'sourceStatus', 'sourceUrl', 'startDate', 'endDate', 'lastSeenAt']) {
    assert.equal(typeof value[field], 'string', `${field} 必須是字串`);
  }
  for (const field of ['venue', 'priceNote', 'summary']) {
    assert.ok(value[field] === null || typeof value[field] === 'string', `${field} 必須是字串或 null`);
  }
  assert.match(value.startDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(value.endDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(value.endDate >= value.startDate);
  assert.equal(typeof value.isSample, 'boolean');
  assert.ok(['ongoing', 'upcoming', 'ended'].includes(value.exhibitionStatus));
  assert.ok(['free', 'unknown'].includes(value.admissionStatus));
  assert.match(value.sourceUrl, /^https:\/\//);
  assert.ok(!Number.isNaN(Date.parse(value.lastSeenAt)));
}

async function checkPublicApiContract() {
  const port = 33000 + Math.floor(Math.random() * 2000);
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['--experimental-strip-types', 'src/server.ts'], {
    cwd: project, env: { ...process.env, DATABASE_URL: testUrl.href, PORT: String(port), NMNS_API_KEY: '' },
    stdio: 'ignore',
  });
  async function get(path, status = 200) {
    const response = await fetch(base + path);
    assert.equal(response.status, status, `${path} 應回傳 ${status}`);
    assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
    return response.json();
  }
  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { await get('/health'); ready = true; break; }
      catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
    }
    assert.equal(ready, true, '公開 API 應可啟動並連接測試資料庫');
    assert.deepEqual(await get('/health'), { status: 'ok', database: 'ok' });

    const museums = await get('/museums');
    assert.ok(Array.isArray(museums.items) && museums.items.length > 0);
    for (const museum of museums.items) {
      for (const field of ['id', 'name', 'city', 'homepageUrl', 'sourceStatus']) {
        assert.equal(typeof museum[field], 'string', `museum.${field} 必須是字串`);
      }
      assert.ok(museum.lastSuccessAt === null || !Number.isNaN(Date.parse(museum.lastSuccessAt)));
    }

    const list = await get('/exhibitions?from=2026-01-01&to=2027-12-31&museum=chimei&limit=2');
    assert.equal(typeof list.total, 'number');
    assert.equal(list.limit, 2);
    assert.equal(list.offset, 0);
    assert.ok(Array.isArray(list.items) && list.items.length > 0);
    assert.ok(list.items.length <= list.limit);
    list.items.forEach(assertExhibition);
    assert.ok(list.items.every((item) => item.museumId === 'chimei' && !item.isSample));

    const detail = await get(`/exhibitions/${list.items[0].id}`);
    assertExhibition(detail);
    assert.deepEqual(detail, list.items[0], '清單與詳情的 Exhibition 格式需一致');
    const changes = await get(`/exhibitions/${detail.id}/changes`);
    assert.ok(Array.isArray(changes.items));
    assert.ok(changes.items.length > 0, '測試資料須有可驗證的異動紀錄');
    for (const change of changes.items) {
      assert.equal(typeof change.field, 'string');
      assert.ok(change.oldValue === null || typeof change.oldValue === 'string');
      assert.ok(change.newValue === null || typeof change.newValue === 'string');
      assert.ok(!Number.isNaN(Date.parse(change.detectedAt)));
    }

    const empty = await get('/exhibitions?from=2026-01-01&museum=chimei&q=___no_such_exhibition___');
    assert.deepEqual(empty.items, []);
    assert.equal(empty.total, 0);
    for (const [status, title] of [
      ['ended', '測試已結束'], ['ongoing', '測試展出中'], ['upcoming', '測試即將開始'],
    ]) {
      const result = await get(`/exhibitions?museum=chimei&includeSample=true&asOf=2026-10-05&status=${status}&admission=free&q=${encodeURIComponent(title)}`);
      assert.equal(result.total, 1, `${status} 且明確免費的測試展覽應可搜尋`);
      assert.equal(result.items[0].exhibitionStatus, status);
      assert.equal(result.items[0].admissionStatus, 'free');
      const hidden = await get(`/exhibitions?museum=chimei&asOf=2026-10-05&status=${status}&admission=free&q=${encodeURIComponent(title)}`);
      assert.equal(hidden.total, 0, '未要求模擬資料時不得公開測試展覽');
    }
    const unknownPrice = await get('/exhibitions?museum=chimei&asOf=2026-10-05&admission=free&q=___no_such_exhibition___');
    assert.equal(unknownPrice.total, 0);
    const visit = await get('/visit-status?museum=chimei&date=2026-10-07');
    assert.equal(visit.museumId, 'chimei');
    assert.equal(visit.date, '2026-10-07');
    assert.ok(['open', 'closed', 'unknown'].includes(visit.status));
    assert.equal(typeof visit.message, 'string');
    assert.match(visit.sourceUrl, /^https:\/\//);

    for (const path of ['/exhibitions?limit=0', '/exhibitions?from=2026-02-30',
      '/exhibitions?status=invalid', '/exhibitions?admission=invalid', '/exhibitions?asOf=2026-02-30',
      '/visit-status?museum=chimei&date=bad']) {
      const error = await get(path, 400);
      assert.equal(error.error.code, 'BAD_REQUEST');
      assert.equal(typeof error.error.message, 'string');
    }
    const missing = await get('/exhibitions/00000000-0000-0000-0000-000000000000', 404);
    assert.equal(missing.error.code, 'NOT_FOUND');
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill();
      await exited;
    }
  }
}

async function main() {
  await maintenance.query(`CREATE DATABASE "${testDbName}"`);
  created = true;
  testDb = new pg.Pool({ connectionString: testUrl.href });
  await testDb.query(await readFile(join(project, 'db/001_init.sql'), 'utf8'));
  await testDb.query(await readFile(join(project, 'db/002_sources_and_changes.sql'), 'utf8'));
  await testDb.query(await readFile(join(project, 'db/003_source_review.sql'), 'utf8'));
  await testDb.query(await readFile(join(project, 'db/004_review_corrections.sql'), 'utf8'));
  await testDb.query(await readFile(join(project, 'db/005_sync_attempts.sql'), 'utf8'));
  await testDb.query(await readFile(join(project, 'db/006_nstm.sql'), 'utf8'));
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
  const adminPort = 31000 + Math.floor(Math.random() * 2000);
  const adminBase = `http://127.0.0.1:${adminPort}`;
  const admin = spawn(process.execPath, ['--experimental-strip-types', 'src/admin-server.ts'], {
    cwd: project, env: { ...seaEnv, EVENT_RADAR_ADMIN_PASSWORD: 'test-admin-password-24-characters', ADMIN_PORT: String(adminPort) },
    stdio: 'ignore',
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try { await fetch(adminBase); ready = true; break; } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
    }
    assert.equal(ready, true, '本機審核服務應可啟動');
    let response = await fetch(`${adminBase}/record?museum=nmmba&key=secret`);
    assert.equal(response.status, 401, '未登入不能讀取審核紀錄');
    response = await fetch(`${adminBase}/login`, { method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'password=test-admin-password-24-characters' });
    assert.equal(response.status, 403, '沒有同源 Origin 的 POST 必須拒絕');
    response = await fetch(`${adminBase}/login`, { method: 'POST',
      headers: { origin: adminBase, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'password=test-admin-password-24-characters' });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    response = await fetch(adminBase, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /待審來源紀錄/);
    response = await fetch(`${adminBase}/approve`, { method: 'POST',
      headers: { origin: adminBase, cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'csrf=wrong' });
    assert.equal(response.status, 403, '未持有有效 CSRF token 不能建立補正');
    response = await fetch(`${adminBase}/login`, { method: 'POST',
      headers: { origin: 'null', 'sec-fetch-site': 'same-origin',
        'content-type': 'application/x-www-form-urlencoded' },
      body: 'password=test-admin-password-24-characters' });
    assert.equal(response.status, 200, '同站點瀏覽器的 null Origin 表單可以登入');
    response = await fetch(`${adminBase}/login`, { method: 'POST',
      headers: { origin: 'null', 'sec-fetch-site': 'cross-site',
        'content-type': 'application/x-www-form-urlencoded' },
      body: 'password=test-admin-password-24-characters' });
    assert.equal(response.status, 403, '跨站點的 null Origin 表單仍須拒絕');
  } finally {
    admin.kill();
  }
  for (const [key, title, start, end] of [
    ['ended', '測試已結束', '2026-01-01', '2026-02-01'],
    ['ongoing', '測試展出中', '2026-09-01', '2026-11-01'],
    ['upcoming', '測試即將開始', '2026-12-01', '2027-01-01'],
  ]) {
    await testDb.query(`INSERT INTO exhibitions
      (museum_id,source_key,primary_provider,title,start_date,end_date,price_note,source_url,is_sample,content_hash)
      VALUES ('chimei',$1,'chimei',$2,$3,$4,'免費','https://www.chimeimuseum.org/',true,repeat('0',64))`,
    [`contract:${key}`, title, start, end]);
  }
  await checkPublicApiContract();
  process.stdout.write('匯入回滾、去重、欄位異動及公開 API 回應契約：通過\n');
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
