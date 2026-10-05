import { normalizeExhibition, type ExhibitionDraft } from '../normalize.ts';
import type { SourceRecord } from './nmmba.ts';

export const mocExhibitionsUrl = 'https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?method=doFindTypeJ&category=6';

type Group = { title: string; url: string; intervals: Array<[string, string]>; records: SourceRecord[] };

function day(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}\/\d{2}\/\d{2}/.test(value)) throw new Error('文化部場次缺完整日期');
  return value.slice(0, 10).replaceAll('/', '-');
}

function nextDay(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function classifyMocChimei(payload: unknown):
  { groups: Group[]; records: SourceRecord[] } {
  if (!Array.isArray(payload) || !payload.length) throw new Error('文化部展覽資料不是非空陣列');
  const groups = new Map<string, Group>();
  const records: SourceRecord[] = [];
  for (const item of payload) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.showUnit !== 'string' || !raw.showUnit.includes('奇美博物館')) continue;
    const uid = typeof raw.UID === 'string' ? raw.UID : '';
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const source = typeof raw.sourceWebPromote === 'string' ? raw.sourceWebPromote.trim() : '';
    const record: SourceRecord = { sourceKey: uid, sourceUrl: source || null,
      raw, status: 'review', reason: null };
    records.push(record);
    try {
      if (!/^[a-zA-Z0-9]{10,100}$/.test(uid)) throw new Error('文化部來源鍵無效');
      if (!title || title.includes('常設展')) throw new Error('不是限期特展');
      const url = new URL(source);
      if (url.protocol !== 'https:' || url.hostname !== 'www.chimeimuseum.org'
        || !url.pathname.startsWith('/special-exhibition/')) {
        throw new Error('缺少奇美官方逐筆特展頁');
      }
      if (!Array.isArray(raw.showInfo) || !raw.showInfo.length) throw new Error('文化部場次缺失');
      const intervals = raw.showInfo.map((value: unknown): [string, string] => {
        if (!value || typeof value !== 'object') throw new Error('文化部場次格式錯誤');
        const show = value as Record<string, unknown>;
        return [day(show.time), day(show.endTime)];
      });
      const key = `${url.href}|${title}`;
      const group = groups.get(key) ?? { title, url: url.href, intervals: [], records: [] };
      group.intervals.push(...intervals);
      group.records.push(record);
      groups.set(key, group);
    } catch (error) {
      record.reason = error instanceof Error ? error.message : String(error);
    }
  }
  if (new Set(records.map((record) => record.sourceKey)).size !== records.length) {
    throw new Error('文化部來源鍵重複，停止匯入');
  }
  return { groups: [...groups.values()], records };
}

export function verifiedMocChimeiRows(groups: Group[], pages: Map<string, string>): ExhibitionDraft[] {
  const rows: ExhibitionDraft[] = [];
  for (const group of groups) {
    try {
      const intervals = group.intervals.sort(([a], [b]) => a.localeCompare(b));
      if (intervals.some(([start, end]) => end < start)) throw new Error('文化部展期倒置');
      for (let index = 1; index < intervals.length; index++) {
        if (intervals[index][0] > nextDay(intervals[index - 1][1])) {
          throw new Error('文化部同展分段不連續');
        }
      }
      const startDate = intervals[0][0];
      const endDate = intervals.reduce((max, [, end]) => end > max ? end : max, intervals[0][1]);
      const html = pages.get(group.url) ?? '';
      const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
      const datePattern = `${startDate.replaceAll('-', '[./]')}\\s*[^0-9]{1,20}\\s*${endDate.replaceAll('-', '[./]')}`;
      if (!text.includes(group.title) || !new RegExp(datePattern).test(text)) {
        throw new Error('奇美官方頁的展名或完整展期未通過核對');
      }
      rows.push(normalizeExhibition({ museumId: 'chimei', title: group.title,
        startDate, endDate, sourceUrl: group.url, isSample: false }, 'chimei'));
      for (const record of group.records) { record.status = 'ready'; record.reason = null; }
    } catch (error) {
      for (const record of group.records) {
        record.status = 'review';
        record.reason = error instanceof Error ? error.message : String(error);
      }
    }
  }
  return rows;
}
