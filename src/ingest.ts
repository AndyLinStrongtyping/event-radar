import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';
import { changedValues, duplicateCandidates, type ExistingExhibition } from './dedupe.ts';
import { normalizeExhibition, type ExhibitionDraft } from './normalize.ts';
import { normalizeNmnsFeed } from './sources/nmns.ts';
import { fetchNmnsApi } from './nmns-api.ts';
import { mergeNpmSouthPages, npmSouthPages } from './sources/npm-south.ts';
import { classifyNmmbaFeed, nmmbaDataUrl, type SourceRecord } from './sources/nmmba.ts';
import { classifyNpmNorthFeed, npmNorthDataUrl } from './sources/npm-north.ts';
import { classifyNstmFeed, nstmDataUrl, nstmListUrl } from './sources/nstm.ts';
import { classifyMocChimei, mocExhibitionsUrl, verifiedMocChimeiRows } from './sources/moc-chimei.ts';
import { correctedDraft, sourceHash } from './corrections.ts';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function fetchSource(url: string, host: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'EventRadar/0.1 (+https://github.com/AndyLinStrongtyping)', Accept: 'text/html, application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`來源回應 HTTP ${response.status}: ${url}`);
  if (new URL(response.url).hostname !== host) throw new Error('來源重新導向到非官方網域');
  if (Number(response.headers.get('content-length')) > 10_000_000) throw new Error('來源回應過大');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 10_000_000) throw new Error('來源回應過大');
  return new TextDecoder().decode(bytes);
}

type SourceBatch = { rows: ExhibitionDraft[]; records: SourceRecord[] };

async function sourceRows(museum: string, file: string | undefined, snapshot: string | undefined,
  official: boolean, provider: string): Promise<SourceBatch> {
  if (snapshot) {
    const payload: unknown = JSON.parse(await readFile(snapshot, 'utf8'));
    if (museum === 'nmmba') return classifyNmmbaFeed(payload);
    if (museum === 'npm-north') return classifyNpmNorthFeed(payload);
    if (museum === 'nstm' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const snapshot = payload as { data?: unknown; html?: unknown; today?: unknown };
      if (typeof snapshot.html !== 'string' || typeof snapshot.today !== 'string') {
        throw new Error('科工館快照需要 data、html、today');
      }
      return classifyNstmFeed(snapshot.data, snapshot.html, snapshot.today);
    }
    if (museum === 'chimei' && provider === 'culture' && payload && typeof payload === 'object'
      && !Array.isArray(payload)) {
      const item = payload as { data?: unknown; pages?: unknown };
      if (!item.pages || typeof item.pages !== 'object' || Array.isArray(item.pages)) {
        throw new Error('文化部快照需要 data 與 pages');
      }
      const { groups, records } = classifyMocChimei(item.data);
      const pages = new Map(Object.entries(item.pages as Record<string, string>));
      return { rows: verifiedMocChimeiRows(groups, pages), records };
    }
    throw new Error('原始快照目前只支援海生館、故宮北院或科工館');
  }
  if (file) {
    const payload: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(payload)) throw new Error('匯入檔必須是 JSON 陣列');
    return { rows: payload.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('資料列不是物件');
      return normalizeExhibition(item as Record<string, unknown>, museum);
    }), records: [] };
  }
  if (!official) throw new Error('必須指定 --file 或 --official');
  if (museum === 'chimei' && provider === 'culture') {
    const { groups, records } = classifyMocChimei(JSON.parse(await fetchSource(mocExhibitionsUrl, 'cloud.culture.tw')));
    const pages = new Map<string, string>();
    for (const group of groups) pages.set(group.url, await fetchSource(group.url, 'www.chimeimuseum.org'));
    return { rows: verifiedMocChimeiRows(groups, pages), records };
  }
  if (museum === 'nmns') {
    if (process.env.NMNS_API_KEY) {
      return { rows: normalizeNmnsFeed(await fetchNmnsApi('Exhibition/list')), records: [] };
    }
    const source = process.env.NMNS_OPEN_DATA_URL;
    if (!source) throw new Error('請設定 NMNS_API_KEY 或 NMNS_OPEN_DATA_URL');
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.hostname !== 'www.nmns.edu.tw') throw new Error('來源網址必須是科博館官方 HTTPS 網域');
    return { rows: normalizeNmnsFeed(JSON.parse(await fetchSource(url.href, 'www.nmns.edu.tw'))), records: [] };
  }
  if (museum === 'npm-south') {
    const pages: string[] = [];
    for (const url of npmSouthPages) pages.push(await fetchSource(url, 'south.npm.gov.tw'));
    return { rows: mergeNpmSouthPages(pages), records: [] };
  }
  if (museum === 'nmmba') {
    return classifyNmmbaFeed(JSON.parse(await fetchSource(nmmbaDataUrl, 'www.nmmba.gov.tw')));
  }
  if (museum === 'npm-north') {
    return classifyNpmNorthFeed(JSON.parse(await fetchSource(npmNorthDataUrl, 'odapi.npm.gov.tw')));
  }
  if (museum === 'nstm') {
    const [json, html] = await Promise.all([
      fetchSource(nstmDataUrl, 'websrv.nstm.gov.tw'),
      fetchSource(nstmListUrl, 'www.nstm.gov.tw'),
    ]);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    return classifyNstmFeed(JSON.parse(json), html, today);
  }
  throw new Error('此館尚無官方來源匯入器');
}

type Stored = ExhibitionDraft & { id: string; primaryProvider: string; visible: boolean };

async function hideCorrectedExhibition(client: pg.PoolClient, museum: string,
  provider: string, record: SourceRecord, previousUrl: string | null): Promise<void> {
  await client.query(`UPDATE exhibitions SET visible=false,updated_at=now()
    WHERE museum_id=$1 AND (source_url=$2 OR source_url=$5 OR id IN (
      SELECT exhibition_id FROM exhibition_sources
      WHERE museum_id=$1 AND provider=$3 AND source_key=$4))`,
  [museum, record.sourceUrl, provider, record.sourceKey, previousUrl]);
}

async function applyCorrections(client: pg.PoolClient, museum: string, provider: string,
  rows: ExhibitionDraft[], records: SourceRecord[]): Promise<void> {
  for (const record of records) {
    const decision = await client.query<{ source_hash: string; start_date: string;
      end_date: string; evidence_url: string; source_url: string | null }>(`SELECT source_hash,source_url,
        to_char(start_date,'YYYY-MM-DD') AS start_date,
        to_char(end_date,'YYYY-MM-DD') AS end_date,evidence_url
      FROM review_corrections WHERE museum_id=$1 AND provider=$2 AND source_key=$3
      ORDER BY created_at DESC,id DESC LIMIT 1`, [museum, provider, record.sourceKey]);
    if (!decision.rows.length) continue;
    const rowIndex = rows.findIndex((row) => row.sourceUrl === record.sourceUrl);
    if (rowIndex >= 0) rows.splice(rowIndex, 1);
    const latest = decision.rows[0];
    if (latest.source_hash !== sourceHash(record.raw)) {
      record.status = 'review';
      record.reason = '來源內容已變更，原人工補正須重新核對';
      await hideCorrectedExhibition(client, museum, provider, record, latest.source_url);
      continue;
    }
    try {
      rows.push(correctedDraft(museum, record.raw,
        latest.start_date, latest.end_date, latest.evidence_url));
      record.status = 'approved';
      record.reason = '展期依人工核對紀錄補正';
    } catch (error) {
      record.status = 'review';
      record.reason = `人工補正無法套用：${error instanceof Error ? error.message : String(error)}`;
      await hideCorrectedExhibition(client, museum, provider, record, latest.source_url);
    }
  }
}

async function findStored(client: pg.PoolClient, row: ExhibitionDraft, provider: string): Promise<Stored | null> {
  const columns = `id,primary_provider AS "primaryProvider",museum_id AS "museumId",source_key AS "sourceKey",
    title,venue,visible,to_char(start_date,'YYYY-MM-DD') AS "startDate",
    to_char(end_date,'YYYY-MM-DD') AS "endDate",price_note AS "priceNote",
    source_url AS "sourceUrl",summary,is_sample AS "isSample",content_hash AS "contentHash"`;
  const alias = await client.query<{ exhibition_id: string }>(
    'SELECT exhibition_id FROM exhibition_sources WHERE museum_id=$1 AND provider=$2 AND source_key=$3',
    [row.museumId, provider, row.sourceKey]);
  if (alias.rowCount) {
    const found = await client.query<Stored>(`SELECT ${columns} FROM exhibitions WHERE id=$1 FOR UPDATE`, [alias.rows[0].exhibition_id]);
    return found.rows[0];
  }
  const sameUrl = await client.query<Stored>(`SELECT ${columns} FROM exhibitions
    WHERE museum_id=$1 AND source_url=$2 FOR UPDATE`, [row.museumId, row.sourceUrl]);
  if (sameUrl.rows.length > 1) throw new Error(`同館官方網址有多筆展覽：${row.sourceUrl}`);
  if (sameUrl.rows.length === 1) return sameUrl.rows[0];
  const overlap = await client.query<Stored>(`SELECT ${columns} FROM exhibitions
    WHERE museum_id=$1 AND start_date <= $2 AND end_date >= $3 FOR UPDATE`,
  [row.museumId, row.endDate, row.startDate]);
  const candidates = duplicateCandidates(row, overlap.rows as ExistingExhibition[]);
  if (candidates.length > 1) throw new Error(`跨來源去重出現多個候選：${row.title}`);
  return candidates.length ? overlap.rows.find((item) => item.id === candidates[0].id)! : null;
}

async function main(): Promise<void> {
  const file = arg('--file');
  const snapshot = arg('--snapshot');
  const museum = arg('--source');
  const official = process.argv.includes('--official');
  const provider = arg('--provider') || museum;
  if (!museum || [Boolean(file), Boolean(snapshot), official].filter(Boolean).length !== 1
    || !provider || !/^[a-z0-9-]{1,50}$/.test(provider)) {
    throw new Error('用法：--source <館別ID> 搭配 --file <正規化JSON>、--snapshot <原始JSON> 或 --official');
  }
  if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  let runId: string | null = null;
  let inTransaction = false;
  try {
    const museumExists = await client.query('SELECT 1 FROM museums WHERE id=$1', [museum]);
    if (!museumExists.rowCount) throw new Error(`未知館別：${museum}`);
    const run = await client.query<{ id: string }>(
      `INSERT INTO ingestion_runs (museum_id,status) VALUES ($1,'running') RETURNING id`, [museum]);
    runId = run.rows[0].id;
    const { rows, records } = await sourceRows(museum, file, snapshot, official, provider);
    if (rows.length === 0 && records.length === 0) throw new Error('來源回傳 0 筆資料，已停止匯入');
    await client.query('BEGIN');
    inTransaction = true;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [museum]);
    await applyCorrections(client, museum, provider, rows, records);
    const counts = { fetched: records.length || rows.length, inserted: 0, updated: 0,
      unchanged: 0, linked: 0, skipped: records.filter((record) => record.status === 'ignored').length,
      review: records.filter((record) => record.status === 'review').length };
    for (const record of records) {
      await client.query(`INSERT INTO source_records
        (museum_id,provider,source_key,source_url,raw_record,status,reason)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
        ON CONFLICT (museum_id,provider,source_key) DO UPDATE SET
          source_url=EXCLUDED.source_url,raw_record=EXCLUDED.raw_record,
          status=EXCLUDED.status,reason=EXCLUDED.reason,last_seen_at=now()`,
      [museum, provider, record.sourceKey, record.sourceUrl, JSON.stringify(record.raw), record.status, record.reason]);
    }
    for (const row of rows) {
      const previous = await findStored(client, row, provider);
      let exhibitionId: string;
      if (!previous) {
        const inserted = await client.query<{ id: string }>(`INSERT INTO exhibitions
          (museum_id,source_key,primary_provider,title,venue,start_date,end_date,price_note,
            source_url,summary,is_sample,content_hash)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [museum, row.sourceKey, provider, row.title, row.venue, row.startDate, row.endDate,
          row.priceNote, row.sourceUrl, row.summary, row.isSample, row.contentHash]);
        exhibitionId = inserted.rows[0].id;
        counts.inserted++;
      } else {
        exhibitionId = previous.id;
        const isPrimary = previous.primaryProvider === provider || provider === museum;
        if (!isPrimary) {
          counts.linked++;
        } else {
          const changes = changedValues(previous, row);
          const sampleChanged = previous.isSample !== row.isSample;
          if (changes.length || sampleChanged || !previous.visible) {
            await client.query(`UPDATE exhibitions SET title=$2,venue=$3,start_date=$4,end_date=$5,
              price_note=$6,source_url=$7,summary=$8,is_sample=$9,content_hash=$10,
              primary_provider=$11,visible=true,last_seen_at=now(),updated_at=now() WHERE id=$1`,
            [exhibitionId, row.title, row.venue, row.startDate, row.endDate, row.priceNote,
              row.sourceUrl, row.summary, row.isSample, row.contentHash, provider]);
            for (const change of changes) {
              await client.query(`INSERT INTO exhibition_changes
                (exhibition_id,ingestion_run_id,field_name,old_value,new_value)
                VALUES ($1,$2,$3,$4,$5)`,
              [exhibitionId, runId, change.field, change.oldValue, change.newValue]);
            }
            counts.updated++;
          } else {
            await client.query('UPDATE exhibitions SET last_seen_at=now() WHERE id=$1', [exhibitionId]);
            counts.unchanged++;
          }
        }
      }
      await client.query(`INSERT INTO exhibition_sources
        (museum_id,provider,source_key,exhibition_id) VALUES ($1,$2,$3,$4)
        ON CONFLICT (museum_id,provider,source_key) DO UPDATE SET last_seen_at=now()`,
      [museum, provider, row.sourceKey, exhibitionId]);
    }
    await client.query(`UPDATE ingestion_runs SET status='succeeded',finished_at=now(),
      fetched_count=$2,inserted_count=$3,updated_count=$4,unchanged_count=$5,linked_count=$6,
      skipped_count=$7,review_count=$8 WHERE id=$1`,
    [runId, counts.fetched, counts.inserted, counts.updated, counts.unchanged, counts.linked,
      counts.skipped, counts.review]);
    if (rows.length > 0 && (official || rows.some((row) => !row.isSample))) {
      await client.query('UPDATE museums SET last_success_at=now() WHERE id=$1', [museum]);
    }
    await client.query('COMMIT');
    inTransaction = false;
    process.stdout.write(`${JSON.stringify(counts)}\n`);
  } catch (error) {
    if (inTransaction) await client.query('ROLLBACK');
    if (runId) await client.query(`UPDATE ingestion_runs SET status='failed',finished_at=now(),
      error_message=$2 WHERE id=$1`, [runId, error instanceof Error ? error.message.slice(0, 1000) : String(error)]);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
