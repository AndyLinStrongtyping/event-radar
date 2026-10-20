import { createHash } from 'node:crypto';
import { normalizeExhibition, type ExhibitionDraft } from '../normalize.ts';
import type { SourceRecord } from './nmmba.ts';

export const npmNorthDataUrl = 'https://odapi.npm.gov.tw/data/open/api/v1/exhibition/current.json';

// Verified against the museum's current-exhibition page and individual detail pages.
// This is a time-limited completeness check, not a replacement exhibition feed.
export const npmNorthKnownCurrent = [
  { sourceKey: '04014549', title: '真知灼見：美感原則與書法欣賞',
    startDate: '2026-09-25', endDate: '2026-12-27',
    sourceUrl: 'https://www.npm.gov.tw/Exhibition-Content.aspx?l=1&sno=04014549' },
  { sourceKey: '04014551', title: '養心：巨幅名作展',
    startDate: '2026-09-22', endDate: '2026-12-27',
    sourceUrl: 'https://www.npm.gov.tw/Exhibition-Content.aspx?l=1&sno=04014551' },
] as const;

export function checkNpmNorthKnownCoverage(rows: ExhibitionDraft[], today: string): string[] {
  const byKey = new Map(rows.map((row) => [row.sourceKey, row]));
  return npmNorthKnownCurrent.filter((known) => known.startDate <= today && known.endDate >= today)
    .flatMap((known) => {
      const row = byKey.get(known.sourceKey);
      if (!row) return [`${known.title} (${known.sourceKey}) 未出現在可公開清單`];
      const url = new URL(row.sourceUrl);
      if (row.title !== known.title || row.startDate !== known.startDate || row.endDate !== known.endDate
        || url.hostname !== new URL(known.sourceUrl).hostname
        || url.pathname !== new URL(known.sourceUrl).pathname
        || url.searchParams.get('sno') !== known.sourceKey) {
        return [`${known.title} (${known.sourceKey}) 的標題、展期或詳情網址與官網核對值不符`];
      }
      return [];
    });
}

function parseRange(value: unknown): [string, string] {
  if (typeof value !== 'string') throw new Error('缺少展期');
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})$/);
  if (!match) throw new Error('展期缺少完整起訖日');
  return [match[1], match[2]];
}

export function classifyNpmNorthFeed(payload: unknown, today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())):
  { rows: ExhibitionDraft[]; records: SourceRecord[] } {
  if (!Array.isArray(payload) || payload.length === 0) throw new Error('故宮展覽資料不是非空陣列');
  const rows: ExhibitionDraft[] = [];
  const records: SourceRecord[] = [];
  for (const [index, item] of payload.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`故宮第 ${index + 1} 筆不是物件`);
    const raw = item as Record<string, unknown>;
    const sourceUrl = typeof raw.link === 'string' ? raw.link.trim() : null;
    const sourceKey = typeof raw.sno === 'string' && /^\d{5,20}$/.test(raw.sno)
      ? raw.sno : `raw:${createHash('sha256').update(JSON.stringify(raw)).digest('hex')}`;
    const record: SourceRecord = { sourceKey, sourceUrl, raw, status: 'review', reason: null };
    records.push(record);
    try {
      const location = typeof raw.location === 'string' ? raw.location.trim() : '';
      if (location.includes('南部院區')) {
        record.status = 'ignored'; record.reason = '屬於南部院區'; continue;
      }
      if (!location.includes('北部院區')) throw new Error('無法確認為北部院區');
      const [startDate, endDate] = parseRange(raw.time);
      const row = normalizeExhibition({ museumId: 'npm-north', title: raw.title,
        venue: location, startDate, endDate, sourceUrl, sourceKey, isSample: false,
      }, 'npm-north');
      if (endDate < today) {
        record.status = 'ignored'; record.reason = '展期已結束'; continue;
      }
      const durationDays = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000;
      if (durationDays > 730) throw new Error('展期超過兩年，須確認是否為常設展');
      rows.push(row);
      record.status = 'ready';
    } catch (error) {
      record.reason = error instanceof Error ? error.message : String(error);
    }
  }
  if (new Set(records.map((record) => record.sourceKey)).size !== records.length) {
    throw new Error('故宮來源鍵重複，已停止整批匯入');
  }
  return { rows, records };
}
