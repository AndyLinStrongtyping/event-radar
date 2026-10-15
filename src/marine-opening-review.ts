import type pg from 'pg';
import { validVisitDate } from './visit-status.ts';

export type MarineOpeningReview = {
  date: string; status: 'open' | 'closed'; opensAt?: string; closesAt?: string;
  evidenceUrl: string; reviewer: string; note: string;
};

function validated(input: MarineOpeningReview) {
  if (!validVisitDate(input.date)) throw new Error('特殊開館日期無效');
  if (!['open','closed'].includes(input.status)) throw new Error('特殊開館狀態無效');
  const time = (value: string | undefined) => value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (input.status === 'open' ? !time(input.opensAt) || !time(input.closesAt)
    || input.opensAt! >= input.closesAt! : input.opensAt !== undefined || input.closesAt !== undefined) {
    throw new Error('開館須有有效起迄時間，休館不得有時間');
  }
  if (input.reviewer.trim().length < 2 || input.reviewer.trim().length > 80
    || input.note.trim().length < 20 || input.note.trim().length > 500) {
    throw new Error('核對者需 2–80 字，日期與公告的核對說明需 20–500 字');
  }
  let url: URL;
  try { url = new URL(input.evidenceUrl); }
  catch { throw new Error('須提供海生館官方佐證網址'); }
  if (url.protocol !== 'https:' || url.hostname !== 'www.nmmba.gov.tw'
    || url.username || url.password || url.hash || url.href.length > 2048
    || !/^\/(?:News_Content|cp)\.aspx$/i.test(url.pathname)) {
    throw new Error('佐證須為海生館官方服務或公告頁的 HTTPS 網址');
  }
  return { ...input, evidenceUrl:url.href, reviewer:input.reviewer.trim(), note:input.note.trim(),
    opensAt:input.opensAt ?? null, closesAt:input.closesAt ?? null };
}

export async function reviewNmmbaOpening(pool: pg.Pool, input: MarineOpeningReview): Promise<{ changed: boolean }> {
  const row = validated(input);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`opening:nmmba:${row.date}`]);
    const previous = await client.query(`SELECT status,to_char(opens_at,'HH24:MI') AS "opensAt",
      to_char(closes_at,'HH24:MI') AS "closesAt",evidence_url AS "evidenceUrl",
      reviewer,review_note AS note FROM museum_opening_exceptions
      WHERE museum_id='nmmba' AND visit_date=$1::date FOR UPDATE`,[row.date]);
    const next = {status:row.status,opensAt:row.opensAt,closesAt:row.closesAt,
      evidenceUrl:row.evidenceUrl,reviewer:row.reviewer,note:row.note};
    if (previous.rowCount && JSON.stringify(previous.rows[0]) === JSON.stringify(next)) {
      await client.query('COMMIT');
      return {changed:false};
    }
    await client.query(`INSERT INTO museum_opening_exceptions
      (museum_id,visit_date,status,opens_at,closes_at,evidence_url,reviewer,review_note)
      VALUES ('nmmba',$1::date,$2,$3::time,$4::time,$5,$6,$7)
      ON CONFLICT (museum_id,visit_date) DO UPDATE SET status=EXCLUDED.status,
      opens_at=EXCLUDED.opens_at,closes_at=EXCLUDED.closes_at,
      evidence_url=EXCLUDED.evidence_url,reviewer=EXCLUDED.reviewer,
      review_note=EXCLUDED.review_note,reviewed_at=now()`,
    [row.date,row.status,row.opensAt,row.closesAt,row.evidenceUrl,row.reviewer,row.note]);
    await client.query(`INSERT INTO museum_opening_exception_changes
      (museum_id,visit_date,old_value,new_value)
      VALUES ('nmmba',$1::date,$2::jsonb,$3::jsonb)`,
    [row.date,previous.rowCount ? JSON.stringify(previous.rows[0]) : null,JSON.stringify(next)]);
    await client.query('COMMIT');
    return {changed:true};
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
