import { createHash } from 'node:crypto';
import { normalizeExhibition, type ExhibitionDraft } from '../normalize.ts';
import type { SourceRecord } from './nmmba.ts';

type ScheduleType = 'date_range' | 'multiple_dates' | 'ongoing' | 'time_only' | 'unknown';
type ParsedSchedule = { type: ScheduleType; startDate: string | null; endDate: string | null };

const origin = 'https://www.chimeimuseum.org';

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 格式錯誤`);
  return value as Record<string, unknown>;
}

function group(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${label} 不是陣列`);
  return value.map((item, index) => object(item, `${label} 第 ${index + 1} 筆`));
}

function officialDetailUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('缺少奇美特展詳情網址');
  const url = new URL(value, `${origin}/`);
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password
    || !/^\/special-exhibition\/[^/]+(?:\/[^/]+)?\/?$/.test(url.pathname)) {
    throw new Error('不是奇美官方特展詳情網址');
  }
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/$/, '');
  return url.href;
}

function validDate(value: string): string {
  const date = value.replace(/[./]/g, '-');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('奇美展期不是有效日期');
  }
  return date;
}

/** Only an unambiguous single full date range can become a public exhibition. */
export function parseChimeiSchedule(value: unknown): ParsedSchedule {
  if (typeof value !== 'string' || !value.trim() || value.length > 500) {
    return { type: 'unknown', startDate: null, endDate: null };
  }
  const text = value.replace(/<br\s*\/?\s*>/gi, '; ')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const fullDate = '\\d{4}[./-]\\d{2}[./-]\\d{2}';
  const matches = [...text.matchAll(new RegExp(fullDate, 'g'))];
  if (matches.length > 2) return { type: 'multiple_dates', startDate: null, endDate: null };
  if (/即日起|長期|常設/.test(text)) return { type: 'ongoing', startDate: null, endDate: null };
  const range = text.match(new RegExp(`^(${fullDate})\\s*[-–—~至]\\s*(${fullDate})$`));
  if (range) {
    try {
      const startDate = validDate(range[1]);
      const endDate = validDate(range[2]);
      if (endDate < startDate) throw new Error('奇美展期結束日早於開始日');
      return { type: 'date_range', startDate, endDate };
    } catch {
      return { type: 'unknown', startDate: null, endDate: null };
    }
  }
  if (/\b\d{1,2}:\d{2}\b/.test(text) && matches.length === 0) {
    return { type: 'time_only', startDate: null, endDate: null };
  }
  return { type: 'unknown', startDate: null, endDate: null };
}

function sourceId(value: unknown): string | null {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value)
    : typeof value === 'string' ? value.trim() : '';
  return /^[a-zA-Z0-9_-]{1,64}$/.test(text) ? text : null;
}

/** Offline classification only; this does not fetch, write to DB, or certify source completeness. */
export function classifyChimeiInternalPayload(payload: unknown): {
  rows: ExhibitionDraft[]; records: SourceRecord[];
  counts: { specialEvent: number; permanentEvent: number; expoEvent: number };
} {
  const root = object(payload, '奇美回應');
  const special = group(root.specialEvent, 'specialEvent');
  const permanent = group(root.permanentEvent, 'permanentEvent');
  const expo = group(root.expoEvent, 'expoEvent');
  if (special.length + permanent.length + expo.length === 0) throw new Error('奇美三組資料皆為空');
  const rows: ExhibitionDraft[] = [];
  const records: SourceRecord[] = [];
  for (const item of special) {
    const id = sourceId(item.id);
    const rawDate = typeof item.date === 'string' ? item.date : null;
    const title = typeof item.title === 'string' ? item.title.trim() : null;
    let sourceUrl: string | null = null;
    let urlError: string | null = null;
    try { sourceUrl = officialDetailUrl(item.link); }
    catch (error) { urlError = error instanceof Error ? error.message : String(error); }
    const sourceKey = id ? `special:${id}` : `unidentified:${createHash('sha256')
      .update(JSON.stringify([item.link, item.title, item.date])).digest('hex')}`;
    const schedule = parseChimeiSchedule(item.date);
    const raw = { sourceType: 'special', sourceEventId: id, title, rawDate,
      scheduleType: schedule.type, startDate: schedule.startDate,
      endDate: schedule.endDate, sourceUrl };
    const record: SourceRecord = { sourceKey, sourceUrl, raw, status: 'review', reason: null };
    records.push(record);
    try {
      if (!id) throw new Error('奇美特展來源 ID 缺失或格式錯誤');
      if (urlError || !sourceUrl) throw new Error(urlError || '缺少奇美特展詳情網址');
      if (schedule.type !== 'date_range' || !schedule.startDate || !schedule.endDate) {
        throw new Error(`展期無法安全解析為單一完整起訖日（${schedule.type}）`);
      }
      rows.push(normalizeExhibition({ museumId: 'chimei', sourceKey,
        title, sourceUrl, startDate: schedule.startDate, endDate: schedule.endDate,
        venue: null, priceNote: null, summary: null, isSample: false }, 'chimei'));
      record.status = 'ready';
    } catch (error) {
      record.reason = error instanceof Error ? error.message : String(error);
    }
  }
  if (new Set(records.map((record) => record.sourceKey)).size !== records.length) {
    throw new Error('奇美特展來源 ID 重複，已停止整批處理');
  }
  return { rows, records, counts: { specialEvent: special.length,
    permanentEvent: permanent.length, expoEvent: expo.length } };
}
