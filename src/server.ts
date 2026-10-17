import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';
import { visitStatus, validVisitDate } from './visit-status.ts';
import { sourceFreshness } from './source-freshness.ts';
import { museumTickets, ticketingForExhibition } from './ticketing.ts';

if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const publicBaseUrl = process.env.PUBLIC_BASE_URL ? new URL(process.env.PUBLIC_BASE_URL) : null;
if (publicBaseUrl && (publicBaseUrl.protocol !== 'https:' || publicBaseUrl.pathname !== '/'
  || publicBaseUrl.search || publicBaseUrl.hash || publicBaseUrl.username || publicBaseUrl.password)) {
  throw new Error('PUBLIC_BASE_URL 必須是 HTTPS 網站根網址');
}

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

const freePriceNotes = ['免費', '免費入場', '免門票'] as const;
type ExhibitionRow = { startDate: string; endDate: string; priceNote: string | null;
  museumId: string; sourceUrl: string; isSample: boolean } & Record<string, unknown>;
function withSearchStatus(row: ExhibitionRow, asOf: string) {
  return { ...row,
    ticketing: ticketingForExhibition(row),
    exhibitionStatus: row.endDate < asOf ? 'ended' : row.startDate > asOf ? 'upcoming' : 'ongoing',
    admissionStatus: row.priceNote && freePriceNotes.includes(row.priceNote as typeof freePriceNotes[number])
      ? 'free' : 'unknown',
  };
}

const fields = `e.id,e.title,e.museum_id AS "museumId",m.name AS "museumName",m.city,
  m.source_status AS "sourceStatus",
  e.venue,to_char(e.start_date,'YYYY-MM-DD') AS "startDate",
  to_char(e.end_date,'YYYY-MM-DD') AS "endDate",e.price_note AS "priceNote",
  e.source_url AS "sourceUrl",e.summary,e.last_seen_at AS "lastSeenAt",
  e.is_sample AS "isSample",
  (SELECT jsonb_build_object('artistNames',a.artist_names,'curatorNames',a.curator_names,
    'exhibitionType',a.exhibition_type,'venueArea',a.venue_area,'floor',a.floor,
    'relatedEvents',COALESCE((SELECT jsonb_agg(jsonb_build_object('title',r.title,
      'sourceUrl',r.source_url,'eventType',r.event_type) ORDER BY r.source_url)
      FROM art_related_events r WHERE r.exhibition_id=e.id),'[]'::jsonb))
    FROM art_exhibition_details a WHERE a.exhibition_id=e.id) AS art`;

const staticFiles = new Map<string, [string, string]>([
  ['/', ['../web/react-build/index.html', 'text/html; charset=utf-8']],
  ['/guides/chimei.html', ['../web/guides/chimei.html', 'text/html; charset=utf-8']],
  ['/guides/nmns.html', ['../web/guides/nmns.html', 'text/html; charset=utf-8']],
  ['/guides/ntm.html', ['../web/guides/ntm.html', 'text/html; charset=utf-8']],
  ['/guides/nmth.html', ['../web/guides/nmth.html', 'text/html; charset=utf-8']],
  ['/guides/npm-south.html', ['../web/guides/npm-south.html', 'text/html; charset=utf-8']],
  ['/guides/npm-north.html', ['../web/guides/npm-north.html', 'text/html; charset=utf-8']],
  ['/guides/nmmba.html', ['../web/guides/nmmba.html', 'text/html; charset=utf-8']],
  ['/guides/okinawa-churaumi.html', ['../web/guides/okinawa-churaumi.html', 'text/html; charset=utf-8']],
  ['/guides/penghu-fossil.html', ['../web/guides/penghu-fossil.html', 'text/html; charset=utf-8']],
  ['/guides/zuojhen-fossil.html', ['../web/guides/zuojhen-fossil.html', 'text/html; charset=utf-8']],
  ['/guides/nstm.html', ['../web/guides/nstm.html', 'text/html; charset=utf-8']],
  ['/guides/ntsec.html', ['../web/guides/ntsec.html', 'text/html; charset=utf-8']],
  ['/guides/ntmofa.html', ['../web/guides/ntmofa.html', 'text/html; charset=utf-8']],
  ['/guides/ntt.html', ['../web/guides/ntt.html', 'text/html; charset=utf-8']],
  ['/photo-credits.html', ['../web/photo-credits.html', 'text/html; charset=utf-8']],
  ['/chimei-activities.json', ['../data/chimei-activities.json', 'application/json; charset=utf-8']],
  ['/styles.css', ['../web/styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['../web/app.js', 'text/javascript; charset=utf-8']],
  ['/transport.js', ['../web/transport.js', 'text/javascript; charset=utf-8']],
  ['/back-to-top.js', ['../web/back-to-top.js', 'text/javascript; charset=utf-8']],
  ['/assets/hero-ruins.png', ['../web/assets/hero-ruins.png', 'image/png']],
  ['/assets/egypt-writing-user.jpg', ['../web/assets/egypt-writing-user.jpg', 'image/jpeg']],
  ['/assets/nstm-switchboard.jpg', ['../web/assets/nstm-switchboard.jpg', 'image/jpeg']],
  ['/assets/nmns-mummy-commons.jpg', ['../web/assets/nmns-mummy-commons.jpg', 'image/jpeg']],
  ['/assets/nmns-dinosaur-user.jpg', ['../web/assets/nmns-dinosaur-user.jpg', 'image/jpeg']],
  ['/assets/nmns-amethyst-user.jpg', ['../web/assets/nmns-amethyst-user.jpg', 'image/jpeg']],
  ['/assets/nmns-fluorescent-minerals-user.jpg', ['../web/assets/nmns-fluorescent-minerals-user.jpg', 'image/jpeg']],
  ['/assets/chimei-instrument-hall-commons.jpg', ['../web/assets/chimei-instrument-hall-commons.jpg', 'image/jpeg']],
  ['/assets/npm-south-building-commons.jpg', ['../web/assets/npm-south-building-commons.jpg', 'image/jpeg']],
  ['/assets/npm-north-building-commons.jpg', ['../web/assets/npm-north-building-commons.jpg', 'image/jpeg']],
  ['/assets/nmmba-kelp-commons.jpg', ['../web/assets/nmmba-kelp-commons.jpg', 'image/jpeg']],
  ['/assets/okinawa-churaumi-commons.jpg', ['../web/assets/okinawa-churaumi-commons.jpg', 'image/jpeg']],
  ['/assets/species-formosan-salmon-commons.jpg', ['../web/assets/species-formosan-salmon-commons.jpg', 'image/jpeg']],
  ['/assets/species-beluga-commons.jpg', ['../web/assets/species-beluga-commons.jpg', 'image/jpeg']],
  ['/assets/species-nmmba-penguins-commons.jpg', ['../web/assets/species-nmmba-penguins-commons.jpg', 'image/jpeg']],
  ['/assets/species-churaumi-whale-shark-commons.jpg', ['../web/assets/species-churaumi-whale-shark-commons.jpg', 'image/jpeg']],
  ['/assets/species-giant-manta-commons.jpg', ['../web/assets/species-giant-manta-commons.jpg', 'image/jpeg']],
  ['/assets/fossil-penghu-elephant-commons.jpg', ['../web/assets/fossil-penghu-elephant-commons.jpg', 'image/jpeg']],
  ['/assets/fossil-penghu-crocodile-gov.jpg', ['../web/assets/fossil-penghu-crocodile-gov.jpg', 'image/jpeg']],
  ['/assets/fossil-zuojhen-rhino-commons.jpg', ['../web/assets/fossil-zuojhen-rhino-commons.jpg', 'image/jpeg']],
  ['/assets/fossil-zuojhen-crocodile-commons.jpg', ['../web/assets/fossil-zuojhen-crocodile-commons.jpg', 'image/jpeg']],
  ['/assets/fossil-zuojhen-building-commons.jpg', ['../web/assets/fossil-zuojhen-building-commons.jpg', 'image/jpeg']],
  ['/assets/npm-teacup-commons.jpg', ['../web/assets/npm-teacup-commons.jpg', 'image/jpeg']],
  ['/assets/ntm-building-commons.jpg', ['../web/assets/ntm-building-commons.jpg', 'image/jpeg']],
  ['/assets/nmth-building-commons.jpg', ['../web/assets/nmth-building-commons.jpg', 'image/jpeg']],
  ['/assets/ntsec-building-commons.jpg', ['../web/assets/ntsec-building-commons.jpg', 'image/jpeg']],
  ['/assets/ntmofa-building-commons.jpg', ['../web/assets/ntmofa-building-commons.jpg', 'image/jpeg']],
  ['/assets/ntt-building-commons.jpg', ['../web/assets/ntt-building-commons.jpg', 'image/jpeg']],
]);
const indexablePaths = ['/', ...[...staticFiles.keys()].filter((path) => path.startsWith('/guides/'))];

const server = createServer(async (request, response) => {
  try {
    if (!publicBaseUrl) response.setHeader('x-robots-tag', 'noindex');
    if (request.method !== 'GET') {
      json(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: '只支援 GET' } });
      return;
    }
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/robots.txt') {
      const body = publicBaseUrl
        ? `User-agent: *\nAllow: /\nSitemap: ${publicBaseUrl.origin}/sitemap.xml\n`
        : 'User-agent: *\nAllow: /\n';
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(body);
      return;
    }
    if (url.pathname === '/sitemap.xml') {
      if (!publicBaseUrl) {
        json(response, 404, { error: { code: 'NOT_FOUND', message: '尚未設定公開網址' } });
        return;
      }
      const urls = indexablePaths.map((path) => `<url><loc>${publicBaseUrl.origin}${path}</loc></url>`).join('');
      response.writeHead(200, { 'content-type': 'application/xml; charset=utf-8' });
      response.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
      return;
    }
    if (/^\/react-assets\/[a-zA-Z0-9_-]+\.(js|css)$/.test(url.pathname)) {
      const mime = url.pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
      response.writeHead(200, { 'content-type': mime, 'cache-control': 'public, max-age=31536000, immutable' });
      response.end(await readFile(new URL(`../web/react-build${url.pathname}`, import.meta.url)));
      return;
    }
    const asset = staticFiles.get(url.pathname);
    if (asset) {
      response.writeHead(200, { 'content-type': asset[1] });
      const content = await readFile(new URL(asset[0], import.meta.url));
      if (publicBaseUrl && asset[1].startsWith('text/html')) {
        
const canonical = `<link rel="canonical" href="${publicBaseUrl.origin}${url.pathname}">`;

const ga4Tag = `
<script async src="https://www.googletagmanager.com/gtag/js?id=G-HMD9YGX1X3"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-HMD9YGX1X3');
</script>`;

response.end(
  content.toString('utf8').replace(
    /<\/head>/i,
    `${canonical}${ga4Tag}</head>`
  )
);

      } else response.end(content);
      return;
    }
    if (url.pathname === '/health') {
      try {
        await pool.query('SELECT 1');
        json(response, 200, { status: 'ok', database: 'ok' });
      } catch {
        json(response, 503, { error: { code: 'NOT_READY', message: '資料庫尚未就緒' } });
      }
      return;
    }
    if (url.pathname === '/museums') {
      const result = await pool.query(`SELECT id,name,city,venue_type AS "venueType",homepage_url AS "homepageUrl",
        source_status AS "sourceStatus",last_success_at AS "lastSuccessAt",
        last_official_success_at AS "lastOfficialSuccessAt",
        latest.status AS "lastAttemptStatus",latest.created_at AS "lastAttemptAt",
        coverage.coverage_status AS "coverageStatus",
        COALESCE(pending.review_count,0)::int AS "pendingReviewCount"
        FROM museums m
        LEFT JOIN LATERAL (SELECT status,created_at FROM sync_attempts
          WHERE museum_id=m.id ORDER BY created_at DESC,id DESC LIMIT 1) latest ON true
        LEFT JOIN LATERAL (SELECT coverage_status FROM ingestion_runs
          WHERE museum_id=m.id AND coverage_status <> 'not_applicable'
          ORDER BY started_at DESC,id DESC LIMIT 1) coverage ON true
        LEFT JOIN LATERAL (SELECT count(*)::int AS review_count FROM source_records
          WHERE museum_id=m.id AND status='review') pending ON true
        ORDER BY name`);
      const now = new Date();
      json(response, 200, { items: result.rows.map((museum) => ({
        ...museum,
        dataStatus: sourceFreshness(museum.sourceStatus, museum.lastOfficialSuccessAt, museum.lastAttemptStatus, now),
        generalAdmission: museumTickets[museum.id] ?? null,
      })) });
      return;
    }
    if (url.pathname === '/performances' || url.pathname === '/marine-programmes') {
      const domain = url.pathname === '/performances' ? 'performance' : 'marine';
      const limit = numeric(url.searchParams.get('limit'), 20, 100, 'limit');
      const offset = numeric(url.searchParams.get('offset'), 0, 100000, 'offset');
      const sourceId = url.searchParams.get('source')?.trim() || null;
      if (sourceId && !/^[a-z0-9-]{1,40}$/.test(sourceId)) throw new Error('篩選參數無效');
      const period = domain === 'performance' ? url.searchParams.get('period') ?? 'upcoming' : 'all';
      if (!['upcoming', 'all'].includes(period) || (domain === 'marine' && url.searchParams.has('period'))) {
        throw new Error('period 參數無效');
      }
      const observedDate = url.searchParams.get('date');
      if (observedDate !== null && (domain !== 'marine' || !validVisitDate(observedDate))) {
        throw new Error('date 參數無效');
      }
      if (observedDate !== null) {
        const archive = sourceId && sourceId !== 'nmmba' ? null : (await pool.query<{
          items: Record<string, unknown>[];
        }>(`SELECT items FROM marine_daily_observations
          WHERE source_id='nmmba' AND observed_on=$1::date
          ORDER BY last_seen_at DESC,first_seen_at DESC,snapshot_hash DESC LIMIT 1`,
        [observedDate])).rows[0];
        const items = archive?.items ?? [];
        json(response,200,{items:items.slice(offset,offset+limit),total:items.length,limit,offset});
        return;
      }
      const cutoff = new Date().toISOString();
      const eligibleSession = `s.starts_at >= $4::timestamptz AND s.status IN ('scheduled','sold_out')`;
      const conditions = `d.domain=$1 AND ($2::text IS NULL OR d.source_id=$2)
        AND ($3::text='all' OR EXISTS (SELECT 1 FROM event_sessions s
          WHERE s.event_id=d.id AND ${eligibleSession}))
        AND ($3::text='all' OR d.source_id<>'ntt' OR COALESCE((
          SELECT d.source_key=ANY(r.identity_keys) FROM domain_source_runs r
          WHERE r.source_id='ntt' AND r.scope='ntt_place1_list'
            AND r.status='succeeded' AND r.identity_keys IS NOT NULL
          ORDER BY r.finished_at DESC,r.id DESC LIMIT 1),true))
        AND ($1::text <> 'marine' OR d.source_checked_at = (
          SELECT max(latest.source_checked_at) FROM domain_events latest
          WHERE latest.domain='marine' AND latest.source_id=d.source_id))`;
      const [items, count] = await Promise.all([
        pool.query(`SELECT d.id,d.source_id AS "sourceId",d.source_key AS "sourceKey",
          d.domain,d.title,d.venue,d.source_url AS "sourceUrl",d.ticket_url AS "ticketUrl",
          d.price_note AS "priceNote",d.source_checked_at AS "sourceCheckedAt",
          to_char(d.observed_on,'YYYY-MM-DD') AS "observedOn",
          CASE WHEN d.domain='performance' THEN
            COALESCE((SELECT jsonb_agg(jsonb_build_object('sessionKey',s.session_key,
              'startsAt',s.starts_at,
              'hall',s.hall,'ticketUrl',s.ticket_url,'priceMin',s.price_min,
              'priceMax',s.price_max,'status',s.status,'statusOrigin',s.status_origin,
              'statusEvidenceUrl',s.status_evidence_url,'statusReviewedAt',s.status_reviewed_at)
              ORDER BY s.starts_at)
              FROM event_sessions s WHERE s.event_id=d.id
                AND ($3::text='all' OR (${eligibleSession}))),'[]'::jsonb)
            ELSE NULL END AS sessions,
          CASE WHEN d.domain='marine' THEN
            COALESCE((SELECT jsonb_agg(jsonb_build_object('localTime',to_char(r.local_time,'HH24:MI'),
              'durationMinutes',r.duration_minutes,'venue',r.venue,'timezone',r.timezone)
              ORDER BY r.local_time) FROM recurring_schedules r WHERE r.event_id=d.id),'[]'::jsonb)
            ELSE NULL END AS "dailySchedule"
          FROM domain_events d WHERE ${conditions}
          ORDER BY CASE WHEN $3::text='upcoming' THEN (SELECT min(s.starts_at)
            FROM event_sessions s WHERE s.event_id=d.id AND ${eligibleSession}) END ASC NULLS LAST,
            d.source_checked_at DESC,d.id LIMIT $5 OFFSET $6`,[domain,sourceId,period,cutoff,limit,offset]),
        pool.query(`SELECT count(*)::int AS total FROM domain_events d WHERE ${conditions}`,
          [domain,sourceId,period,cutoff]),
      ]);
      json(response,200,{items:items.rows,total:count.rows[0].total,limit,offset});
      return;
    }
    if (url.pathname === '/marine-observation-days') {
      const limit = numeric(url.searchParams.get('limit'), 20, 100, 'limit');
      const offset = numeric(url.searchParams.get('offset'), 0, 100000, 'offset');
      const [days,count] = await Promise.all([
        pool.query(`SELECT to_char(observed_on,'YYYY-MM-DD') AS date,
          count(*)::int AS "versionCount",max(last_seen_at) AS "lastCheckedAt"
          FROM marine_daily_observations WHERE source_id='nmmba'
          GROUP BY observed_on ORDER BY observed_on DESC LIMIT $1 OFFSET $2`,[limit,offset]),
        pool.query<{ total: number }>(`SELECT count(DISTINCT observed_on)::int AS total
          FROM marine_daily_observations WHERE source_id='nmmba'`),
      ]);
      json(response,200,{items:days.rows,total:count.rows[0].total,limit,offset});
      return;
    }
    if (url.pathname === '/visit-status') {
      const museum = url.searchParams.get('museum') ?? '';
      const requestedDate = url.searchParams.get('date') ?? '';
      if (!validVisitDate(requestedDate) || !/^[a-z0-9-]{1,40}$/.test(museum)) {
        json(response, 400, { error: { code: 'BAD_REQUEST', message: '館所或日期無效' } });
        return;
      }
      try { json(response, 200, await visitStatus(museum, requestedDate, new Date(), pool)); }
      catch (error) {
        if (!(error instanceof Error) || error.message !== '館所或日期無效') throw error;
        json(response, 400, { error: { code: 'BAD_REQUEST', message: error.message } });
      }
      return;
    }
    if (url.pathname === '/exhibitions') {
      const q = url.searchParams;
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      const asOf = date(q.get('asOf') ?? today, 'asOf')!;
      const from = date(q.get('from'), 'from');
      const to = date(q.get('to'), 'to');
      if (to && from && to < from) throw new Error('to 不可早於 from');
      const status = q.get('status') ?? 'active';
      const admission = q.get('admission') ?? 'all';
      if (!['active', 'ongoing', 'upcoming', 'ended', 'all'].includes(status)
        || !['all', 'free'].includes(admission)) throw new Error('篩選參數無效');
      const limit = numeric(q.get('limit'), 20, 100, 'limit');
      const offset = numeric(q.get('offset'), 0, 100000, 'offset');
      const city = q.get('city')?.trim() || null;
      const museum = q.get('museum')?.trim() || null;
      const keyword = q.get('q')?.trim() || null;
      if ([city, museum, keyword].some((value) => value && value.length > 100)) throw new Error('搜尋文字太長');
      const literalKeyword = keyword?.replace(/[#%_]/g, '#$&') ?? null;
      const includeSample = q.get('includeSample') === 'true';
      if (q.has('includeSample') && !['true', 'false'].includes(q.get('includeSample')!)) throw new Error('includeSample 參數無效');
      const where = `($1::text IS NULL OR m.city=$1) AND ($2::text IS NULL OR e.museum_id=$2)
        AND ($3::text IS NULL OR e.title ILIKE '%' || $3 || '%' ESCAPE '#')
        AND ($4::date IS NULL OR e.end_date >= $4)
        AND ($5::date IS NULL OR e.start_date <= $5)
        AND ($6::boolean OR NOT e.is_sample) AND e.visible
        AND ($8::text='all' OR ($8='active' AND e.end_date >= $7::date)
          OR ($8='ongoing' AND e.start_date <= $7::date AND e.end_date >= $7::date)
          OR ($8='upcoming' AND e.start_date > $7::date)
          OR ($8='ended' AND e.end_date < $7::date))
        AND ($9::text='all' OR e.price_note IN ('免費','免費入場','免門票'))`;
      const params = [city, museum, literalKeyword, from, to, includeSample, asOf, status, admission];
      const order = status === 'ended' ? 'e.end_date DESC,e.id'
        : status === 'ongoing' ? 'e.end_date,e.id'
        : status === 'all' ? 'e.start_date DESC,e.id' : 'e.start_date,e.id';
      const [items, total] = await Promise.all([
        pool.query(`SELECT ${fields} FROM exhibitions e JOIN museums m ON m.id=e.museum_id
          WHERE ${where} ORDER BY ${order} LIMIT $10 OFFSET $11`, [...params, limit, offset]),
        pool.query(`SELECT count(*)::int AS total FROM exhibitions e JOIN museums m ON m.id=e.museum_id
          WHERE ${where}`, params),
      ]);
      json(response, 200, { items: items.rows.map((row) => withSearchStatus(row, asOf)),
        total: total.rows[0].total, limit, offset });
      return;
    }
    const match = url.pathname.match(/^\/exhibitions\/([0-9a-f-]{36})$/i);
    if (match) {
      const includeSample = url.searchParams.get('includeSample') === 'true';
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric',
        month: '2-digit', day: '2-digit' }).format(new Date());
      const asOf = date(url.searchParams.get('asOf') ?? today, 'asOf')!;
      const result = await pool.query(`SELECT ${fields} FROM exhibitions e JOIN museums m ON m.id=e.museum_id
        WHERE e.id=$1 AND e.visible`, [match[1]]);
      if (!result.rowCount || (result.rows[0].isSample && !includeSample)) {
        json(response, 404, { error: { code: 'NOT_FOUND', message: '找不到特展' } });
      } else json(response, 200, withSearchStatus(result.rows[0], asOf));
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
    const artChangesMatch = url.pathname.match(/^\/exhibitions\/([0-9a-f-]{36})\/art-changes$/i);
    if (artChangesMatch) {
      const includeSample = url.searchParams.get('includeSample') === 'true';
      const exhibition = await pool.query('SELECT 1 FROM exhibitions WHERE id=$1 AND visible AND ($2::boolean OR NOT is_sample)',
        [artChangesMatch[1], includeSample]);
      if (!exhibition.rowCount) {
        json(response, 404, { error: { code: 'NOT_FOUND', message: '找不到特展' } });
        return;
      }
      const changes = await pool.query(`SELECT field_name AS "field",old_value AS "oldValue",
        new_value AS "newValue",detected_at AS "detectedAt" FROM art_exhibition_changes
        WHERE exhibition_id=$1 ORDER BY detected_at DESC,id DESC LIMIT 100`, [artChangesMatch[1]]);
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

try {
  await pool.query('SELECT 1');
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 無效');
  if (host !== '127.0.0.1' && host !== '0.0.0.0') throw new Error('HOST 無效');
  server.listen(port, host, () => {
    process.stdout.write(`Event Radar listening on http://${host}:${port}\n`);
  });
} catch {
  process.stderr.write('Event Radar 無法連接資料庫，HTTP 服務未啟動\n');
  await pool.end();
  process.exitCode = 1;
}
