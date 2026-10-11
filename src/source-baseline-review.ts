import type pg from 'pg';

type Run = {
  id: string; status: string; coverage_status: string;
  source_identity_count: number | null; source_row_count: number | null;
  source_identity_keys: string[] | null;
  coverage_baseline_count: number | null; coverage_baseline_row_count: number | null;
};
type Baseline = {
  identity_count: number; row_count: number; identity_keys: string[] | null;
  last_run_id: string;
};

const sourcePattern = /^[a-z0-9-]{1,50}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validSource(museum: string, provider: string): void {
  if (!sourcePattern.test(museum) || !sourcePattern.test(provider)) throw new Error('館別或 provider 無效');
}

async function latestOfficialRun(client: pg.PoolClient | pg.Pool, museum: string,
  provider: string): Promise<Run | null> {
  const result = await client.query<Run>(`SELECT id,status,coverage_status,
    source_identity_count,source_row_count,source_identity_keys,
    coverage_baseline_count,coverage_baseline_row_count
    FROM ingestion_runs WHERE museum_id=$1 AND provider=$2
      AND coverage_status<>'not_applicable'
    ORDER BY finished_at DESC NULLS LAST,started_at DESC,id DESC LIMIT 1`, [museum, provider]);
  return result.rows[0] ?? null;
}

export async function inspectBaselineCandidate(pool: pg.Pool, museum: string, provider: string) {
  validSource(museum, provider);
  const [run, baseline] = await Promise.all([
    latestOfficialRun(pool, museum, provider),
    pool.query<Baseline>(`SELECT identity_count,row_count,identity_keys,last_run_id
      FROM official_source_baselines WHERE museum_id=$1 AND provider=$2`, [museum, provider]),
  ]);
  const current = baseline.rows[0] ?? null;
  const oldKeys = new Set(current?.identity_keys ?? []);
  const newKeys = new Set(run?.source_identity_keys ?? []);
  return {
    museum, provider, runId: run?.id ?? null, status: run?.status ?? null,
    coverageStatus: run?.coverage_status ?? null,
    baselineCount: current?.identity_count ?? null, candidateCount: run?.source_identity_count ?? null,
    baselineRows: current?.row_count ?? null, candidateRows: run?.source_row_count ?? null,
    removedKeys: [...oldKeys].filter((key) => !newKeys.has(key)),
    addedKeys: [...newKeys].filter((key) => !oldKeys.has(key)),
    canAccept: Boolean(run?.status === 'succeeded' && run.coverage_status === 'deferred_partial'
      && run.source_identity_keys?.length === run.source_identity_count
      && run.source_row_count && current && current.last_run_id !== run.id
      && run.coverage_baseline_count === current.identity_count
      && run.coverage_baseline_row_count === current.row_count),
  };
}

export type BaselineReviewInput = {
  museum: string; provider: string; runId: string;
  evidenceUrl: string; reviewer: string; note: string;
};

/** Manual evidence only changes the comparison baseline, never exhibition visibility. */
export async function acceptBaselineCandidate(pool: pg.Pool, input: BaselineReviewInput): Promise<string> {
  validSource(input.museum, input.provider);
  if (!uuidPattern.test(input.runId) || !input.reviewer.trim() || input.reviewer.length > 100
    || !input.note.trim() || input.note.length > 500 || input.evidenceUrl.length > 1000) {
    throw new Error('審查欄位缺漏、過長或無效');
  }
  let evidence: URL;
  try { evidence = new URL(input.evidenceUrl); }
  catch { throw new Error('官方證據網址無效'); }
  if (evidence.protocol !== 'https:' || evidence.username || evidence.password) {
    throw new Error('官方證據網址須為無憑證的 HTTPS 網址');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Ingestion uses the same museum lock, so a newer committed run cannot
    // slip between the final-run check and the baseline update.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.museum]);
    const museum = await client.query<{ homepage_url: string }>(
      'SELECT homepage_url FROM museums WHERE id=$1', [input.museum]);
    if (!museum.rows[0]) throw new Error('未知館別');
    const host = new URL(museum.rows[0].homepage_url).hostname.replace(/^www\./, '');
    if (evidence.hostname !== host && !evidence.hostname.endsWith(`.${host}`)) {
      throw new Error('證據網址必須屬於該館官方網域');
    }
    const baseline = await client.query<Baseline>(`SELECT identity_count,row_count,identity_keys,last_run_id
      FROM official_source_baselines WHERE museum_id=$1 AND provider=$2 FOR UPDATE`,
    [input.museum, input.provider]);
    if (!baseline.rows[0]) throw new Error('尚無可更新的官方來源基準');
    const previous = baseline.rows[0];
    const run = await latestOfficialRun(client, input.museum, input.provider);
    if (!run || run.id !== input.runId || run.status !== 'succeeded'
      || run.coverage_status !== 'deferred_partial') {
      throw new Error('只能核准最新且成功匯入的疑似部分清單');
    }
    if (previous.last_run_id === run.id) throw new Error('此批次已成為基準');
    if (!run.source_identity_count || !run.source_row_count || !run.source_identity_keys
      || run.source_identity_keys.length !== run.source_identity_count
      || run.coverage_baseline_count !== previous.identity_count
      || run.coverage_baseline_row_count !== previous.row_count) {
      throw new Error('來源鍵快照缺漏或比較基準已改變；請重新同步並核對');
    }
    const review = await client.query<{ id: string }>(`INSERT INTO source_baseline_reviews
      (museum_id,provider,ingestion_run_id,previous_run_id,
       previous_identity_count,previous_row_count,previous_identity_keys,
       accepted_identity_count,accepted_row_count,accepted_identity_keys,
       evidence_url,reviewer,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [input.museum, input.provider, run.id, previous.last_run_id,
      previous.identity_count, previous.row_count, previous.identity_keys,
      run.source_identity_count, run.source_row_count, run.source_identity_keys,
      evidence.href, input.reviewer.trim(), input.note.trim()]);
    await client.query(`UPDATE official_source_baselines SET
      identity_count=$3,row_count=$4,identity_keys=$5,last_run_id=$6,updated_at=now()
      WHERE museum_id=$1 AND provider=$2`,
    [input.museum, input.provider, run.source_identity_count,
      run.source_row_count, run.source_identity_keys, run.id]);
    await client.query('COMMIT');
    return review.rows[0].id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
