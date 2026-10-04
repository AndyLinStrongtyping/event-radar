import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';
import { changedValues, duplicateCandidates, type ExistingExhibition } from './dedupe.ts';
import { normalizeExhibition, type ExhibitionDraft } from './normalize.ts';
import { normalizeNmnsFeed } from './sources/nmns.ts';
import { mergeNpmSouthPages, npmSouthPages } from './sources/npm-south.ts';

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

async function sourceRows(museum: string, file: string | undefined, official: boolean): Promise<ExhibitionDraft[]> {
  if (file) {
    const payload: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(payload)) throw new Error('匯入檔必須是 JSON 陣列');
    return payload.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('資料列不是物件');
      return normalizeExhibition(item as Record<string, unknown>, museum);
    });
  }
  if (!official) throw new Error('必須指定 --file 或 --official');
  if (museum === 'nmns') {
    const source = process.env.NMNS_OPEN_DATA_URL;
    if (!source) throw new Error('請設定 NMNS_OPEN_DATA_URL');
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.hostname !== 'www.nmns.edu.tw') throw new Error('來源網址必須是科博館官方 HTTPS 網域');
    return normalizeNmnsFeed(JSON.parse(await fetchSource(url.href, 'www.nmns.edu.tw')));
  }
  if (museum === 'npm-south') {
    const pages: string[] = [];
    for (const url of npmSouthPages) pages.push(await fetchSource(url, 'south.npm.gov.tw'));
    return mergeNpmSouthPages(pages);
  }
  throw new Error('目前只有科博館與故宮南院支援官方來源匯入');
}

type Stored = ExhibitionDraft & { id: string; primaryProvider: string };

async function findStored(client: pg.PoolClient, row: ExhibitionDraft, provider: string): Promise<Stored | null> {
  const columns = `id,primary_provider AS "primaryProvider",museum_id AS "museumId",source_key AS "sourceKey",
    title,venue,to_char(start_date,'YYYY-MM-DD') AS "startDate",
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
  const museum = arg('--source');
  const official = process.argv.includes('--official');
  const provider = arg('--provider') || museum;
  if (!museum || Boolean(file) === official || !provider || !/^[a-z0-9-]{1,50}$/.test(provider)) {
    throw new Error('用法：--source <館別ID> 搭配 --file <JSON檔> 或 --official，可選 --provider <來源ID>');
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
    const rows = await sourceRows(museum, file, official);
    if (rows.length === 0) throw new Error('來源回傳 0 筆，已停止匯入');
    await client.query('BEGIN');
    inTransaction = true;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [museum]);
    const counts = { fetched: rows.length, inserted: 0, updated: 0, unchanged: 0, linked: 0, skipped: 0 };
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
          if (changes.length || sampleChanged) {
            await client.query(`UPDATE exhibitions SET title=$2,venue=$3,start_date=$4,end_date=$5,
              price_note=$6,source_url=$7,summary=$8,is_sample=$9,content_hash=$10,
              primary_provider=$11,last_seen_at=now(),updated_at=now() WHERE id=$1`,
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
      skipped_count=0 WHERE id=$1`,
    [runId, counts.fetched, counts.inserted, counts.updated, counts.unchanged, counts.linked]);
    if (official || rows.some((row) => !row.isSample)) {
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
