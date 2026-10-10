import pg from 'pg';

export type MissingReviewInput = {
  museum: string; provider: string; key: string;
  decision: 'keep_visible' | 'follow_up';
  evidenceUrl: string; reviewer: string; note: string;
};

export async function reviewMissingCandidate(pool: pg.Pool, input: MissingReviewInput): Promise<string> {
  if (!/^[a-z0-9-]{1,50}$/.test(input.museum) || !/^[a-z0-9-]{1,50}$/.test(input.provider)
    || !input.key || input.key.length > 1000 || !['keep_visible', 'follow_up'].includes(input.decision)
    || !input.reviewer.trim() || input.reviewer.length > 100
    || !input.note.trim() || input.note.length > 500 || input.evidenceUrl.length > 1000) {
    throw new Error('缺席審查欄位缺漏、過長或無效');
  }
  let evidence: URL;
  try { evidence = new URL(input.evidenceUrl); }
  catch { throw new Error('官方證據網址無效'); }
  if (evidence.protocol !== 'https:' || evidence.username || evidence.password) {
    throw new Error('官方證據網址須為 HTTPS');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<{ missed_runs: number; reviewed_missed_runs: number; source_url: string }>(`
      SELECT c.missed_runs,c.reviewed_missed_runs,e.source_url
      FROM source_missing_candidates c JOIN exhibitions e ON e.id=c.exhibition_id
      WHERE c.museum_id=$1 AND c.provider=$2 AND c.source_key=$3 AND c.status='pending'
      FOR UPDATE OF c`, [input.museum, input.provider, input.key]);
    const candidate = result.rows[0];
    if (!candidate) throw new Error('找不到待審的缺席候選');
    if (candidate.reviewed_missed_runs >= candidate.missed_runs) {
      throw new Error('此缺席次數已核對；請等待新觀測或重新出現');
    }
    let source: URL;
    try { source = new URL(candidate.source_url); }
    catch { throw new Error('原始來源網址無效'); }
    if (source.protocol !== 'https:' || evidence.hostname !== source.hostname) {
      throw new Error('證據須使用相同官方來源網域');
    }
    const saved = await client.query<{ id: string }>(`INSERT INTO source_missing_reviews
      (museum_id,provider,source_key,observed_missed_runs,decision,evidence_url,reviewer,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [input.museum, input.provider, input.key, candidate.missed_runs, input.decision,
      evidence.href, input.reviewer.trim(), input.note.trim()]);
    await client.query(`UPDATE source_missing_candidates
      SET reviewed_missed_runs=$4,reviewed_at=now()
      WHERE museum_id=$1 AND provider=$2 AND source_key=$3`,
    [input.museum, input.provider, input.key, candidate.missed_runs]);
    await client.query('COMMIT');
    return saved.rows[0].id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
