import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import process from 'node:process';
import pg from 'pg';
import { approveReview } from './review-service.ts';
import { reviewMissingCandidate } from './missing-review-service.ts';
import { loadSourceHealth } from './source-health-report.ts';

if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');
const password = process.env.EVENT_RADAR_ADMIN_PASSWORD ?? '';
if (password.length < 16) throw new Error('EVENT_RADAR_ADMIN_PASSWORD 至少需要 16 字元');
const port = Number(process.env.ADMIN_PORT ?? 3010);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('ADMIN_PORT 無效');
const origin = `http://127.0.0.1:${port}`;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const sessions = new Map<string, { csrf: string; expires: number }>();
const attempts: number[] = [];

function escape(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!);
}

function page(response: ServerResponse, status: number, body: string, cookie?: string): void {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
    ...(cookie ? { 'set-cookie': cookie } : {}),
  });
  response.end(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Event Radar 審核</title><style>body{font:16px/1.6 system-ui;background:#f1eee5;color:#173136;max-width:850px;margin:2rem auto;padding:0 1rem}main{background:#fff;padding:1.5rem;border:1px solid #d4c8b1}a{color:#005e66}label{display:block;margin:.8rem 0}input,textarea{width:100%;box-sizing:border-box;padding:.5rem;font:inherit}button{padding:.6rem 1rem;cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eee;padding:1rem}li{margin:.7rem 0}.error{color:#a02525}</style><main>${body}</main></html>`);
}

function fail(response: ServerResponse, status: number, message: string): void {
  page(response, status, `<h1>無法完成操作</h1><p class="error">${escape(message)}</p><p><a href="/">返回審核頁</a></p>`);
}

function session(request: IncomingMessage): { token: string; csrf: string } | null {
  const token = request.headers.cookie?.match(/(?:^|;\s*)er_admin=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) return null;
  const item = sessions.get(token);
  if (!item || item.expires < Date.now()) { sessions.delete(token); return null; }
  return { token, csrf: item.csrf };
}

async function form(request: IncomingMessage): Promise<URLSearchParams> {
  if (request.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') {
    throw new Error('表單格式無效');
  }
  let body = '';
  for await (const chunk of request) {
    body += chunk.toString();
    if (body.length > 12_000) throw new Error('表單過大');
  }
  return new URLSearchParams(body);
}

function field(values: URLSearchParams, key: string): string {
  const all = values.getAll(key);
  if (all.length !== 1) throw new Error(`${key} 欄位無效`);
  return all[0].trim();
}

function samePassword(value: string): boolean {
  const expected = createHash('sha256').update(password).digest();
  const actual = createHash('sha256').update(value).digest();
  return timingSafeEqual(expected, actual);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', origin);
    if (request.headers.host !== `127.0.0.1:${port}`) {
      fail(response, 403, '主機不符'); return;
    }
    const sameSite = request.headers['sec-fetch-site'] === 'same-origin';
    const submittedOrigin = request.headers.origin;
    if (request.method === 'POST' && submittedOrigin !== origin
      && !((submittedOrigin === 'null' || submittedOrigin === undefined) && sameSite)) {
      fail(response, 403, '來源不符'); return;
    }
    const user = session(request);
    if (request.method === 'POST' && url.pathname === '/login') {
      const now = Date.now();
      while (attempts.length && attempts[0] < now - 15 * 60_000) attempts.shift();
      if (attempts.length >= 5) { fail(response, 429, '登入嘗試過多，請稍後再試'); return; }
      const values = await form(request);
      if (!samePassword(field(values, 'password'))) {
        attempts.push(now); fail(response, 401, '密碼錯誤'); return;
      }
      attempts.length = 0;
      const token = randomBytes(32).toString('hex');
      sessions.set(token, { csrf: randomBytes(32).toString('hex'), expires: now + 4 * 60 * 60_000 });
      page(response, 200, '<h1>已登入</h1><p><a href="/">開啟待審清單</a></p>',
        `er_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=14400`);
      return;
    }
    if (!user) {
      if (request.method === 'GET' && url.pathname === '/') {
        page(response, 200, '<h1>Event Radar 本機審核</h1><p>僅在本機操作；展期與證據須由審查人到館方頁核對。</p><form method="post" action="/login"><label>管理密碼<input name="password" type="password" required autocomplete="current-password"></label><button>登入</button></form>');
      } else fail(response, 401, '請先登入');
      return;
    }
    if (request.method === 'POST' && url.pathname === '/logout') {
      const values = await form(request);
      if (field(values, 'csrf') !== user.csrf) { fail(response, 403, '表單驗證失敗'); return; }
      sessions.delete(user.token);
      page(response, 200, '<h1>已登出</h1><a href="/">返回登入</a>',
        'er_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      return;
    }
    if (request.method === 'POST' && url.pathname === '/approve') {
      const values = await form(request);
      if (field(values, 'csrf') !== user.csrf) { fail(response, 403, '表單驗證失敗'); return; }
      const correctionId = await approveReview(pool, {
        museum: field(values, 'museum'), key: field(values, 'key'),
        startDate: field(values, 'startDate'), endDate: field(values, 'endDate'),
        evidenceUrl: field(values, 'evidenceUrl'), reviewer: field(values, 'reviewer'),
        note: field(values, 'note'),
      });
      page(response, 200, `<h1>補正已記錄</h1><p>紀錄 ID：${escape(correctionId)}。下次匯入相同原始資料時才會套用。</p><a href="/">返回清單</a>`);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/missing/review') {
      const values = await form(request);
      if (field(values, 'csrf') !== user.csrf) { fail(response, 403, '表單驗證失敗'); return; }
      const id = await reviewMissingCandidate(pool, {
        museum: field(values, 'museum'), provider: field(values, 'provider'),
        key: field(values, 'key'),
        decision: field(values, 'decision') as 'keep_visible' | 'follow_up',
        evidenceUrl: field(values, 'evidenceUrl'), reviewer: field(values, 'reviewer'),
        note: field(values, 'note'),
      });
      page(response, 200, `<h1>缺席核對已記錄</h1><p>審查 ID：${escape(id)}。這次核對不改展覽可見狀態；下一次成功官方匯入若仍缺席，會再次列為待核對。</p><a href="/missing">返回缺席清單</a>`);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/health') {
      const items = await loadSourceHealth(pool);
      const labels: Record<string, string> = {
        failed: '最近同步失敗', stale: '超過 14 天未成功取得官方來源',
        never: '尚無官方同步成功紀錄', untracked: '同步狀態待確認',
        needs_review: '有資料需要核對', healthy: '最近同步正常',
      };
      const cards = items.map((item) => {
        const rate = item.failureRate7d === null ? '無工作紀錄'
          : `${item.failedRuns7d}/${item.runs7d}（${Math.round(item.failureRate7d * 100)}%）`;
        const official = item.lastOfficialSuccessAt
          ? new Date(item.lastOfficialSuccessAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '無紀錄';
        const coverage = item.latestCoverageStatus === 'deferred_partial'
          ? '最近官方清單疑似不完整或項目大幅變動，缺席判定已暫緩；請核對館方來源。' : '';
        return `<li><h2>${escape(item.name)}</h2><p>狀態：${escape(labels[item.health])}。最近官方成功：${escape(official)}</p><p>最近 7 天工作失敗：${escape(rate)}；有重試的工作 ${escape(item.retriedRuns7d)} 次。</p><p>待審來源紀錄 ${escape(item.pendingReview)} 筆；新缺席待核對 ${escape(item.missingNeedsReview)} 筆。</p>${coverage ? `<p>${escape(coverage)}</p>` : ''}</li>`;
      }).join('');
      page(response, 200, `<p><a href="/">← 待審首頁</a></p><h1>來源健康觀測</h1><p>只讀本機報告。每個 sync_id 算一次工作，失敗率取最後一次嘗試；沒有嘗試紀錄不代表成功。失敗率統計最近 7 天；超過 14 天未成功取得官方來源才因時間標為可能過期。這不是展覽有效期限。</p><ul>${cards}</ul><p><a href="/missing">查看缺席候選</a></p>`);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/missing') {
      const result = await pool.query(`SELECT c.museum_id,c.provider,c.source_key,c.missed_runs,
        c.reviewed_missed_runs,
        c.last_missing_at,e.title,e.source_url FROM source_missing_candidates c
        JOIN exhibitions e ON e.id=c.exhibition_id WHERE c.status='pending'
        ORDER BY c.last_missing_at DESC,c.museum_id,c.source_key LIMIT 100`);
      const links = result.rows.map((item) => {
        let source = '來源網址無法開啟';
        try {
          const official = new URL(item.source_url);
          if (official.protocol === 'https:') {
            source = `<a href="${escape(official.href)}" target="_blank" rel="noopener noreferrer">開啟館方原頁 ↗</a>`;
          }
        } catch { /* 保留不可開啟標記。 */ }
        const needsReview = item.reviewed_missed_runs < item.missed_runs;
        const detail = `/missing/record?museum=${encodeURIComponent(item.museum_id)}&provider=${encodeURIComponent(item.provider)}&key=${encodeURIComponent(item.source_key)}`;
        return `<li><a href="${detail}">${escape(item.title)}</a> · ${escape(item.museum_id)} · 連續缺席 ${escape(item.missed_runs)} 次 · ${needsReview ? '待核對' : '本次已核對'} · ${source}</li>`;
      }).join('');
      page(response, 200, `<p><a href="/">← 待審來源紀錄</a></p><h1>來源清單缺席候選</h1><p>這只表示成功匯入後未在該次來源資料看見；可能是分頁、來源漏資料或下架。展覽不會因此自動隱藏，請向館方核對。</p><ul>${links || '<li>目前沒有缺席候選</li>'}</ul>`);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/missing/record') {
      const museum = url.searchParams.get('museum') ?? '';
      const provider = url.searchParams.get('provider') ?? '';
      const key = url.searchParams.get('key') ?? '';
      if (!/^[a-z0-9-]{1,50}$/.test(museum) || !/^[a-z0-9-]{1,50}$/.test(provider)
        || !key || key.length > 1000) { fail(response, 400, '來源參數無效'); return; }
      const result = await pool.query(`SELECT c.missed_runs,c.reviewed_missed_runs,c.first_missing_at,
        c.last_missing_at,e.title,e.source_url,e.start_date,e.end_date
        FROM source_missing_candidates c JOIN exhibitions e ON e.id=c.exhibition_id
        WHERE c.museum_id=$1 AND c.provider=$2 AND c.source_key=$3 AND c.status='pending'`,
      [museum, provider, key]);
      if (!result.rows.length) { fail(response, 404, '找不到待審的缺席候選'); return; }
      const item = result.rows[0];
      const history = await pool.query(`SELECT decision,evidence_url,reviewer,note,created_at,observed_missed_runs
        FROM source_missing_reviews WHERE museum_id=$1 AND provider=$2 AND source_key=$3
        ORDER BY created_at DESC LIMIT 10`, [museum, provider, key]);
      const entries = history.rows.map((row) => `<li>${escape(row.created_at)} · 第 ${escape(row.observed_missed_runs)} 次缺席 · ${row.decision === 'keep_visible' ? '核對後保留' : '需後續追查'} · ${escape(row.reviewer)} · ${escape(row.note)} · <a href="${escape(row.evidence_url)}" target="_blank" rel="noopener noreferrer">證據 ↗</a></li>`).join('');
      let source = '原始來源網址不可開啟';
      try {
        const official = new URL(item.source_url);
        if (official.protocol === 'https:') source = `<a href="${escape(official.href)}" target="_blank" rel="noopener noreferrer">開啟館方原頁 ↗</a>`;
      } catch { /* 保留不可開啟標記。 */ }
      const formHtml = item.reviewed_missed_runs < item.missed_runs
        ? `<form method="post" action="/missing/review"><input type="hidden" name="csrf" value="${user.csrf}"><input type="hidden" name="museum" value="${escape(museum)}"><input type="hidden" name="provider" value="${escape(provider)}"><input type="hidden" name="key" value="${escape(key)}"><label>核對結果<select name="decision" required><option value="keep_visible">核對後保留展覽</option><option value="follow_up">需後續追查</option></select></label><label>同一官方來源網域的證據網址<input name="evidenceUrl" type="url" required maxlength="1000" value="${escape(item.source_url)}"></label><label>審查人<input name="reviewer" required maxlength="100"></label><label>核對說明<textarea name="note" required maxlength="500"></textarea></label><button>記錄本次核對</button></form>`
        : '<p>本次缺席已核對；若下次官方匯入仍缺席，會再次開放核對。</p>';
      page(response, 200, `<p><a href="/missing">← 缺席清單</a></p><h1>${escape(item.title)}</h1><p>${escape(museum)} · ${escape(provider)} · 連續缺席 ${escape(item.missed_runs)} 次</p><p>展期：${escape(item.start_date)} 至 ${escape(item.end_date)}。${source}</p><p>請確認館方來源是否完整，以及展覽是否仍在展出。此操作只留下審查紀錄，不會自動下架。</p>${formHtml}<h2>最近核對紀錄</h2><ul>${entries || '<li>尚無核對紀錄</li>'}</ul>`);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/record') {
      const museum = url.searchParams.get('museum') ?? '';
      const key = url.searchParams.get('key') ?? '';
      if (!['nmmba', 'npm-north'].includes(museum) || !key || key.length > 1000) {
        fail(response, 400, '來源參數無效'); return;
      }
      const result = await pool.query(`SELECT source_url,raw_record,status,reason FROM source_records
        WHERE museum_id=$1 AND provider=$1 AND source_key=$2 AND status IN ('review','approved')`, [museum, key]);
      if (!result.rows.length) { fail(response, 404, '找不到待審紀錄'); return; }
      const item = result.rows[0];
      const source = typeof item.source_url === 'string' && /^https:\/\/(www\.)?(nmmba\.gov\.tw|npm\.gov\.tw)\//.test(item.source_url)
        ? `<a href="${escape(item.source_url)}" target="_blank" rel="noopener noreferrer">開啟館方原始頁 ↗</a>` : '原始網址未通過顯示檢查';
      page(response, 200, `<p><a href="/">← 待審清單</a></p><h1>核對來源紀錄</h1><p>館別：${escape(museum)}｜來源鍵：${escape(key)}｜狀態：${escape(item.status)}</p><p>原因：${escape(item.reason)}</p><p>${source}</p><details><summary>查看原始 JSON</summary><pre>${escape(JSON.stringify(item.raw_record, null, 2))}</pre></details><p>請先在館方詳情頁確認這筆展覽的起訖日期，再填寫補正。</p><form method="post" action="/approve"><input type="hidden" name="csrf" value="${user.csrf}"><input type="hidden" name="museum" value="${escape(museum)}"><input type="hidden" name="key" value="${escape(key)}"><label>開始日<input name="startDate" type="date" required></label><label>結束日<input name="endDate" type="date" required></label><label>館方證據網址<input name="evidenceUrl" type="url" required value="${escape(item.source_url)}"></label><label>審查人<input name="reviewer" required maxlength="100"></label><label>核對說明<textarea name="note" required maxlength="500"></textarea></label><button>記錄補正</button></form>`);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/') {
      const result = await pool.query(`SELECT museum_id,source_key,status,reason,
        COALESCE(raw_record->>'特展名稱',raw_record->>'title') AS title
        FROM source_records WHERE provider=museum_id AND status='review'
          AND museum_id IN ('nmmba','npm-north')
        ORDER BY last_seen_at DESC,museum_id,source_key LIMIT 100`);
      const links = result.rows.map((row) => `<li><a href="/record?museum=${encodeURIComponent(row.museum_id)}&key=${encodeURIComponent(row.source_key)}">${escape(row.title || row.source_key)}</a> · ${escape(row.museum_id)} · ${escape(row.reason)}</li>`).join('');
      page(response, 200, `<h1>待審來源紀錄</h1><p>顯示最近 100 筆，共 ${result.rows.length} 筆。此頁只在本機啟用。</p><p><a href="/health">查看來源健康觀測</a> · <a href="/missing">查看來源清單缺席候選</a></p><ul>${links || '<li>目前沒有待審紀錄</li>'}</ul><form method="post" action="/logout"><input type="hidden" name="csrf" value="${user.csrf}"><button>登出</button></form>`);
      return;
    }
    fail(response, 404, '找不到頁面');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/缺漏|過長|無效|找不到可補正|找不到待審|已核對|展期|官方|尚不支援|缺少|早於|證據/.test(message)) {
      fail(response, 400, message);
    } else {
      process.stderr.write(`${message}\n`);
      fail(response, 500, '管理服務暫時無法處理請求');
    }
  }
});

try {
  await pool.query('SELECT 1');
  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`Event Radar admin listening on ${origin}\n`);
  });
} catch {
  process.stderr.write('Event Radar 管理服務無法連接資料庫，HTTP 服務未啟動\n');
  await pool.end();
  process.exitCode = 1;
}
