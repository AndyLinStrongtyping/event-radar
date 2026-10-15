import type pg from 'pg';

export type ReviewedSessionStatus = 'scheduled' | 'sold_out' | 'cancelled' | 'postponed' | 'unknown';
export type ReviewNttSessionInput = {
  sourceKey: string; startsAt: string; status: ReviewedSessionStatus;
  evidenceUrl: string; reviewer: string; note: string;
};

function validate(input: ReviewNttSessionInput): string {
  if (!/^c-[A-Za-z0-9_-]{8,24}$/.test(input.sourceKey)) throw new Error('歌劇院來源鍵無效');
  const date = input.startsAt.slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(input.startsAt)
    || Number.isNaN(Date.parse(`${date}T00:00:00Z`))
    || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date
    || Number.isNaN(Date.parse(input.startsAt))) throw new Error('場次開始時間須含時區且符合 ISO 日期');
  if (!['scheduled','sold_out','cancelled','postponed','unknown'].includes(input.status)) {
    throw new Error('場次狀態無效');
  }
  if (input.reviewer.trim().length < 2 || input.reviewer.trim().length > 80
    || input.note.trim().length < 20 || input.note.trim().length > 500) {
    throw new Error('核對者需 2–80 字，核對說明需 20–500 字');
  }
  let evidence: URL;
  try { evidence = new URL(input.evidenceUrl); }
  catch { throw new Error('須提供歌劇院官方證據網址'); }
  if (evidence.protocol !== 'https:' || evidence.hostname !== 'www.npac-ntt.org'
    || evidence.username || evidence.password || evidence.hash || evidence.href.length > 2048
    || !(evidence.pathname === `/program/events/${input.sourceKey}`
      || /^\/news(?:\/|$)/.test(evidence.pathname))) {
    throw new Error('證據須為同節目詳情或歌劇院官方新聞 HTTPS 網址');
  }
  return evidence.href;
}

export async function reviewNttSession(pool: pg.Pool, input: ReviewNttSessionInput): Promise<{
  eventId: string; sessionKey: string; status: ReviewedSessionStatus; changed: boolean;
}> {
  const evidenceUrl = validate(input);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['domain:ntt']);
    const found = await client.query<{ id: string; event_id: string; session_key: string;
      status: ReviewedSessionStatus; status_origin: string; status_evidence_url: string | null;
      status_reviewer: string | null; status_review_note: string | null; content_hash: string }>(`
      SELECT s.id,s.event_id,s.session_key,s.status,s.status_origin,s.status_evidence_url,d.content_hash,
        s.status_reviewer,s.status_review_note FROM event_sessions s
      JOIN domain_events d ON d.id=s.event_id
      WHERE d.source_id='ntt' AND d.source_key=$1 AND s.starts_at=$2::timestamptz
      FOR UPDATE OF s`,[input.sourceKey,input.startsAt]);
    if (found.rowCount !== 1) throw new Error('找不到唯一的歌劇院場次；先用 period=all 核對開始時間');
    const row = found.rows[0];
    const note = input.note.trim();
    const reviewer = input.reviewer.trim();
    if (row.status_origin === 'manual' && row.status === input.status
      && row.status_evidence_url === evidenceUrl && row.status_reviewer === reviewer
      && row.status_review_note === note) {
      await client.query('COMMIT');
      return {eventId:row.event_id,sessionKey:row.session_key,status:input.status,changed:false};
    }
    await client.query(`UPDATE event_sessions SET status=$2,status_origin='manual',
      status_evidence_url=$3,status_reviewer=$4,status_review_note=$5,status_reviewed_at=now(),
      status_source_hash=$6
      WHERE id=$1`,[row.id,input.status,evidenceUrl,reviewer,note,row.content_hash]);
    await client.query('UPDATE domain_events SET updated_at=now() WHERE id=$1',[row.event_id]);
    await client.query(`INSERT INTO domain_event_changes(event_id,field_name,old_value,new_value)
      VALUES ($1,'sessionStatus',$2::jsonb,$3::jsonb)`,[row.event_id,
      JSON.stringify({sessionKey:row.session_key,status:row.status,origin:row.status_origin,
        evidenceUrl:row.status_evidence_url}),
      JSON.stringify({sessionKey:row.session_key,status:input.status,origin:'manual',
        evidenceUrl,reviewer,note})]);
    await client.query('COMMIT');
    return {eventId:row.event_id,sessionKey:row.session_key,status:input.status,changed:true};
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
