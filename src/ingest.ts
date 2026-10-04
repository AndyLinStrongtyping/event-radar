import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';
import { normalizeExhibition, type ExhibitionDraft } from './normalize.ts';
import { normalizeNmnsFeed } from './sources/nmns.ts';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const file = arg('--file');
  const museum = arg('--source');
  const official = process.argv.includes('--official');
  if (!museum || Boolean(file) === official) {
    throw new Error('用法：--source <館別ID> 搭配 --file <JSON檔> 或 --official');
  }
  if (official && museum !== 'nmns') throw new Error('目前只有科博館支援官方公開來源匯入');
  if (!process.env.DATABASE_URL) throw new Error('請先設定 DATABASE_URL');
  let payload: unknown;
  if (official) {
    const source = process.env.NMNS_OPEN_DATA_URL;
    if (!source) throw new Error('請設定 NMNS_OPEN_DATA_URL（政府資料開放平臺的科博館 JSON 資源網址）');
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.hostname !== 'www.nmns.edu.tw') throw new Error('來源網址必須是科博館官方 HTTPS 網域');
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`科博館來源回應 HTTP ${response.status}`);
    const body = await response.text();
    if (body.length > 10_000_000) throw new Error('來源回應過大');
    payload = JSON.parse(body);
  } else {
    payload = JSON.parse(await readFile(file!, 'utf8')) as unknown;
    if (!Array.isArray(payload)) throw new Error('匯入檔必須是 JSON 陣列');
  }
  const officialRows = official ? normalizeNmnsFeed(payload) : null;
  const rows: unknown[] = officialRows ?? (payload as unknown[]);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  let runId: string | undefined;
  try {
    const museumExists = await pool.query('SELECT 1 FROM museums WHERE id=$1', [museum]);
    if (!museumExists.rowCount) throw new Error(`未知館別：${museum}`);
    const run = await pool.query<{ id: string }>(
      `INSERT INTO ingestion_runs (museum_id,status) VALUES ($1,'running') RETURNING id`, [museum],
    );
    runId = run.rows[0].id;
    const counts = { fetched: rows.length, inserted: 0, updated: 0, skipped: 0 };
    for (const [index, item] of rows.entries()) {
      try {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('資料列不是物件');
        const exhibit: ExhibitionDraft = official
          ? item as ExhibitionDraft
          : normalizeExhibition(item as Record<string, unknown>, museum);
        const previous = await pool.query<{ content_hash: string }>(
          'SELECT content_hash FROM exhibitions WHERE museum_id=$1 AND source_key=$2',
          [museum, exhibit.sourceKey],
        );
        await pool.query(`
          INSERT INTO exhibitions (museum_id,source_key,title,venue,start_date,end_date,
            price_note,source_url,summary,is_sample,content_hash)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT (museum_id,source_key) DO UPDATE SET
            title=EXCLUDED.title, venue=EXCLUDED.venue, start_date=EXCLUDED.start_date,
            end_date=EXCLUDED.end_date, price_note=EXCLUDED.price_note,
            source_url=EXCLUDED.source_url, summary=EXCLUDED.summary,
            is_sample=EXCLUDED.is_sample, content_hash=EXCLUDED.content_hash,
            last_seen_at=now(), updated_at=CASE WHEN exhibitions.content_hash <> EXCLUDED.content_hash
              THEN now() ELSE exhibitions.updated_at END`,
          [museum, exhibit.sourceKey, exhibit.title, exhibit.venue, exhibit.startDate,
            exhibit.endDate, exhibit.priceNote, exhibit.sourceUrl, exhibit.summary,
            exhibit.isSample, exhibit.contentHash],
        );
        if (!previous.rowCount) counts.inserted++;
        else if (previous.rows[0].content_hash !== exhibit.contentHash) counts.updated++;
        else counts.skipped++;
      } catch (error) {
        counts.skipped++;
        process.stderr.write(`第 ${index + 1} 筆略過：${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
    await pool.query(`UPDATE ingestion_runs SET status='succeeded',finished_at=now(),
      fetched_count=$2,inserted_count=$3,updated_count=$4,skipped_count=$5 WHERE id=$1`,
    [runId, counts.fetched, counts.inserted, counts.updated, counts.skipped]);
    if (official || rows.some((row) => row && typeof row === 'object' && !Array.isArray(row)
      && (row as Record<string, unknown>).isSample === false)) {
      await pool.query('UPDATE museums SET last_success_at=now() WHERE id=$1', [museum]);
    }
    process.stdout.write(`${JSON.stringify(counts)}\n`);
  } catch (error) {
    if (runId) await pool.query(`UPDATE ingestion_runs SET status='failed',finished_at=now(),
      error_message=$2 WHERE id=$1`, [runId, error instanceof Error ? error.message.slice(0, 1000) : String(error)]);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
