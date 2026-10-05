import pg from 'pg';
import { correctedDraft, sourceHash } from './corrections.ts';

export type ReviewInput = {
  museum: string; key: string; startDate: string; endDate: string;
  evidenceUrl: string; reviewer: string; note: string;
};

export function validateReviewInput(input: ReviewInput): void {
  if (!['nmmba', 'npm-north'].includes(input.museum)) throw new Error('此來源尚不支援人工補正');
  if (!input.key || input.key.length > 1000 || !input.reviewer.trim() || !input.note.trim()
    || input.reviewer.length > 100 || input.note.length > 500 || input.evidenceUrl.length > 1000) {
    throw new Error('審查欄位缺漏或過長');
  }
}

export async function approveReview(pool: pg.Pool, input: ReviewInput): Promise<string> {
  validateReviewInput(input);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.museum]);
    const result = await client.query<{ raw_record: Record<string, unknown>; status: string; source_url: string | null }>(
      `SELECT raw_record,status,source_url FROM source_records
        WHERE museum_id=$1 AND provider=$1 AND source_key=$2 FOR UPDATE`, [input.museum, input.key]);
    if (result.rows.length !== 1 || !['review', 'approved'].includes(result.rows[0].status)) {
      throw new Error('找不到可補正的待審來源紀錄');
    }
    const raw = result.rows[0].raw_record;
    correctedDraft(input.museum, raw, input.startDate, input.endDate, input.evidenceUrl);
    const inserted = await client.query<{ id: string }>(`INSERT INTO review_corrections
      (museum_id,provider,source_key,source_hash,source_url,start_date,end_date,evidence_url,reviewer,note)
      VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [input.museum, input.key, sourceHash(raw), result.rows[0].source_url,
      input.startDate, input.endDate, input.evidenceUrl, input.reviewer.trim(), input.note.trim()]);
    await client.query('COMMIT');
    return inserted.rows[0].id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
