import { createHash } from 'node:crypto';
import { normalizeExhibition, type ExhibitionDraft } from '../normalize.ts';
import type { SourceRecord } from './nmmba.ts';

export const nstmDataUrl = 'https://websrv.nstm.gov.tw/OtherInfo/OpenData/ExhibitionInfoOpenData.ashx';
export const nstmListUrl = 'https://www.nstm.gov.tw/ExhibitionList.aspx?ExhibitionType=2&Period=2&Pindex=1';

function decode(value: string): string {
  return value.replace(/&(?:amp|quot|#39|lt|gt);/g, (item) => ({
    '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>',
  })[item]!);
}

function compact(value: string): string {
  return decode(value).normalize('NFKC').replace(/\s+/g, '').trim();
}

function rocRange(value: string): [string, string] | null {
  const match = value.match(/(\d{3})-(\d{2})-(\d{2})\s*~\s*(\d{3})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return [`${Number(match[1]) + 1911}-${match[2]}-${match[3]}`,
    `${Number(match[4]) + 1911}-${match[5]}-${match[6]}`];
}

export function parseNstmList(html: string): Map<string, Array<{ url: string; dates: [string, string] }>> {
  const matches = new Map<string, Array<{ url: string; dates: [string, string] }>>();
  for (const card of html.split(/<div class="exhi_data_list">/).slice(1)) {
    const anchor = card.match(/<a href="(\/Exhibition\.aspx\?KeyID=[a-f0-9-]{36})"[^>]*title="([^"]+)"/i);
    const dateText = card.match(/<span><i>展覽日期：<\/i>([^<]+)<\/span>/);
    if (!anchor || !dateText) continue;
    const dates = rocRange(dateText[1]);
    if (!dates) continue;
    const key = compact(anchor[2]);
    const existing = matches.get(key) ?? [];
    existing.push({ url: new URL(anchor[1], 'https://www.nstm.gov.tw').href, dates });
    matches.set(key, existing);
  }
  if (!matches.size) throw new Error('科工館官方特展列表無法解析，停止匯入');
  return matches;
}

export function classifyNstmFeed(payload: unknown, html: string, today: string):
  { rows: ExhibitionDraft[]; records: SourceRecord[] } {
  if (!Array.isArray(payload) || payload.length === 0) throw new Error('科工館 JSON 不是非空陣列');
  const official = parseNstmList(html);
  const rows: ExhibitionDraft[] = [];
  const records: SourceRecord[] = [];
  for (const item of payload) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('科工館 JSON 含非物件資料');
    const raw = item as Record<string, unknown>;
    if (raw.Category !== '特展' || typeof raw.ExhibitionEndDate !== 'string'
      || raw.ExhibitionEndDate < today.replaceAll('-', '')) continue;
    const title = typeof raw.ExhibitionName === 'string' ? raw.ExhibitionName.trim() : '';
    const start = typeof raw.ExhibitionStartDate === 'string' ? raw.ExhibitionStartDate : '';
    const end = raw.ExhibitionEndDate;
    const sourceKey = `nstm:${createHash('sha256').update(`${title}|${start}`).digest('hex')}`;
    const record: SourceRecord = { sourceKey, sourceUrl: null, raw, status: 'review', reason: null };
    records.push(record);
    try {
      if (!/^\d{8}$/.test(start) || !/^\d{8}$/.test(end)) throw new Error('公開 JSON 展期格式錯誤');
      const dates: [string, string] = [`${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6)}`,
        `${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6)}`];
      const candidates = official.get(compact(title)) ?? [];
      const verified = candidates.filter((candidate) => candidate.dates[0] === dates[0]
        && candidate.dates[1] === dates[1]);
      if (verified.length !== 1) throw new Error('無唯一且同展期的館方詳情頁');
      const url = verified[0].url;
      const row = normalizeExhibition({ museumId: 'nstm', title,
        startDate: dates[0], endDate: dates[1], venue: raw.Floor ?? null,
        sourceUrl: url, isSample: false }, 'nstm');
      record.sourceUrl = url;
      record.status = 'ready';
      rows.push(row);
    } catch (error) {
      record.reason = error instanceof Error ? error.message : String(error);
    }
  }
  if (!records.length) throw new Error('科工館公開 JSON 沒有當期特展，已停止匯入');
  if (new Set(records.map((record) => record.sourceKey)).size !== records.length) {
    throw new Error('科工館來源鍵重複，已停止整批匯入');
  }
  return { rows, records };
}
