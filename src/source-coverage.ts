import type pg from 'pg';
import type { ExhibitionDraft } from './normalize.ts';
import type { SourceRecord } from './sources/nmmba.ts';

export type CoverageStatus = 'baseline_created' | 'checked' | 'deferred_partial';
export type CoverageResult = {
  status: CoverageStatus;
  identityCount: number;
  baselineCount: number | null;
  rowCount: number;
  baselineRowCount: number | null;
};

// A count is only a warning signal: it cannot prove that a source list is complete.
export function isSuspiciousDrop(baseline: number, current: number): boolean {
  return baseline >= 4 && baseline - current >= 2 && current * 2 <= baseline;
}

export async function assessOfficialSourceCoverage(client: pg.PoolClient, museum: string,
  provider: string, runId: string, rows: ExhibitionDraft[], records: SourceRecord[]): Promise<CoverageResult> {
  const identities = new Set([...rows.map((row) => row.sourceKey),
    ...records.map((record) => record.sourceKey)]);
  const identityCount = identities.size;
  if (identityCount === 0) throw new Error('官方來源沒有可辨識的資料列');
  const rowCount = rows.length;

  const previous = await client.query<{ identity_count: number; row_count: number }>(`SELECT identity_count,row_count
    FROM official_source_baselines WHERE museum_id=$1 AND provider=$2 FOR UPDATE`, [museum, provider]);
  if (!previous.rowCount) {
    await client.query(`INSERT INTO official_source_baselines
      (museum_id,provider,identity_count,row_count,last_run_id) VALUES ($1,$2,$3,$4,$5)`,
    [museum, provider, identityCount, rowCount, runId]);
    return { status: 'baseline_created', identityCount, baselineCount: null,
      rowCount, baselineRowCount: null };
  }
  const baselineCount = previous.rows[0].identity_count;
  const baselineRowCount = previous.rows[0].row_count;
  if (isSuspiciousDrop(baselineCount, identityCount)
    || isSuspiciousDrop(baselineRowCount, rowCount)) {
    return { status: 'deferred_partial', identityCount, baselineCount,
      rowCount, baselineRowCount };
  }
  await client.query(`UPDATE official_source_baselines SET identity_count=$3,row_count=$4,last_run_id=$5,
    updated_at=now() WHERE museum_id=$1 AND provider=$2`,
  [museum, provider, identityCount, rowCount, runId]);
  return { status: 'checked', identityCount, baselineCount, rowCount, baselineRowCount };
}
