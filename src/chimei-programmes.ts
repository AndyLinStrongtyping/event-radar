import { createHash } from 'node:crypto';
import type pg from 'pg';
import type { ChimeiActivity, ChimeiActivitySnapshot } from './sources/chimei-activities.ts';

export type ScheduleType = 'date_range' | 'multiple_dates' | 'ongoing' | 'time_only' | 'unknown';
export type ProgrammeDraft = ChimeiActivity & {
  scheduleType: ScheduleType;
  startDate: string | null;
  endDate: string | null;
  contentHash: string;
};

const officialOrigin = 'https://www.chimeimuseum.org';

function validDate(raw: string): string | null {
  const normalized = raw.replace(/[./]/g, '-');
  const parsed = new Date(`${normalized}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized
    ? normalized : null;
}

export function parseChimeiProgrammeDate(rawDate: string): {
  scheduleType: ScheduleType; startDate: string | null; endDate: string | null;
} {
  const date = '\\d{4}[./-]\\d{2}[./-]\\d{2}';
  const range = rawDate.trim().match(new RegExp(`^(${date})\\s*[-–—~至]\\s*(${date})(?:\\n博物館開放日)?$`));
  if (range) {
    const startDate = validDate(range[1]);
    const endDate = validDate(range[2]);
    if (startDate && endDate && endDate >= startDate) {
      return { scheduleType: 'date_range', startDate, endDate };
    }
    return { scheduleType: 'unknown', startDate: null, endDate: null };
  }
  const empty = { startDate: null, endDate: null };
  if (/即日起|長期/.test(rawDate)) return { scheduleType: 'ongoing', ...empty };
  const lines = rawDate.trim().split('\n');
  if (/^\d{4}$/.test(lines[0] ?? '')
    && lines.slice(1).filter((line) => /^\d{1,2}\/\d{1,2}\b/.test(line)).length > 1) {
    return { scheduleType: 'multiple_dates', ...empty };
  }
  if (/^\d{1,2}:\d{2}\s*[-–—~]\s*\d{1,2}:\d{2}/.test(rawDate.trim())) {
    return { scheduleType: 'time_only', ...empty };
  }
  return { scheduleType: 'unknown', ...empty };
}

export function normalizeChimeiProgramme(item: ChimeiActivity): ProgrammeDraft {
  if (!item || !/^[a-zA-Z0-9_-]{1,64}$/.test(item.id)
    || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 180
    || typeof item.dateText !== 'string' || !item.dateText.trim() || item.dateText.length > 500
    || !(item.type === null || (typeof item.type === 'string' && item.type.length <= 80))
    || typeof item.sourceUrl !== 'string') throw new Error('奇美活動快照欄位格式錯誤');
  const url = new URL(item.sourceUrl);
  if (url.origin !== officialOrigin || url.protocol !== 'https:' || url.username || url.password
    || !/^\/event\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname) || url.search || url.hash) {
    throw new Error('奇美活動快照不是官方詳情網址');
  }
  const schedule = parseChimeiProgrammeDate(item.dateText);
  const contentHash = createHash('sha256').update(JSON.stringify([
    item.title, item.dateText, schedule.scheduleType, schedule.startDate, schedule.endDate,
    item.type, item.sourceUrl,
  ])).digest('hex');
  return { ...item, ...schedule, contentHash };
}

type Stored = { id: string; title: string; rawDate: string; scheduleType: ScheduleType;
  startDate: string | null; endDate: string | null; eventType: string | null;
  sourceUrl: string; contentHash: string };

const tracked = ['title', 'rawDate', 'scheduleType', 'startDate', 'endDate',
  'eventType', 'sourceUrl'] as const;

/** Manual candidate import: never removes missing rows or changes public exhibition search. */
export async function importChimeiProgrammeSnapshot(pool: pg.Pool,
  snapshot: ChimeiActivitySnapshot): Promise<{ inserted: number; updated: number; unchanged: number }> {
  if (snapshot.sourceUrl !== `${officialOrigin}/exhibition-event`
    || typeof snapshot.checkedAt !== 'string' || Number.isNaN(Date.parse(snapshot.checkedAt))
    || !Array.isArray(snapshot.items) || snapshot.items.length === 0 || snapshot.items.length > 200) {
    throw new Error('奇美活動快照來源、時間或筆數無效');
  }
  const rows = snapshot.items.map(normalizeChimeiProgramme);
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error('奇美活動快照來源 ID 重複');
  const client = await pool.connect();
  let transaction = false;
  try {
    await client.query('BEGIN');
    transaction = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtext('chimei:expo'))");
    const previous = await client.query<{ source_event_id: string; last_checked_at: Date }>(
      `SELECT source_event_id,last_checked_at FROM programme_events
       WHERE museum_id='chimei' AND provider='chimei-internal' AND source_type='expo'
         AND last_checked_at=(SELECT max(last_checked_at) FROM programme_events
           WHERE museum_id='chimei' AND provider='chimei-internal' AND source_type='expo')`);
    if (previous.rows.length) {
      const oldIds = new Set(previous.rows.map((row) => row.source_event_id));
      const overlap = rows.filter((row) => oldIds.has(row.id)).length;
      if (rows.length * 2 <= previous.rows.length
        || overlap < Math.ceil(previous.rows.length / 3)) {
        throw new Error('奇美活動清單疑似縮水或來源 ID 大量更換，保留舊資料待人工核對');
      }
      if (previous.rows.some((row) => new Date(snapshot.checkedAt) < row.last_checked_at)) {
        throw new Error('奇美活動快照比已匯入資料更舊');
      }
    }
    const counts = { inserted: 0, updated: 0, unchanged: 0 };
    for (const row of rows) {
      const current = await client.query<Stored>(`SELECT id,title,raw_date AS "rawDate",
        schedule_type AS "scheduleType",to_char(start_date,'YYYY-MM-DD') AS "startDate",
        to_char(end_date,'YYYY-MM-DD') AS "endDate",event_type AS "eventType",
        source_url AS "sourceUrl",content_hash AS "contentHash"
        FROM programme_events WHERE museum_id='chimei' AND provider='chimei-internal'
        AND source_type='expo' AND source_event_id=$1 FOR UPDATE`, [row.id]);
      if (!current.rows.length) {
        await client.query(`INSERT INTO programme_events
          (museum_id,provider,source_type,source_event_id,title,raw_date,schedule_type,
           start_date,end_date,event_type,source_url,content_hash,last_checked_at)
          VALUES ('chimei','chimei-internal','expo',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [row.id, row.title, row.dateText, row.scheduleType, row.startDate, row.endDate,
          row.type, row.sourceUrl, row.contentHash, snapshot.checkedAt]);
        counts.inserted++;
        continue;
      }
      const stored = current.rows[0];
      const next = { ...row, rawDate: row.dateText, eventType: row.type };
      if (stored.contentHash.trim() === row.contentHash) {
        await client.query(`UPDATE programme_events SET last_seen_at=now(),last_checked_at=$2
          WHERE id=$1`, [stored.id, snapshot.checkedAt]);
        counts.unchanged++;
        continue;
      }
      await client.query(`UPDATE programme_events SET title=$2,raw_date=$3,schedule_type=$4,
        start_date=$5,end_date=$6,event_type=$7,source_url=$8,content_hash=$9,
        last_checked_at=$10,last_seen_at=now(),updated_at=now() WHERE id=$1`,
      [stored.id, row.title, row.dateText, row.scheduleType, row.startDate, row.endDate,
        row.type, row.sourceUrl, row.contentHash, snapshot.checkedAt]);
      for (const field of tracked) {
        if (stored[field] === next[field]) continue;
        await client.query(`INSERT INTO programme_event_changes
          (event_id,field_name,old_value,new_value) VALUES ($1,$2,$3,$4)`,
        [stored.id, field, stored[field], next[field]]);
      }
      counts.updated++;
    }
    await client.query('COMMIT');
    transaction = false;
    return counts;
  } catch (error) {
    if (transaction) await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
