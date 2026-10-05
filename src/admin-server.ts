import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import process from 'node:process';
import pg from 'pg';
import { approveReview } from './review-service.ts';

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
      page(response, 200, `<h1>待審來源紀錄</h1><p>顯示最近 100 筆，共 ${result.rows.length} 筆。此頁只在本機啟用。</p><ul>${links || '<li>目前沒有待審紀錄</li>'}</ul><form method="post" action="/logout"><input type="hidden" name="csrf" value="${user.csrf}"><button>登出</button></form>`);
      return;
    }
    fail(response, 404, '找不到頁面');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/缺漏|過長|無效|找不到可補正|展期|官方|尚不支援|缺少|早於/.test(message)) {
      fail(response, 400, message);
    } else {
      process.stderr.write(`${message}\n`);
      fail(response, 500, '管理服務暫時無法處理請求');
    }
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Event Radar admin listening on ${origin}\n`);
});
