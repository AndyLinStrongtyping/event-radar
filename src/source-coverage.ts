import type pg from 'pg';
import type { ExhibitionDraft } from './normalize.ts';
import type { SourceRecord } from './sources/nmmba.ts';

export type CoverageStatus = 'baseline_created' | 'checked' | 'deferred_partial';
export type CoverageResult = {
  status: CoverageStatus;
  identityCount: number;
  identityKeys: string[];
  baselineCount: number | null;
  rowCount: number;
  baselineRowCount: number | null;
};

// A count is only a warning signal: it cannot prove that a source list is complete.
export function isSuspiciousDrop(baseline: number, current: number): boolean {
  return baseline >= 4 && baseline - current >= 2 && current * 2 <= baseline;
}

// Equal-size batches can also be incomplete when a parser starts selecting an
// unrelated region of a page. A seasonal full replacement is safe to review.
export function isSuspiciousReplacement(previous: readonly string[], current: readonly string[]): boolean {
  if (previous.length < 4) return false;
  const currentKeys = new Set(current);
  const overlap = previous.filter((key) => currentKeys.has(key)).length;
  return previous.length - overlap >= 3 && overlap * 4 <= previous.length;
}

export async function assessOfficialSourceCoverage(client: pg.PoolClient, museum: string,
  provider: string, runId: string, rows: ExhibitionDraft[], records: SourceRecord[]): Promise<CoverageResult> {
  const identities = new Set([...rows.map((row) => row.sourceKey),
    ...records.map((record) => record.sourceKey)]);
  const identityKeys = [...identities].sort();
  const identityCount = identities.size;
  if (identityCount === 0) throw new Error('官方來源沒有可辨識的資料列');
  const rowCount = rows.length;

  const previous = await client.query<{ identity_count: number; row_count: number; identity_keys: string[] | null }>(`SELECT identity_count,row_count,identity_keys
    FROM official_source_baselines WHERE museum_id=$1 AND provider=$2 FOR UPDATE`, [museum, provider]);
  if (!previous.rowCount) {
    await client.query(`INSERT INTO official_source_baselines
      (museum_id,provider,identity_count,row_count,last_run_id,identity_keys) VALUES ($1,$2,$3,$4,$5,$6)`,
    [museum, provider, identityCount, rowCount, runId, identityKeys]);
    return { status: 'baseline_created', identityCount, identityKeys, baselineCount: null,
      rowCount, baselineRowCount: null };
  }
  const baselineCount = previous.rows[0].identity_count;
  const baselineRowCount = previous.rows[0].row_count;
  if (isSuspiciousDrop(baselineCount, identityCount)
    || isSuspiciousDrop(baselineRowCount, rowCount)
    || (previous.rows[0].identity_keys !== null
      && isSuspiciousReplacement(previous.rows[0].identity_keys, identityKeys))) {
    return { status: 'deferred_partial', identityCount, identityKeys, baselineCount,
      rowCount, baselineRowCount };
  }
  await client.query(`UPDATE official_source_baselines SET identity_count=$3,row_count=$4,last_run_id=$5,identity_keys=$6,
    updated_at=now() WHERE museum_id=$1 AND provider=$2`,
  [museum, provider, identityCount, rowCount, runId, identityKeys]);
  return { status: 'checked', identityCount, identityKeys, baselineCount, rowCount, baselineRowCount };
}
