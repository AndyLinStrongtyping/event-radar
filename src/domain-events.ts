import { createHash } from 'node:crypto';
import type pg from 'pg';
import type { PerformanceEvent } from './sources/ntt-events.ts';
import type { MarineProgramme } from './sources/nmmba-programmes.ts';

export type DomainDraft = PerformanceEvent | MarineProgramme;
export type DomainScope = 'single_detail' | 'sampled_list' | 'daily_page' | 'ntt_place1_list';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function severeDailyShrink(previousCount: number, currentCount: number): boolean {
  return previousCount >= 4 && currentCount < Math.ceil(previousCount / 2);
}

export function severeOfficialListShrink(previousCount: number, currentCount: number): boolean {
  return previousCount >= 10 && currentCount < Math.ceil(previousCount / 2);
}

export function severeOfficialIdentityChange(previousKeys: string[], currentKeys: string[]): boolean {
  if (previousKeys.length < 10 || currentKeys.length < 10) return false;
  const previous = new Set(previousKeys);
  const overlap = currentKeys.filter((key) => previous.has(key)).length;
  return overlap < Math.ceil(Math.min(previousKeys.length, currentKeys.length) / 2);
}

async function change(client: pg.PoolClient, id: string, field: string, oldValue: unknown, newValue: unknown) {
  if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return false;
  await client.query(`INSERT INTO domain_event_changes(event_id,field_name,old_value,new_value)
    VALUES ($1,$2,$3::jsonb,$4::jsonb)`, [id, field, JSON.stringify(oldValue), JSON.stringify(newValue)]);
  return true;
}

function normalizedSessions(row: PerformanceEvent) {
  return [...row.sessions].sort((a, b) => a.sessionKey.localeCompare(b.sessionKey));
}

function normalizedTimes(row: MarineProgramme) {
  return [...row.times].sort((a, b) => a.localTime.localeCompare(b.localTime));
}

export async function importDomainEvents(pool: pg.Pool, rows: DomainDraft[], scope: DomainScope,
  checkedAt: string, options: { shrinkReviewNote?: string; listReviewNote?: string } = {}): Promise<{ inserted: number; updated: number; unchanged: number }> {
  if (!rows.length || rows.length > 30 || Number.isNaN(Date.parse(checkedAt))) throw new Error('活動批次、筆數或核對時間無效');
  const sourceId = rows[0].sourceId;
  if (rows.some((row) => row.sourceId !== sourceId)
    || new Set(rows.map((row) => row.sourceKey)).size !== rows.length) throw new Error('活動來源混雜或來源鍵重複');
  if ((sourceId === 'ntt' && scope === 'daily_page')
    || (sourceId === 'nmmba' && scope !== 'daily_page')) throw new Error('活動來源範圍不符');
  if (options.shrinkReviewNote !== undefined && options.listReviewNote !== undefined) {
    throw new Error('歌劇院清單覆核說明不可重複提供');
  }
  const reviewNote = options.listReviewNote ?? options.shrinkReviewNote;
  if (reviewNote !== undefined && (scope !== 'ntt_place1_list'
    || reviewNote.trim().length < 20 || reviewNote.trim().length > 500)) {
    throw new Error('歌劇院清單覆核說明須為 20–500 字，且只適用官方 place=1 清單');
  }
  const identityKeys = scope === 'ntt_place1_list' ? rows.map((row) => row.sourceKey).sort() : null;
  const run = await pool.query<{ id: string }>(`INSERT INTO domain_source_runs(source_id,scope,status)
    VALUES ($1,$2,'running') RETURNING id`, [sourceId, scope]);
  const client = await pool.connect();
  let transaction = false;
  try {
    await client.query('BEGIN'); transaction = true;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`domain:${sourceId}`]);
    let reviewedListChange = false;
    if (scope === 'daily_page') {
      const previous = await client.query<{ accepted_count: number }>(`SELECT accepted_count
        FROM domain_source_runs WHERE source_id=$1 AND scope='daily_page' AND status='succeeded'
        ORDER BY finished_at DESC,id DESC LIMIT 1`, [sourceId]);
      const previousCount = previous.rows[0]?.accepted_count ?? 0;
      if (severeDailyShrink(previousCount, rows.length)) {
        throw new Error(`SOURCE_ANOMALY：海生館當日節目從 ${previousCount} 筆降至 ${rows.length} 筆，需人工核對`);
      }
    }
    if (scope === 'ntt_place1_list') {
      const previous = await client.query<{ accepted_count: number; identity_keys: string[] | null }>(`SELECT accepted_count,identity_keys
        FROM domain_source_runs WHERE source_id='ntt' AND scope='ntt_place1_list' AND status='succeeded'
        ORDER BY finished_at DESC,id DESC LIMIT 1`);
      const previousCount = previous.rows[0]?.accepted_count ?? 0;
      const previousKeys = previous.rows[0]?.identity_keys;
      const anomaly = severeOfficialListShrink(previousCount, rows.length)
        ? `歌劇院 place=1 清單從 ${previousCount} 筆降至 ${rows.length} 筆`
        : previousKeys && severeOfficialIdentityChange(previousKeys, identityKeys!)
          ? `歌劇院 place=1 清單來源鍵大幅變動（前次 ${previousKeys.length} 筆，本次 ${identityKeys!.length} 筆）`
          : null;
      if (anomaly) {
        if (!reviewNote) throw new Error(`SOURCE_ANOMALY：${anomaly}，需核對館方頁並提供覆核說明`);
        reviewedListChange = true;
      }
    }
    if (reviewNote && !reviewedListChange) throw new Error('歌劇院清單未達異常覆核條件，拒絕無效覆核說明');
    const counts = { inserted: 0, updated: 0, unchanged: 0 };
    for (const row of rows) {
      const detail = row.domain === 'performance' ? normalizedSessions(row) : normalizedTimes(row);
      const contentHash = hash([row.title,row.venue,row.sourceUrl,row.ticketUrl,row.priceNote,detail]);
      const current = await client.query<{ id: string; domain: string; title: string; venue: string | null; source_url: string;
        ticket_url: string | null; price_note: string | null; observed_on: Date | null; content_hash: string;
        source_checked_at: Date }>(`SELECT * FROM domain_events
        WHERE source_id=$1 AND source_key=$2 FOR UPDATE`, [row.sourceId,row.sourceKey]);
      let id: string;
      if (!current.rowCount) {
        const inserted = await client.query<{ id: string }>(`INSERT INTO domain_events
          (source_id,source_key,domain,title,venue,source_url,ticket_url,price_note,
           source_checked_at,observed_on,content_hash)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [row.sourceId,row.sourceKey,row.domain,row.title,row.venue,row.sourceUrl,row.ticketUrl,
          row.priceNote,checkedAt,row.observedOn,contentHash]);
        id = inserted.rows[0].id; counts.inserted++;
      } else {
        const stored = current.rows[0]; id = stored.id;
        if (stored.domain !== row.domain) throw new Error('活動來源鍵對應到不同領域，需人工核對');
        if (new Date(checkedAt) < stored.source_checked_at) throw new Error('活動資料比已匯入版本更舊');
        if (stored.content_hash.trim() === contentHash) {
          await client.query(`UPDATE domain_events SET source_checked_at=$2,observed_on=$3
            WHERE id=$1`,[id,checkedAt,row.observedOn]);
          counts.unchanged++;
        }
        else {
          for (const [field, before, after] of [
            ['title',stored.title,row.title], ['venue',stored.venue,row.venue],
            ['sourceUrl',stored.source_url,row.sourceUrl], ['ticketUrl',stored.ticket_url,row.ticketUrl],
            ['priceNote',stored.price_note,row.priceNote],
          ] as const) await change(client,id,field,before,after);
          const oldDetail = row.domain === 'performance'
            ? await client.query(`SELECT session_key AS "sessionKey",starts_at AS "startsAt",hall,
              ticket_url AS "ticketUrl",price_min AS "priceMin",price_max AS "priceMax",status
              FROM event_sessions WHERE event_id=$1 ORDER BY session_key`,[id])
            : await client.query(`SELECT to_char(local_time,'HH24:MI') AS "localTime",
              duration_minutes AS "durationMinutes",venue FROM recurring_schedules
              WHERE event_id=$1 ORDER BY local_time`,[id]);
          const prior = row.domain === 'performance' ? oldDetail.rows.map((session) => ({
            ...session, startsAt: new Date(session.startsAt).toISOString(),
          })) : oldDetail.rows;
          const next = row.domain === 'performance' ? normalizedSessions(row).map((session) => ({
            ...session, startsAt: new Date(session.startsAt).toISOString(),
          })) : normalizedTimes(row);
          await change(client,id,row.domain === 'performance' ? 'sessions' : 'recurringSchedule',prior,next);
          await client.query(`UPDATE domain_events SET title=$2,venue=$3,source_url=$4,ticket_url=$5,
            price_note=$6,source_checked_at=$7,observed_on=$8,content_hash=$9,updated_at=now()
            WHERE id=$1`,[id,row.title,row.venue,row.sourceUrl,row.ticketUrl,row.priceNote,
            checkedAt,row.observedOn,contentHash]);
          counts.updated++;
        }
      }
      if (row.domain === 'performance') {
        const sessions = normalizedSessions(row);
        for (const session of sessions) await client.query(`INSERT INTO event_sessions
          (event_id,session_key,starts_at,hall,ticket_url,price_min,price_max,status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (event_id,session_key) DO UPDATE SET starts_at=EXCLUDED.starts_at,hall=EXCLUDED.hall,
          ticket_url=EXCLUDED.ticket_url,price_min=EXCLUDED.price_min,
          price_max=EXCLUDED.price_max,status=EXCLUDED.status,last_seen_at=now()`,
        [id,session.sessionKey,session.startsAt,session.hall,session.ticketUrl,
          session.priceMin,session.priceMax,session.status]);
        const keys = sessions.map((session) => session.sessionKey);
        await client.query(`UPDATE event_sessions SET status='unknown'
          WHERE event_id=$1 AND NOT (session_key=ANY($2::text[]))`,[id,keys]);
      } else {
        await client.query('DELETE FROM recurring_schedules WHERE event_id=$1',[id]);
        for (const time of normalizedTimes(row)) await client.query(`INSERT INTO recurring_schedules
          (event_id,local_time,recurrence,duration_minutes,venue)
          VALUES ($1,$2,'daily',$3,$4)`,[id,time.localTime,time.durationMinutes,time.venue]);
      }
    }
    await client.query(`UPDATE domain_source_runs SET status='succeeded',fetched_count=$2,
      accepted_count=$2,review_note=$3,identity_keys=$4,finished_at=now() WHERE id=$1`,
    [run.rows[0].id,rows.length,reviewedListChange ? reviewNote!.trim() : null,identityKeys]);
    await client.query('COMMIT'); transaction=false;
    return counts;
  } catch (error) {
    if (transaction) await client.query('ROLLBACK');
    await pool.query(`UPDATE domain_source_runs SET status='failed',fetched_count=$2,
      error_message=$3,identity_keys=$4,finished_at=now() WHERE id=$1`,
    [run.rows[0].id,rows.length,error instanceof Error ? error.message.slice(0,500) : String(error).slice(0,500),identityKeys]);
    throw error;
  } finally { client.release(); }
}
