import type pg from 'pg';
import type { ExhibitionDraft } from './normalize.ts';
import type { SourceRecord } from './sources/nmmba.ts';

/** An absence is an audit candidate, never proof that an exhibition ended. */
export async function trackMissingCandidates(client: pg.PoolClient, museum: string,
  provider: string, runId: string, rows: ExhibitionDraft[], records: SourceRecord[]): Promise<number> {
  const keys = [...new Set([...rows.map((row) => row.sourceKey), ...records.map((record) => record.sourceKey)])];
  const urls = [...new Set([...rows.map((row) => row.sourceUrl), ...records.map((record) => record.sourceUrl)]
    .filter((url): url is string => Boolean(url)))];
  if (!keys.length && !urls.length) throw new Error('不能以空來源判斷展覽已從館方清單消失');

  await client.query(`UPDATE source_missing_candidates c SET status='resolved',resolved_at=now()
    FROM exhibitions e WHERE c.exhibition_id=e.id AND c.museum_id=$1 AND c.provider=$2
      AND c.status='pending' AND (c.source_key=ANY($3::text[])
        OR e.source_url=ANY($4::text[]) OR e.primary_provider<>$2)`,
  [museum, provider, keys, urls]);

  const missing = await client.query<{ source_key: string; exhibition_id: string }>(`
    SELECT es.source_key,es.exhibition_id FROM exhibition_sources es
    JOIN exhibitions e ON e.id=es.exhibition_id
    WHERE es.museum_id=$1 AND es.provider=$2 AND e.primary_provider=$2
      AND e.visible AND NOT e.is_sample
      AND e.end_date >= (now() AT TIME ZONE 'Asia/Taipei')::date
      AND NOT (es.source_key=ANY($3::text[]) OR e.source_url=ANY($4::text[]))`,
  [museum, provider, keys, urls]);

  for (const item of missing.rows) {
    await client.query(`INSERT INTO source_missing_candidates
      (museum_id,provider,source_key,exhibition_id,last_run_id)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (museum_id,provider,source_key) DO UPDATE SET
        exhibition_id=EXCLUDED.exhibition_id,last_run_id=EXCLUDED.last_run_id,
        status='pending',resolved_at=NULL,last_missing_at=now(),
        first_missing_at=CASE WHEN source_missing_candidates.status='pending'
          THEN source_missing_candidates.first_missing_at ELSE now() END,
        missed_runs=CASE WHEN source_missing_candidates.status='pending'
          THEN source_missing_candidates.missed_runs+1 ELSE 1 END,
        reviewed_missed_runs=CASE WHEN source_missing_candidates.status='pending'
          THEN source_missing_candidates.reviewed_missed_runs ELSE 0 END,
        reviewed_at=CASE WHEN source_missing_candidates.status='pending'
          THEN source_missing_candidates.reviewed_at ELSE NULL END`,
    [museum, provider, item.source_key, item.exhibition_id, runId]);
  }
  return missing.rows.length;
}
