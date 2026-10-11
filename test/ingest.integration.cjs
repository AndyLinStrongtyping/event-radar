const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { readFile, writeFile, mkdtemp, unlink, rmdir } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const pg = require('pg');
const { assertOpenApiResponse, documentedGetPaths } = require('./openapi-response-validator.cjs');

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
  assert.ok(value.ticketing && typeof value.ticketing === 'object');
  assert.ok(value.ticketing.exhibition === null || typeof value.ticketing.exhibition === 'object');
  assert.ok(value.ticketing.generalAdmission === null || typeof value.ticketing.generalAdmission === 'object');
  assert.match(value.sourceUrl, /^https:\/\//);
  assert.ok(!Number.isNaN(Date.parse(value.lastSeenAt)));
}

async function checkPublicApiContract() {
  const port = 33000 + Math.floor(Math.random() * 2000);
  const base = `http://127.0.0.1:${port}`;
  const coveredSuccessPaths = new Set();
  const server = spawn(process.execPath, ['--experimental-strip-types', 'src/server.ts'], {
    cwd: project, env: { ...process.env, DATABASE_URL: testUrl.href, PORT: String(port), NMNS_API_KEY: '' },
    stdio: 'ignore',
  });
  async function get(path, status = 200) {
    const response = await fetch(base + path);
    assert.equal(response.status, status, `${path} 應回傳 ${status}`);
    assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
    const body = await response.json();
    const template = assertOpenApiResponse(path, status, body);
    if (status === 200) coveredSuccessPaths.add(template);
    return body;
  }
  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { await get('/health'); ready = true; break; }
      catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
    }
    assert.equal(ready, true, '公開 API 應可啟動並連接測試資料庫');
    assert.deepEqual(await get('/health'), { status: 'ok', database: 'ok' });

    const homepage = await fetch(base + '/');
    assert.equal(homepage.status, 200);
    assert.match(homepage.headers.get('content-type') ?? '', /^text\/html/);
    const html = await homepage.text();
    assert.match(html, /id="root"/);
    const bundlePath = html.match(/src="(\/react-assets\/[^\"]+\.js)"/)?.[1];
    const stylesheetPath = html.match(/href="(\/react-assets\/[^\"]+\.css)"/)?.[1];
    assert.ok(bundlePath, '首頁應載入 React bundle');
    assert.ok(stylesheetPath, '首頁應載入 React 樣式');
    for (const [path, type] of [[bundlePath, 'javascript'], [stylesheetPath, 'css']]) {
      const asset = await fetch(base + path);
      assert.equal(asset.status, 200, `${path} 應可載入`);
      assert.match(asset.headers.get('content-type') ?? '', new RegExp(type));
    }
    const guide = await fetch(base + '/guides/chimei.html');
    assert.equal(guide.status, 200, '既有館所介紹應繼續可用');
    const programmes = await get('/chimei-activities.json');
    assert.ok(programmes.items.length > 0);
    assert.ok(programmes.items.every((item) => item.sourceUrl.startsWith('https://www.chimeimuseum.org/event/')));

    const museums = await get('/museums');
    assert.ok(Array.isArray(museums.items) && museums.items.length > 0);
    const pending = await testDb.query(`SELECT museum_id,count(*)::int AS count
      FROM source_records WHERE status='review' GROUP BY museum_id`);
    const pendingByMuseum = new Map(pending.rows.map((row) => [row.museum_id, row.count]));
    for (const museum of museums.items) {
      for (const field of ['id', 'name', 'city', 'homepageUrl', 'sourceStatus']) {
        assert.equal(typeof museum[field], 'string', `museum.${field} 必須是字串`);
      }
      assert.ok(museum.lastSuccessAt === null || !Number.isNaN(Date.parse(museum.lastSuccessAt)));
      assert.ok(museum.lastOfficialSuccessAt === null || !Number.isNaN(Date.parse(museum.lastOfficialSuccessAt)));
      assert.ok(museum.lastAttemptAt === null || !Number.isNaN(Date.parse(museum.lastAttemptAt)));
      assert.ok(museum.lastAttemptStatus === null || ['succeeded', 'failed'].includes(museum.lastAttemptStatus));
      assert.ok(['manual', 'planned', 'never', 'untracked', 'failed', 'stale', 'recent'].includes(museum.dataStatus));
      assert.ok(museum.coverageStatus === null
        || ['baseline_created', 'checked', 'deferred_partial'].includes(museum.coverageStatus));
      assert.ok(Number.isInteger(museum.pendingReviewCount) && museum.pendingReviewCount >= 0);
      assert.equal(museum.pendingReviewCount, pendingByMuseum.get(museum.id) ?? 0,
        `${museum.id} 的公開待審筆數須與資料庫一致`);
      assert.ok(museum.generalAdmission === null || typeof museum.generalAdmission === 'object');
    }
    assert.equal(museums.items.find((museum) => museum.id === 'chimei').dataStatus, 'manual');
    assert.equal(museums.items.find((museum) => museum.id === 'nmns').dataStatus, 'failed');
    assert.equal(museums.items.find((museum) => museum.id === 'npm-south').dataStatus, 'stale');
    assert.equal(museums.items.find((museum) => museum.id === 'nmmba').dataStatus, 'stale',
      '手動匯入舊快照不得讓官方來源狀態變成近期同步');
    assert.equal(museums.items.find((museum) => museum.id === 'nmmba').coverageStatus, 'deferred_partial',
      '公開完整度警示與新鮮度需各自保留，不能互相掩蓋');
    assert.equal(museums.items.find((museum) => museum.id === 'nstm').coverageStatus, 'deferred_partial');

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
    for (const character of ['%', '_']) {
      const literal = await get(`/exhibitions?museum=chimei&status=all&q=${encodeURIComponent(character)}`);
      assert.equal(literal.total, 0, `搜尋 ${character} 應按字面比對，不能當 SQL 萬用字元`);
    }
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
    assert.deepEqual([...coveredSuccessPaths].sort(), [...documentedGetPaths].sort(),
      '每條公開 GET 路由都至少要有一筆真實 HTTP 成功回應通過 OpenAPI schema');
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
  const migrate = (...args) => execFileSync(process.execPath,
    ['--experimental-strip-types', 'src/migrate.ts', ...args], {
      cwd: project, env: { ...process.env, DATABASE_URL: testUrl.href }, encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  assert.match(migrate(), /新套用 15 份/, '空白資料庫應由單一命令建立');
  assert.match(migrate(), /新套用 0 份/, '重跑不得重建表或重複寫入');
  let ledger = await testDb.query('SELECT count(*)::int AS count FROM schema_migrations');
  assert.equal(ledger.rows[0].count, 15);
  // 模擬舊版手動執行所有 migration 的資料庫；只有明確指定時才建立帳本。
  await testDb.query('DROP TABLE schema_migrations');
  assert.throws(() => migrate(), /舊版資料庫且沒有 migration 帳本/);
  assert.match(migrate('--baseline-existing'), /新套用 0 份/);
  ledger = await testDb.query('SELECT count(*)::int AS count FROM schema_migrations');
  assert.equal(ledger.rows[0].count, 15);
  assert.match(migrate(), /新套用 0 份/);
  const { assessOfficialSourceCoverage } = await import('../src/source-coverage.ts');
  async function checkCoverage(keys, rawKeys = []) {
    const run = await testDb.query(`INSERT INTO ingestion_runs(museum_id,provider,status)
      VALUES ('ntm','ntm','running') RETURNING id`);
    const client = await testDb.connect();
    try {
      await client.query('BEGIN');
      const coverage = await assessOfficialSourceCoverage(client, 'ntm', 'ntm', run.rows[0].id,
        keys.map((sourceKey) => ({ sourceKey })),
        rawKeys.map((sourceKey) => ({ sourceKey })));
      await client.query('COMMIT');
      return coverage;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  const allKeys = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.deepEqual(await checkCoverage(allKeys),
    { status: 'baseline_created', identityCount: 6, identityKeys: allKeys, baselineCount: null,
      rowCount: 6, baselineRowCount: null });
  assert.deepEqual(await checkCoverage(['a', 'b']),
    { status: 'deferred_partial', identityCount: 2, identityKeys: ['a', 'b'], baselineCount: 6,
      rowCount: 2, baselineRowCount: 6 });
  let coverageBaseline = await testDb.query(`SELECT identity_count FROM official_source_baselines
    WHERE museum_id='ntm' AND provider='ntm'`);
  assert.equal(coverageBaseline.rows[0].identity_count, 6, '疑似部分回應不得降低可信比較基準');
  assert.deepEqual(await checkCoverage(allKeys),
    { status: 'checked', identityCount: 6, identityKeys: allKeys, baselineCount: 6,
      rowCount: 6, baselineRowCount: 6 });
  assert.deepEqual(await checkCoverage(['a', 'x', 'y', 'z', 'q', 'r']),
    { status: 'deferred_partial', identityCount: 6,
      identityKeys: ['a', 'q', 'r', 'x', 'y', 'z'], baselineCount: 6,
      rowCount: 6, baselineRowCount: 6 },
    '筆數相同但來源鍵幾乎全換，也不得判定舊展已從官方清單消失');
  const preservedKeys = await testDb.query(`SELECT identity_keys FROM official_source_baselines
    WHERE museum_id='ntm' AND provider='ntm'`);
  assert.deepEqual(preservedKeys.rows[0].identity_keys, allKeys,
    '疑似清單替換不得覆寫上次可信來源鍵');
  assert.deepEqual(await checkCoverage(allKeys.slice(0, 5)),
    { status: 'checked', identityCount: 5, identityKeys: allKeys.slice(0, 5), baselineCount: 6,
      rowCount: 5, baselineRowCount: 6 });
  assert.deepEqual(await checkCoverage(['a', 'b'], allKeys.slice(0, 5)),
    { status: 'deferred_partial', identityCount: 5,
      identityKeys: allKeys.slice(0, 5), baselineCount: 5,
      rowCount: 2, baselineRowCount: 5 },
    '原始紀錄仍完整但解析後可公開展覽驟減，也必須暫緩缺席判定');
  directory = await mkdtemp(join(tmpdir(), 'event-radar-it-'));
  const nstmData = Array.from({ length: 6 }, (_, index) => ({
    Category: '特展', ExhibitionName: `整合測試科工館展覽${index + 1}`,
    ExhibitionStartDate: '20260101', ExhibitionEndDate: '20991231', Floor: '2F',
  }));
  const nstmCards = nstmData.map((entry, index) => `<div class="exhi_data_list">
    <span><i>展覽日期：</i>115-01-01 ~ 188-12-31</span>
    <a href="/Exhibition.aspx?KeyID=00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}"
      title="${entry.ExhibitionName}">詳情</a></div>`);
  const nstmJson = await fixture('nstm-official.json', nstmData);
  const nstmFullHtml = join(directory, 'nstm-full.html');
  const nstmPartialHtml = join(directory, 'nstm-partial.html');
  const nstmUnmatchedHtml = join(directory, 'nstm-unmatched.html');
  files.push(nstmFullHtml, nstmPartialHtml, nstmUnmatchedHtml);
  await writeFile(nstmFullHtml, nstmCards.join(''), 'utf8');
  await writeFile(nstmPartialHtml, nstmCards.slice(0, 2).join(''), 'utf8');
  await writeFile(nstmUnmatchedHtml, nstmCards[0].replace(nstmData[0].ExhibitionName, '未配對的展覽'), 'utf8');
  function ingestMockNstm(htmlPath, jsonPath = nstmJson) {
    return JSON.parse(execFileSync(process.execPath,
      ['--import', pathToFileURL(join(project, 'test/fixtures/mock-nstm-fetch.mjs')).href,
        '--experimental-strip-types', 'src/ingest.ts', '--source', 'nstm', '--official'],
      { cwd: project, env: { ...process.env, DATABASE_URL: testUrl.href,
        TEST_NSTM_JSON: jsonPath, TEST_NSTM_HTML: htmlPath }, encoding: 'utf8' }));
  }
  assert.equal(ingestMockNstm(nstmFullHtml).coverageStatus, 'baseline_created');
  let nstmVisibility = await testDb.query("SELECT count(*)::int AS count FROM exhibitions WHERE museum_id='nstm' AND visible");
  assert.equal(nstmVisibility.rows[0].count, 6);
  assert.equal(ingestMockNstm(nstmPartialHtml).coverageStatus, 'deferred_partial');
  nstmVisibility = await testDb.query("SELECT count(*)::int AS count FROM exhibitions WHERE museum_id='nstm' AND visible");
  assert.equal(nstmVisibility.rows[0].count, 6,
    '官方 HTML 只解析兩筆時，不得先把其餘四筆既有展覽隱藏');
  const nstmReview = await testDb.query("SELECT count(*)::int AS count FROM source_records WHERE museum_id='nstm' AND status='review'");
  assert.equal(nstmReview.rows[0].count, 4, '疑似部分清單仍須保留原始待審資料');
  assert.throws(() => ingestMockNstm(nstmUnmatchedHtml), /Command failed/);
  nstmVisibility = await testDb.query("SELECT count(*)::int AS count FROM exhibitions WHERE museum_id='nstm' AND visible");
  assert.equal(nstmVisibility.rows[0].count, 6,
    '官方清單完全無法交叉核對時，失敗批次不可把所有既有展覽隱藏');
  const [original] = JSON.parse(await readFile(join(project, 'test/fixtures/chimei.json'), 'utf8'));

  const originalFile = await fixture('original.json', [original]);
  ingest(originalFile);
  ingest(originalFile);
  let result = await testDb.query("SELECT count(*)::int AS count FROM exhibitions WHERE museum_id='chimei'");
  assert.equal(result.rows[0].count, 1, '同來源重跑不可重複新增');

  const invalidFile = await fixture('invalid.json', [original, { ...original, endDate: 'bad-date' }]);
  assert.throws(() => ingest(invalidFile), /Command failed/);
  result = await testDb.query('SELECT status FROM ingestion_runs ORDER BY started_at DESC LIMIT 1');
  assert.equal(result.rows[0].status, 'failed', '任何錯誤資料都要標記整批失敗');
  result = await testDb.query("SELECT count(*)::int AS count FROM exhibitions WHERE museum_id='chimei'");
  assert.equal(result.rows[0].count, 1, '失敗批次不可留下部分寫入');

  const successBeforeEmpty = await testDb.query("SELECT last_success_at FROM museums WHERE id='chimei'");
  const emptyFile = await fixture('empty.json', []);
  assert.throws(() => ingest(emptyFile), /Command failed/);
  result = await testDb.query('SELECT status,error_message FROM ingestion_runs ORDER BY started_at DESC LIMIT 1');
  assert.equal(result.rows[0].status, 'failed', '空來源不能被記成同步成功');
  assert.match(result.rows[0].error_message, /0 筆資料/);
  result = await testDb.query("SELECT last_success_at FROM museums WHERE id='chimei'");
  assert.equal(result.rows[0].last_success_at.getTime(), successBeforeEmpty.rows[0].last_success_at.getTime(),
    '空來源不得刷新最近成功匯入時間');

  const duplicateFile = await fixture('duplicate.json', [{
    ...original, sourceUrl: 'https://www.chimeimuseum.org/special-exhibition/alternate',
  }]);
  const linked = JSON.parse(ingest(duplicateFile, 'culture'));
  assert.equal(linked.linked, 1, '第二來源應連到既有展覽');
  result = await testDb.query("SELECT count(*)::int AS count FROM exhibitions WHERE museum_id='chimei'");
  assert.equal(result.rows[0].count, 1);
  result = await testDb.query("SELECT count(*)::int AS count FROM exhibition_sources WHERE museum_id='chimei'");
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
  const successBeforeReview = await testDb.query("SELECT last_success_at FROM museums WHERE id='nmmba'");
  assert.throws(() => execFileSync(process.execPath,
    ['--experimental-strip-types', 'src/ingest.ts', '--source', 'nmmba', '--snapshot', reviewOnly],
    { cwd: project, env: seaEnv, encoding: 'utf8' }), /Command failed/);
  result = await testDb.query('SELECT status,fetched_count,review_count,error_message FROM ingestion_runs ORDER BY started_at DESC LIMIT 1');
  assert.equal(result.rows[0].status, 'failed', '全部待審不能被記成同步成功');
  assert.equal(result.rows[0].fetched_count, 1);
  assert.equal(result.rows[0].review_count, 1);
  assert.match(result.rows[0].error_message, /沒有可公開的展覽/);
  result = await testDb.query("SELECT status FROM source_records WHERE museum_id='nmmba' AND source_key=$1",
    ['https://www.nmmba.gov.tw/News_Content.aspx?n=3&s=only-review']);
  assert.equal(result.rows[0].status, 'review', '失敗批次仍須保存待審原始資料');
  result = await testDb.query("SELECT last_success_at FROM museums WHERE id='nmmba'");
  assert.equal(result.rows[0].last_success_at.getTime(), successBeforeReview.rows[0].last_success_at.getTime(),
    '全部待審時不得刷新最近成功匯入時間');
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
  assert.throws(() => execFileSync(process.execPath,
    ['--experimental-strip-types', 'src/ingest.ts', '--source', 'nmmba', '--snapshot', changedReview],
    { cwd: project, env: seaEnv, encoding: 'utf8' }), /Command failed/);
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
  assert.throws(() => execFileSync(process.execPath,
    ['--experimental-strip-types', 'src/ingest.ts', '--source', 'npm-north', '--snapshot', northChangedLink],
    { cwd: project, env: seaEnv, encoding: 'utf8' }), /Command failed/);
  result = await testDb.query("SELECT visible FROM exhibitions WHERE museum_id='npm-north' AND source_key='04012832'");
  assert.equal(result.rows[0].visible, false, '館方連結改變時舊補正展覽必須隱藏');
  const invalidFormerlyValid = {
    Source: 'https://www.nmmba.gov.tw/News_Content.aspx?n=3&s=good',
    '特展名稱': '海洋特展', '展出地點': '特展廳',
    'app用開始時間': '1150618', 'app用結束時間': '',
  };
  const seaRegressionOnly = await fixture('nmmba-regression-only.json', [invalidFormerlyValid]);
  assert.throws(() => execFileSync(process.execPath,
    ['--experimental-strip-types', 'src/ingest.ts', '--source', 'nmmba', '--snapshot', seaRegressionOnly],
    { cwd: project, env: seaEnv, encoding: 'utf8' }), /Command failed/);
  result = await testDb.query("SELECT visible FROM exhibitions WHERE museum_id='nmmba' AND source_key=$1",
    [invalidFormerlyValid.Source]);
  assert.equal(result.rows[0].visible, false, '原本有效的來源轉待審時，舊展覽須立即下架');
  execFileSync(process.execPath, seaArgs, { cwd: project, env: seaEnv, encoding: 'utf8' });
  result = await testDb.query("SELECT visible FROM exhibitions WHERE museum_id='nmmba' AND source_key=$1",
    [invalidFormerlyValid.Source]);
  assert.equal(result.rows[0].visible, true, '有效來源恢復後應重新上架');
  const seaRegressionMixed = await fixture('nmmba-regression-mixed.json', [invalidFormerlyValid,
    { Source: 'https://www.nmmba.gov.tw/News_Content.aspx?n=3&s=second-good',
      '特展名稱': '另一個海洋特展', '展出地點': '特展廳',
      'app用開始時間': '1150701', 'app用結束時間': '1160401' },
  ]);
  const mixedRun = JSON.parse(execFileSync(process.execPath,
    ['--experimental-strip-types', 'src/ingest.ts', '--source', 'nmmba', '--snapshot', seaRegressionMixed],
    { cwd: project, env: seaEnv, encoding: 'utf8' }));
  assert.equal(mixedRun.review, 1);
  result = await testDb.query("SELECT source_key,visible FROM exhibitions WHERE museum_id='nmmba' AND source_key IN ($1,$2)",
    [invalidFormerlyValid.Source, 'https://www.nmmba.gov.tw/News_Content.aspx?n=3&s=second-good']);
  assert.equal(result.rows.find((row) => row.source_key === invalidFormerlyValid.Source).visible, false,
    '同批有其他有效展覽時，失效的舊展覽仍須下架');
  assert.equal(result.rows.find((row) => row.source_key.endsWith('second-good')).visible, true);
  const alternateFile = await fixture('nmmba-alternate.json', [{ museumId: 'nmmba', title: '海洋特展',
    venue: '特展廳', startDate: '2026-06-18', endDate: '2027-03-01',
    sourceUrl: invalidFormerlyValid.Source, isSample: false }]);
  execFileSync(process.execPath,
    ['--experimental-strip-types', 'src/ingest.ts', '--source', 'nmmba', '--provider', 'alternate', '--file', alternateFile],
    { cwd: project, env: seaEnv, encoding: 'utf8' });
  result = await testDb.query("SELECT visible,primary_provider FROM exhibitions WHERE museum_id='nmmba' AND source_key=$1",
    [invalidFormerlyValid.Source]);
  assert.deepEqual(result.rows[0], { visible: true, primary_provider: 'alternate' },
    '另一個有效來源重新核對後，可接手失效的主來源');
  assert.throws(() => execFileSync(process.execPath,
    ['--experimental-strip-types', 'src/ingest.ts', '--source', 'nmmba', '--snapshot', seaRegressionOnly],
    { cwd: project, env: seaEnv, encoding: 'utf8' }), /Command failed/);
  result = await testDb.query("SELECT visible,primary_provider FROM exhibitions WHERE museum_id='nmmba' AND source_key=$1",
    [invalidFormerlyValid.Source]);
  assert.deepEqual(result.rows[0], { visible: true, primary_provider: 'alternate' },
    '待審來源已非主來源時，不應隱藏其他有效來源接手的展覽');
  const { trackMissingCandidates } = await import('../src/source-missing.ts');
  const firstUrl = invalidFormerlyValid.Source;
  const secondUrl = 'https://www.nmmba.gov.tw/News_Content.aspx?n=3&s=second-good';
  async function observeOfficialList(urls) {
    const run = await testDb.query(`INSERT INTO ingestion_runs(museum_id,status)
      VALUES ('nmmba','running') RETURNING id`);
    const client = await testDb.connect();
    try {
      await client.query('BEGIN');
      const count = await trackMissingCandidates(client, 'nmmba', 'nmmba', run.rows[0].id,
        urls.map((sourceUrl) => ({ sourceKey: sourceUrl, sourceUrl })), []);
      await client.query('COMMIT');
      return count;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  assert.equal(await observeOfficialList([firstUrl]), 1);
  assert.equal(await observeOfficialList([firstUrl]), 1);
  result = await testDb.query(`SELECT status,missed_runs FROM source_missing_candidates
    WHERE museum_id='nmmba' AND provider='nmmba' AND source_key=$1`, [secondUrl]);
  assert.deepEqual(result.rows[0], { status: 'pending', missed_runs: 2 });
  result = await testDb.query('SELECT visible FROM exhibitions WHERE museum_id=$1 AND source_key=$2',
    ['nmmba', secondUrl]);
  assert.equal(result.rows[0].visible, true, '缺席候選不等於已下架；須人工核對');
  execFileSync(process.execPath, seaArgs, { cwd: project, env: seaEnv, encoding: 'utf8' });
  result = await testDb.query(`SELECT missed_runs FROM source_missing_candidates
    WHERE museum_id='nmmba' AND provider='nmmba' AND source_key=$1`, [secondUrl]);
  assert.equal(result.rows[0].missed_runs, 2, '手動快照不應增加官方來源缺席次數');
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
    response = await fetch(`${adminBase}/health`);
    assert.equal(response.status, 401, '未登入不能讀取來源健康報告');
    response = await fetch(`${adminBase}/health`, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /來源健康觀測/);
    response = await fetch(`${adminBase}/missing`, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /另一個海洋特展/);
    const missingDetail = `${adminBase}/missing/record?museum=nmmba&provider=nmmba&key=${encodeURIComponent(secondUrl)}`;
    response = await fetch(missingDetail, { headers: { cookie } });
    assert.equal(response.status, 200);
    const detailHtml = await response.text();
    assert.match(detailHtml, /記錄本次核對/);
    const csrf = detailHtml.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
    assert.ok(csrf, '審核表單須有 CSRF token');
    const reviewBody = new URLSearchParams({ csrf, museum: 'nmmba', provider: 'nmmba',
      key: secondUrl, decision: 'keep_visible', evidenceUrl: secondUrl,
      reviewer: '整合測試', note: '核對館方頁後保留，尚未確認取消。' });
    response = await fetch(`${adminBase}/missing/review`, { method: 'POST',
      headers: { origin: adminBase, cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...Object.fromEntries(reviewBody), csrf: 'wrong' }) });
    assert.equal(response.status, 403, '缺席核對須驗證 CSRF');
    response = await fetch(`${adminBase}/missing/review`, { method: 'POST',
      headers: { origin: adminBase, cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...Object.fromEntries(reviewBody), evidenceUrl: 'https://example.org/false' }) });
    assert.equal(response.status, 400, '證據不得指向無關網域');
    response = await fetch(`${adminBase}/missing/review`, { method: 'POST',
      headers: { origin: adminBase, cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: reviewBody });
    assert.equal(response.status, 200, '核對須可透過本機管理頁留下紀錄');
    response = await fetch(`${adminBase}/missing/review`, { method: 'POST',
      headers: { origin: adminBase, cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: reviewBody });
    assert.equal(response.status, 400, '相同缺席次數不能重複核對');
    response = await fetch(missingDetail, { headers: { cookie } });
    assert.match(await response.text(), /本次缺席已核對/);
    result = await testDb.query(`SELECT reviewed_missed_runs FROM source_missing_candidates
      WHERE museum_id='nmmba' AND provider='nmmba' AND source_key=$1`, [secondUrl]);
    assert.equal(result.rows[0].reviewed_missed_runs, 2);
    result = await testDb.query(`SELECT count(*)::int AS count FROM source_missing_reviews
      WHERE museum_id='nmmba' AND source_key=$1`, [secondUrl]);
    assert.equal(result.rows[0].count, 1, '錯誤與重送不得增加審查紀錄');
    assert.equal(await observeOfficialList([firstUrl]), 1);
    response = await fetch(missingDetail, { headers: { cookie } });
    assert.match(await response.text(), /記錄本次核對/, '新一次缺席須重新待審');
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
    if (admin.exitCode === null && admin.signalCode === null) {
      const exited = new Promise((resolve) => admin.once('exit', resolve));
      admin.kill();
      await exited;
    }
  }
  assert.equal(await observeOfficialList([firstUrl, secondUrl]), 0);
  result = await testDb.query(`SELECT status,missed_runs FROM source_missing_candidates
    WHERE museum_id='nmmba' AND provider='nmmba' AND source_key=$1`, [secondUrl]);
  assert.deepEqual(result.rows[0], { status: 'resolved', missed_runs: 3 },
    '來源重新出現後，缺席候選應自動結案');
  assert.equal(await observeOfficialList([firstUrl]), 1);
  result = await testDb.query(`SELECT status,missed_runs,reviewed_missed_runs FROM source_missing_candidates
    WHERE museum_id='nmmba' AND provider='nmmba' AND source_key=$1`, [secondUrl]);
  assert.deepEqual(result.rows[0], { status: 'pending', missed_runs: 1, reviewed_missed_runs: 0 },
    '重新出現後再次缺席，必須開啟新的核對週期');
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
  await testDb.query("UPDATE museums SET last_success_at=now()-interval '1 hour' WHERE id='nmns'");
  await testDb.query("UPDATE museums SET last_success_at=now()-interval '15 days',last_official_success_at=now()-interval '15 days' WHERE id='npm-south'");
  await testDb.query("UPDATE museums SET last_official_success_at=now()-interval '15 days' WHERE id='nmmba'");
  const officialBeforeSnapshot = await testDb.query("SELECT last_official_success_at FROM museums WHERE id='nmmba'");
  execFileSync(process.execPath, seaArgs, { cwd: project, env: seaEnv, encoding: 'utf8' });
  result = await testDb.query("SELECT last_success_at,last_official_success_at FROM museums WHERE id='nmmba'");
  assert.equal(result.rows[0].last_official_success_at.getTime(),
    officialBeforeSnapshot.rows[0].last_official_success_at.getTime(),
    '手動匯入快照不得刷新官方同步時間');
  assert.ok(result.rows[0].last_success_at > result.rows[0].last_official_success_at);
  await testDb.query(`INSERT INTO sync_attempts
    (sync_id,museum_id,attempt_no,status,retryable,duration_ms)
    VALUES (gen_random_uuid(),'nmns',1,'failed',true,1200),
      (gen_random_uuid(),'npm-south',1,'succeeded',false,1200),
      (gen_random_uuid(),'nmmba',1,'succeeded',false,1200)`);
  const retryId = require('node:crypto').randomUUID();
  await testDb.query(`INSERT INTO sync_attempts
    (sync_id,museum_id,attempt_no,status,retryable,duration_ms)
    VALUES ($1,'nmmba',1,'failed',true,1200),($1,'nmmba',2,'succeeded',false,900)`, [retryId]);
  const { loadSourceHealth } = await import('../src/source-health-report.ts');
  const health = await loadSourceHealth(testDb);
  const seaHealth = health.find((item) => item.museumId === 'nmmba');
  assert.equal(seaHealth.runs7d, 2, '同一 sync_id 的失敗與重試只算一次工作');
  assert.equal(seaHealth.failedRuns7d, 0, '重試後成功的工作不可列成失敗');
  assert.equal(seaHealth.retriedRuns7d, 1);
  assert.equal(seaHealth.failureRate7d, 0);
  assert.equal(seaHealth.missingNeedsReview, 1, '新缺席未核對應進健康報告');
  await testDb.query(`INSERT INTO ingestion_runs(museum_id,provider,status,coverage_status,
    source_identity_count,coverage_baseline_count,source_row_count,coverage_baseline_row_count)
    VALUES ('nmmba','nmmba','succeeded','deferred_partial',2,6,2,6)`);
  assert.equal((await loadSourceHealth(testDb)).find((item) => item.museumId === 'nmmba')
    .latestCoverageStatus, 'deferred_partial', '最近官方清單縮水須出現在健康報告');
  assert.equal(health.find((item) => item.museumId === 'nmns').health, 'failed',
    '最近同步失敗須優先於先前本機匯入成功');
  await checkPublicApiContract();
  assert.equal(ingestMockNstm(nstmFullHtml).coverageStatus, 'checked',
    '官方完整清單恢復後應重新通過完整度檢查');
  nstmVisibility = await testDb.query("SELECT count(*)::int AS count FROM exhibitions WHERE museum_id='nstm' AND visible");
  assert.equal(nstmVisibility.rows[0].count, 6);
  const replacedData = nstmData.map((entry, index) => ({
    ...entry, ExhibitionName: `另一批科工館展覽${index + 1}`,
  }));
  const replacedJson = await fixture('nstm-replaced.json', replacedData);
  const replacedHtml = join(directory, 'nstm-replaced.html');
  files.push(replacedHtml);
  await writeFile(replacedHtml, replacedData.map((entry, index) => `<div class="exhi_data_list">
    <span><i>展覽日期：</i>115-01-01 ~ 188-12-31</span>
    <a href="/Exhibition.aspx?KeyID=00000000-0000-0000-0000-${String(index + 101).padStart(12, '0')}"
      title="${entry.ExhibitionName}">詳情</a></div>`).join(''), 'utf8');
  assert.equal(ingestMockNstm(replacedHtml, replacedJson).coverageStatus, 'deferred_partial',
    '清單筆數維持六筆但來源鍵全部換掉時，須暫緩缺席判定');
  const missingAfterReplacement = await testDb.query(`SELECT count(*)::int AS count
    FROM source_missing_candidates WHERE museum_id='nstm' AND status='pending'`);
  assert.equal(missingAfterReplacement.rows[0].count, 0);
  const { inspectBaselineCandidate, acceptBaselineCandidate } =
    await import('../src/source-baseline-review.ts');
  const reviewPreview = await inspectBaselineCandidate(testDb, 'nstm', 'nstm');
  assert.equal(reviewPreview.coverageStatus, 'deferred_partial');
  assert.equal(reviewPreview.canAccept, true);
  assert.equal(reviewPreview.removedKeys.length, reviewPreview.baselineCount);
  assert.equal(reviewPreview.addedKeys.length, reviewPreview.candidateCount);
  const reviewInput = { museum: 'nstm', provider: 'nstm', runId: reviewPreview.runId,
    evidenceUrl: 'https://www.nstm.gov.tw/ExhibitionList.aspx?ExhibitionType=2',
    reviewer: '整合測試審查人', note: '已核對官方列表確實整季更換' };
  await assert.rejects(acceptBaselineCandidate(testDb, { ...reviewInput,
    evidenceUrl: 'https://example.com/fake' }), /官方網域/);
  await assert.rejects(acceptBaselineCandidate(testDb, { ...reviewInput,
    runId: require('node:crypto').randomUUID() }), /最新且成功匯入/);
  const baselineBeforeReview = await testDb.query(`SELECT identity_count,row_count,last_run_id
    FROM official_source_baselines WHERE museum_id='nstm' AND provider='nstm'`);
  assert.equal(baselineBeforeReview.rows[0].identity_count, reviewPreview.baselineCount);
  const reviewId = await acceptBaselineCandidate(testDb, reviewInput);
  assert.match(reviewId, /^[0-9a-f-]{36}$/i);
  const reviewed = await testDb.query(`SELECT previous_run_id,accepted_identity_count,
    array_length(accepted_identity_keys,1) AS accepted_keys FROM source_baseline_reviews
    WHERE id=$1`, [reviewId]);
  assert.equal(reviewed.rows[0].previous_run_id, baselineBeforeReview.rows[0].last_run_id);
  assert.equal(reviewed.rows[0].accepted_identity_count, reviewPreview.candidateCount);
  assert.equal(reviewed.rows[0].accepted_keys, reviewPreview.candidateCount);
  await assert.rejects(acceptBaselineCandidate(testDb, reviewInput), /此批次已成為基準/);
  nstmVisibility = await testDb.query(`SELECT count(*)::int AS count FROM exhibitions
    WHERE museum_id='nstm' AND visible`);
  assert.equal(nstmVisibility.rows[0].count, 12,
    '更新來源基準本身不可隱藏既有展覽');
  assert.equal(ingestMockNstm(replacedHtml, replacedJson).coverageStatus, 'checked',
    '已核對的整季更換在下次相同官方清單同步時恢復正常比較');
  const { enqueueSourceJob, claimSourceJob, finishSourceJob, replayDeadJob } =
    await import('../src/source-jobs.ts');
  const queuedSea = await enqueueSourceJob(testDb, 'nmmba', '2026-10-10');
  const duplicateSea = await enqueueSourceJob(testDb, 'nmmba', '2026-10-10');
  assert.equal(queuedSea.created, true);
  assert.deepEqual(duplicateSea, { id: queuedSea.id, created: false },
    '同館同日重送只能有一個原始工作');
  await enqueueSourceJob(testDb, 'npm-south', '2026-10-10');
  const [claimedA, claimedB] = await Promise.all([
    claimSourceJob(testDb), claimSourceJob(testDb),
  ]);
  assert.ok(claimedA && claimedB && claimedA.id !== claimedB.id,
    '兩個 worker 必須領取不同工作');
  const seaJob = [claimedA, claimedB].find((item) => item.museum_id === 'nmmba');
  const southJob = [claimedA, claimedB].find((item) => item.museum_id === 'npm-south');
  assert.equal(await finishSourceJob(testDb, seaJob,
    { succeeded: true, retryable: false, durationMs: 100, error: '' }), true);
  assert.equal(await finishSourceJob(testDb, southJob,
    { succeeded: false, retryable: true, durationMs: 100, error: 'timeout' }), true);
  result = await testDb.query('SELECT status,attempts,available_at>now() AS delayed FROM source_jobs WHERE id=$1',
    [southJob.id]);
  assert.deepEqual(result.rows[0], { status: 'pending', attempts: 1, delayed: true },
    '暫時失敗須退避後再領取，不應立即重試');
  assert.equal(await claimSourceJob(testDb), null);
  await testDb.query("UPDATE source_jobs SET available_at=now()-interval '1 second' WHERE id=$1", [southJob.id]);
  const retryJob = await claimSourceJob(testDb);
  assert.equal(retryJob.id, southJob.id);
  assert.equal(retryJob.attempts, 2);
  assert.equal(await finishSourceJob(testDb, retryJob,
    { succeeded: false, retryable: false, durationMs: 90, error: '資料格式改變' }), true);
  result = await testDb.query('SELECT status FROM source_jobs WHERE id=$1', [southJob.id]);
  assert.equal(result.rows[0].status, 'dead', '非暫時性錯誤須進死信等待人工處理');
  const replayId = await replayDeadJob(testDb, southJob.id);
  assert.notEqual(replayId, southJob.id);
  const replay = await claimSourceJob(testDb);
  assert.equal(replay.id, replayId);
  assert.equal(replay.attempts, 1);
  assert.equal(await finishSourceJob(testDb, replay,
    { succeeded: true, retryable: false, durationMs: 80, error: '' }), true);
  result = await testDb.query('SELECT status,replay_of FROM source_jobs WHERE id=$1', [replayId]);
  assert.deepEqual(result.rows[0], { status: 'succeeded', replay_of: southJob.id },
    '人工重播建立新工作並保留原死信');
  await enqueueSourceJob(testDb, 'nmns', '2026-10-10');
  const crashed = await claimSourceJob(testDb);
  await testDb.query("UPDATE source_jobs SET lease_until=now()-interval '1 second' WHERE id=$1", [crashed.id]);
  assert.equal(await claimSourceJob(testDb), null, '租約過期後需退避，不能同時交給另一 worker');
  result = await testDb.query('SELECT status,attempts FROM source_jobs WHERE id=$1', [crashed.id]);
  assert.deepEqual(result.rows[0], { status: 'pending', attempts: 1 });
  await testDb.query("UPDATE source_jobs SET available_at=now()-interval '1 second' WHERE id=$1", [crashed.id]);
  const recovered = await claimSourceJob(testDb);
  assert.equal(recovered.id, crashed.id);
  assert.equal(recovered.attempts, 2);
  assert.equal(await finishSourceJob(testDb, crashed,
    { succeeded: true, retryable: false, durationMs: 10, error: '' }), false,
  '過期 worker 的結果不能覆蓋新租約');
  assert.equal(await finishSourceJob(testDb, recovered,
    { succeeded: true, retryable: false, durationMs: 10, error: '' }), true);
  result = await testDb.query('SELECT attempt_no,status FROM sync_attempts WHERE sync_id=$1 ORDER BY attempt_no',
    [crashed.id]);
  assert.deepEqual(result.rows, [{ attempt_no: 1, status: 'failed' },
    { attempt_no: 2, status: 'succeeded' }], '過期租約與恢復結果都須留下嘗試證據');
  await enqueueSourceJob(testDb, 'nstm', '2026-10-10');
  let capped;
  for (let attempt = 1; attempt <= 3; attempt++) {
    capped = await claimSourceJob(testDb);
    assert.equal(capped.attempts, attempt);
    assert.equal(await finishSourceJob(testDb, capped,
      { succeeded: false, retryable: true, durationMs: 30, error: 'timeout' }), true);
    if (attempt < 3) {
      await testDb.query("UPDATE source_jobs SET available_at=now()-interval '1 second' WHERE id=$1", [capped.id]);
    }
  }
  result = await testDb.query('SELECT status,attempts FROM source_jobs WHERE id=$1', [capped.id]);
  assert.deepEqual(result.rows[0], { status: 'dead', attempts: 3 },
    '連續暫時失敗最多三次，不能無限重抓官方來源');
  assert.equal(await claimSourceJob(testDb), null);
  const { runScheduledSourceJob } = await import('../src/source-job-schedule.ts');
  const unrelated = await enqueueSourceJob(testDb, 'nmmba', '2026-10-11');
  const scheduled = await enqueueSourceJob(testDb, 'nstm', '2026-10-11');
  let scheduledCalls = 0;
  const scheduledResult = await runScheduledSourceJob(testDb, 'nstm', '2026-10-11', async () => {
    scheduledCalls++;
    return { succeeded: scheduledCalls === 2, retryable: true,
      durationMs: 20, error: scheduledCalls === 1 ? 'timeout' : '' };
  }, { sleep: async () => {
    // Advance only the test job through its retry delay without waiting 30 seconds.
    await testDb.query("UPDATE source_jobs SET available_at=now()-interval '1 second' WHERE id=$1", [scheduled.id]);
  } });
  assert.equal(scheduledResult.id, scheduled.id);
  assert.equal(scheduledResult.status, 'succeeded');
  assert.equal(scheduledResult.attempts, 2);
  assert.equal(scheduledCalls, 2, '排程工作應等待暫時錯誤退避後的下一次嘗試');
  result = await testDb.query('SELECT status,attempts FROM source_jobs WHERE id=$1', [unrelated.id]);
  assert.deepEqual(result.rows[0], { status: 'pending', attempts: 0 },
    '單館排程不可領取其他來源的到期工作');
  const repeated = await runScheduledSourceJob(testDb, 'nstm', '2026-10-11', async () => {
    throw new Error('成功的同日工作不應重抓');
  });
  assert.equal(repeated.created, false);
  assert.equal(repeated.status, 'succeeded');
  const deadScheduled = await runScheduledSourceJob(testDb, 'npm-north', '2026-10-11', async () =>
    ({ succeeded: false, retryable: false, durationMs: 10, error: '資料格式改變' }));
  assert.equal(deadScheduled.status, 'dead', '永久性錯誤應讓每日排程回報最終失敗');
  assert.equal(deadScheduled.attempts, 1);
  const thrownScheduled = await runScheduledSourceJob(testDb, 'nmns', '2026-10-11', async () => {
    throw new Error('worker unexpected error');
  });
  assert.equal(thrownScheduled.status, 'dead', 'worker 意外例外應記為死信，不能留在 running');
  assert.equal(thrownScheduled.lastError, 'worker unexpected error');
  assert.equal((await testDb.query('SELECT status FROM source_jobs WHERE id=$1', [unrelated.id])).rows[0].status,
    'pending');
  const { importChimeiProgrammeSnapshot } = await import('../src/chimei-programmes.ts');
  const programmeA = { id: '207', title: '西洋武術工作坊', dateText: '2026/10/31\n2026/09/14 啟售',
    type: null, sourceUrl: 'https://www.chimeimuseum.org/event/6a9e550542b15' };
  const programmeB = { id: '197', title: 'VR 沉浸探險',
    dateText: '2026/01/29 - 2027/01/10\n博物館開放日', type: '期間限定節目',
    sourceUrl: 'https://www.chimeimuseum.org/event/691aeece01a23' };
  const candidate = { checkedAt: '2026-10-11T06:00:00Z',
    sourceUrl: 'https://www.chimeimuseum.org/exhibition-event',
    items: [programmeA, programmeB] };
  assert.deepEqual(await importChimeiProgrammeSnapshot(testDb, candidate),
    { inserted: 2, updated: 0, unchanged: 0 });
  assert.deepEqual(await importChimeiProgrammeSnapshot(testDb, candidate),
    { inserted: 0, updated: 0, unchanged: 2 }, '重跑相同快照不得新增活動或異動');
  const revised = { ...candidate, checkedAt: '2026-10-12T06:00:00Z',
    items: [{ ...programmeA, title: '西洋武術工作坊（更新）' },
      { ...programmeB, dateText: '2026/01/30 - 2027/01/10\n博物館開放日' }] };
  assert.deepEqual(await importChimeiProgrammeSnapshot(testDb, revised),
    { inserted: 0, updated: 2, unchanged: 0 });
  const programmeRows = await testDb.query(`SELECT source_event_id,schedule_type,
    to_char(start_date,'YYYY-MM-DD') AS start_date,raw_date
    FROM programme_events ORDER BY source_event_id`);
  assert.equal(programmeRows.rows.length, 2);
  assert.equal(programmeRows.rows.find((row) => row.source_event_id === '197').start_date,
    '2026-01-30');
  assert.equal(programmeRows.rows.find((row) => row.source_event_id === '207').start_date,
    null, '售票日期不能寫入活動起日');
  const changedFields = await testDb.query(`SELECT field_name FROM programme_event_changes
    ORDER BY field_name`);
  assert.deepEqual(changedFields.rows.map((row) => row.field_name),
    ['rawDate', 'startDate', 'title']);
  await assert.rejects(importChimeiProgrammeSnapshot(testDb,
    { ...revised, checkedAt: '2026-10-13T06:00:00Z', items: [programmeA] }),
  /疑似縮水/);
  await assert.rejects(importChimeiProgrammeSnapshot(testDb, candidate), /更舊/);
  assert.equal((await testDb.query('SELECT count(*)::int AS count FROM programme_events')).rows[0].count,
    2, '來源異常或舊快照不得修改既有活動');
  const followup = (id) => ({ ...programmeA, id: String(id), title: `候選活動 ${id}`,
    sourceUrl: `https://www.chimeimuseum.org/event/test${id}` });
  const step = (checkedAt, items) => importChimeiProgrammeSnapshot(testDb,
    { ...candidate, checkedAt, items });
  await step('2026-10-13T06:00:00Z', [programmeA, followup(201)]);
  await step('2026-10-14T06:00:00Z', [followup(201), followup(202)]);
  await step('2026-10-15T06:00:00Z', [followup(202), followup(203)]);
  assert.equal((await testDb.query('SELECT count(*)::int AS count FROM programme_events')).rows[0].count,
    5, '歷史缺席項可保留，但覆蓋率只與上一份可信快照比較');
  process.stdout.write('匯入回滾、去重、欄位異動及公開 API 回應契約：通過\n');
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
}).finally(async () => {
  if (testDb) await testDb.end();
  if (created) {
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        await maintenance.query(`DROP DATABASE "${testDbName}"`);
        break;
      } catch (error) {
        if (error.code !== '55006' || attempt === 19) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }
  await maintenance.end();
  for (const path of files) await unlink(path);
  if (directory) await rmdir(directory);
});
