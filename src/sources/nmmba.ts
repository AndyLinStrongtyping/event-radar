import { createHash } from 'node:crypto';
import { normalizeExhibition, type ExhibitionDraft } from '../normalize.ts';

export const nmmbaDataUrl = 'https://www.nmmba.gov.tw/OpenData.aspx?SN=BF6D6EB9CB6876BB';

export type SourceRecord = {
  sourceKey: string;
  sourceUrl: string | null;
  raw: Record<string, unknown>;
  status: 'ready' | 'review' | 'ignored';
  reason: string | null;
};

export type NmmbaBatch = { rows: ExhibitionDraft[]; records: SourceRecord[] };

/** Source data uses ROC yyyMMdd, ISO dates, and occasionally Gregorian yyyyMMdd. */
export function parseNmmbaDate(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('缺少展期');
  const raw = value.trim();
  let year: number;
  let month: string;
  let day: string;
  if (/^\d{7}$/.test(raw)) {
    year = Number(raw.slice(0, 3)) + 1911;
    month = raw.slice(3, 5);
    day = raw.slice(5, 7);
  } else if (/^\d{8}$/.test(raw)) {
    year = Number(raw.slice(0, 4));
    month = raw.slice(4, 6);
    day = raw.slice(6, 8);
  } else {
    const match = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    if (!match) throw new Error(`不支援的展期格式：${raw.slice(0, 32)}`);
    year = Number(match[1]);
    month = match[2];
    day = match[3];
  }
  const date = `${year.toString().padStart(4, '0')}-${month}-${day}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (year < 1900 || year > 2100 || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`無效日期：${raw.slice(0, 32)}`);
  }
  return date;
}

export function classifyNmmbaFeed(payload: unknown): NmmbaBatch {
  if (!Array.isArray(payload) || payload.length === 0) throw new Error('海生館資料不是非空陣列');
  const rows: ExhibitionDraft[] = [];
  const records: SourceRecord[] = [];
  for (const [index, item] of payload.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`海生館第 ${index + 1} 筆不是物件`);
    const raw = item as Record<string, unknown>;
    const sourceUrl = typeof raw.Source === 'string' ? raw.Source.trim() : null;
    const sourceKey = sourceUrl || `raw:${createHash('sha256').update(JSON.stringify(raw)).digest('hex')}`;
    try {
      const title = raw['特展名稱'];
      if (typeof title !== 'string' || !title.trim()) throw new Error('缺少特展名稱');
      const startDate = parseNmmbaDate(raw['app用開始時間']);
      const endDate = parseNmmbaDate(raw['app用結束時間']);
      const row = normalizeExhibition({
        museumId: 'nmmba', title, startDate, endDate,
        venue: raw['展出地點'] || null, sourceUrl,
        summary: null, priceNote: null, isSample: false,
      }, 'nmmba');
      rows.push(row);
      records.push({ sourceKey, sourceUrl, raw, status: 'ready', reason: null });
    } catch (error) {
      records.push({ sourceKey, sourceUrl, raw, status: 'review',
        reason: error instanceof Error ? error.message : String(error) });
    }
  }
  if (new Set(records.map((record) => record.sourceKey)).size !== records.length) {
    throw new Error('海生館來源鍵重複，已停止整批匯入');
  }
  return { rows, records };
}
