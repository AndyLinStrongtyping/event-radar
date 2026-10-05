import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';
import { visitStatus, validVisitDate } from './visit-status.ts';

if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function date(value: string | null, name: string): string | null {
  if (value === null) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${name} 必須是有效的 YYYY-MM-DD`);
  }
  return value;
}

function numeric(value: string | null, fallback: number, max: number, name: string): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value) || Number(value) > max || (name === 'limit' && Number(value) === 0)) {
    throw new Error(`${name} 參數無效`);
  }
  return Number(value);
}

const fields = `e.id,e.title,e.museum_id AS "museumId",m.name AS "museumName",m.city,
  m.source_status AS "sourceStatus",
  e.venue,to_char(e.start_date,'YYYY-MM-DD') AS "startDate",
  to_char(e.end_date,'YYYY-MM-DD') AS "endDate",e.price_note AS "priceNote",
  e.source_url AS "sourceUrl",e.summary,e.last_seen_at AS "lastSeenAt",
  e.is_sample AS "isSample"`;

const staticFiles = new Map<string, [string, string]>([
  ['/', ['../web/index.html', 'text/html; charset=utf-8']],
  ['/guides/chimei.html', ['../web/guides/chimei.html', 'text/html; charset=utf-8']],
  ['/guides/nmns.html', ['../web/guides/nmns.html', 'text/html; charset=utf-8']],
  ['/guides/ntm.html', ['../web/guides/ntm.html', 'text/html; charset=utf-8']],
  ['/guides/nmth.html', ['../web/guides/nmth.html', 'text/html; charset=utf-8']],
  ['/guides/npm-south.html', ['../web/guides/npm-south.html', 'text/html; charset=utf-8']],
  ['/guides/npm-north.html', ['../web/guides/npm-north.html', 'text/html; charset=utf-8']],
  ['/guides/nmmba.html', ['../web/guides/nmmba.html', 'text/html; charset=utf-8']],
  ['/guides/nstm.html', ['../web/guides/nstm.html', 'text/html; charset=utf-8']],
  ['/guides/ntsec.html', ['../web/guides/ntsec.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['../web/styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['../web/app.js', 'text/javascript; charset=utf-8']],
  ['/transport.js', ['../web/transport.js', 'text/javascript; charset=utf-8']],
  ['/assets/hero-ruins.png', ['../web/assets/hero-ruins.png', 'image/png']],
  ['/assets/nstm-switchboard.jpg', ['../web/assets/nstm-switchboard.jpg', 'image/jpeg']],
  ['/assets/nmns-mummy-commons.jpg', ['../web/assets/nmns-mummy-commons.jpg', 'image/jpeg']],
  ['/assets/nmns-dinosaur-user.jpg', ['../web/assets/nmns-dinosaur-user.jpg', 'image/jpeg']],
  ['/assets/nmns-amethyst-user.jpg', ['../web/assets/nmns-amethyst-user.jpg', 'image/jpeg']],
  ['/assets/nmns-fluorescent-minerals-user.jpg', ['../web/assets/nmns-fluorescent-minerals-user.jpg', 'image/jpeg']],
  ['/assets/chimei-instrument-hall-commons.jpg', ['../web/assets/chimei-instrument-hall-commons.jpg', 'image/jpeg']],
  ['/assets/npm-south-building-commons.jpg', ['../web/assets/npm-south-building-commons.jpg', 'image/jpeg']],
  ['/assets/npm-north-building-commons.jpg', ['../web/assets/npm-north-building-commons.jpg', 'image/jpeg']],
  ['/assets/nmmba-kelp-commons.jpg', ['../web/assets/nmmba-kelp-commons.jpg', 'image/jpeg']],
  ['/assets/npm-teacup-commons.jpg', ['../web/assets/npm-teacup-commons.jpg', 'image/jpeg']],
]);

const server = createServer(async (request, response) => {
  try {
    if (request.method !== 'GET') {
      json(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: '只支援 GET' } });
      return;
    }
    const url = new URL(request.url ?? '/', 'http://localhost');
    const asset = staticFiles.get(url.pathname);
    if (asset) {
      response.writeHead(200, { 'content-type': asset[1] });
      response.end(await readFile(new URL(asset[0], import.meta.url)));
      return;
    }
    if (url.pathname === '/health') {
      await pool.query('SELECT 1');
      json(response, 200, { status: 'ok', database: 'ok' });
      return;
    }
    if (url.pathname === '/museums') {
      const result = await pool.query(`SELECT id,name,city,homepage_url AS "homepageUrl",
        source_status AS "sourceStatus",last_success_at AS "lastSuccessAt" FROM museums ORDER BY name`);
      json(response, 200, { items: result.rows });
      return;
    }
    if (url.pathname === '/visit-status') {
      const museum = url.searchParams.get('museum') ?? '';
      const requestedDate = url.searchParams.get('date') ?? '';
      if (!validVisitDate(requestedDate) || !/^[a-z0-9-]{1,40}$/.test(museum)) {
        json(response, 400, { error: { code: 'BAD_REQUEST', message: '館所或日期無效' } });
        return;
      }
      try { json(response, 200, await visitStatus(museum, requestedDate)); }
      catch { json(response, 400, { error: { code: 'BAD_REQUEST', message: '館所或日期無效' } }); }
      return;
    }
    if (url.pathname === '/exhibitions') {
      const q = url.searchParams;
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      const from = date(q.get('from') ?? today, 'from');
      const to = date(q.get('to'), 'to');
      if (to && from && to < from) throw new Error('to 不可早於 from');
      const limit = numeric(q.get('limit'), 20, 100, 'limit');
      const offset = numeric(q.get('offset'), 0, 100000, 'offset');
      const city = q.get('city')?.trim() || null;
      const museum = q.get('museum')?.trim() || null;
      const keyword = q.get('q')?.trim() || null;
      if ([city, museum, keyword].some((value) => value && value.length > 100)) throw new Error('搜尋文字太長');
      const includeSample = q.get('includeSample') === 'true';
      if (q.has('includeSample') && !['true', 'false'].includes(q.get('includeSample')!)) throw new Error('includeSample 參數無效');
      const where = `($1::text IS NULL OR m.city=$1) AND ($2::text IS NULL OR e.museum_id=$2)
        AND ($3::text IS NULL OR e.title ILIKE '%' || $3 || '%')
        AND ($4::date IS NULL OR e.end_date >= $4)
        AND ($5::date IS NULL OR e.start_date <= $5)
        AND ($6::boolean OR NOT e.is_sample) AND e.visible`;
      const params = [city, museum, keyword, from, to, includeSample];
      const [items, total] = await Promise.all([
        pool.query(`SELECT ${fields} FROM exhibitions e JOIN museums m ON m.id=e.museum_id
          WHERE ${where} ORDER BY e.start_date,e.id LIMIT $7 OFFSET $8`, [...params, limit, offset]),
        pool.query(`SELECT count(*)::int AS total FROM exhibitions e JOIN museums m ON m.id=e.museum_id
          WHERE ${where}`, params),
      ]);
      json(response, 200, { items: items.rows, total: total.rows[0].total, limit, offset });
      return;
    }
    const match = url.pathname.match(/^\/exhibitions\/([0-9a-f-]{36})$/i);
    if (match) {
      const includeSample = url.searchParams.get('includeSample') === 'true';
      const result = await pool.query(`SELECT ${fields} FROM exhibitions e JOIN museums m ON m.id=e.museum_id
        WHERE e.id=$1 AND e.visible`, [match[1]]);
      if (!result.rowCount || (result.rows[0].isSample && !includeSample)) {
        json(response, 404, { error: { code: 'NOT_FOUND', message: '找不到特展' } });
      } else json(response, 200, result.rows[0]);
      return;
    }
    const changesMatch = url.pathname.match(/^\/exhibitions\/([0-9a-f-]{36})\/changes$/i);
    if (changesMatch) {
      const includeSample = url.searchParams.get('includeSample') === 'true';
      const exhibition = await pool.query('SELECT 1 FROM exhibitions WHERE id=$1 AND visible AND ($2::boolean OR NOT is_sample)',
        [changesMatch[1], includeSample]);
      if (!exhibition.rowCount) {
        json(response, 404, { error: { code: 'NOT_FOUND', message: '找不到特展' } });
        return;
      }
      const changes = await pool.query(`SELECT field_name AS "field",old_value AS "oldValue",
        new_value AS "newValue",detected_at AS "detectedAt" FROM exhibition_changes
        WHERE exhibition_id=$1 ORDER BY detected_at DESC,id DESC LIMIT 100`, [changesMatch[1]]);
      json(response, 200, { items: changes.rows });
      return;
    }
    json(response, 404, { error: { code: 'NOT_FOUND', message: '找不到路徑' } });
  } catch (error) {
    if (error instanceof Error && /必須是有效的|不可早於|參數無效|太長/.test(error.message)) {
      json(response, 400, { error: { code: 'BAD_REQUEST', message: error.message } });
    } else {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      json(response, 500, { error: { code: 'INTERNAL_ERROR', message: '服務暫時無法處理請求' } });
    }
  }
});

server.listen(Number(process.env.PORT ?? 3000), '127.0.0.1', () => {
  process.stdout.write(`Event Radar listening on http://127.0.0.1:${process.env.PORT ?? 3000}\n`);
});
