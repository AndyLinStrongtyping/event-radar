import { normalizeExhibition, type ExhibitionDraft } from '../normalize.ts';
import type { SourceRecord } from './nmmba.ts';

export const ntmofaPages = [
  'https://www.ntmofa.gov.tw/News_Actives_photo.aspx?n=1462&sms=11893',
  'https://www.ntmofa.gov.tw/News_Actives_photo.aspx?n=1464&sms=11893',
] as const;

export type ArtRelatedEvent = { title: string; sourceUrl: string;
  eventType: 'lecture' | 'guided_tour' | 'workshop' | 'other' };
export type ArtExhibitionDraft = ExhibitionDraft & { art: {
  artistNames: string[]; curatorNames: string[];
  exhibitionType: 'temporary' | 'education' | 'biennial';
  venueArea: string | null; floor: string | null; relatedEvents: ArtRelatedEvent[];
} };

function decode(value: string): string {
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|amp|quot|apos|nbsp|lt|gt|rsquo|lsquo|rdquo|ldquo);/gi, (entity, decimal, hex) => {
    if (decimal || hex) {
      const code = Number.parseInt(decimal || hex, hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    const named: Record<string, string> = {
      '&amp;': '&', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ', '&lt;': '<', '&gt;': '>',
      '&rsquo;': '’', '&lsquo;': '‘', '&rdquo;': '”', '&ldquo;': '“',
    };
    return named[entity.toLowerCase()] ?? entity;
  });
}

function plain(value: string): string {
  return decode(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function sourceUrl(value: string): { url: string; id: string } | null {
  try {
    const url = new URL(decode(value));
    const id = url.searchParams.get('actId');
    if (url.protocol !== 'https:' || url.hostname !== 'event.culture.tw'
      || url.pathname !== '/mocweb/reg/NTMOFA/Detail.init.ctr' || !/^\d{4,8}$/.test(id ?? '')) return null;
    return { url: `https://event.culture.tw/mocweb/reg/NTMOFA/Detail.init.ctr?actId=${id}`, id: id! };
  } catch { return null; }
}

function explicitNames(html: string, labels: string[]): string[] {
  for (const label of labels) {
    const match = html.match(new RegExp(`${label}\\s*[：:]\\s*([^<]{1,200})`));
    if (!match) continue;
    const names = decode(match[1]).split(/[、，,]/).map((name) => name.trim())
      .filter((name) => name.length > 0 && name.length <= 50);
    if (names.length > 0 && names.length <= 20) return [...new Set(names)];
  }
  return [];
}

function relatedEvents(html: string): ArtRelatedEvent[] {
  const block = html.match(/<!--相關系列活動START-->([\s\S]*?)<!--相關系列活動END-->/)?.[1] ?? '';
  const events = new Map<string, ArtRelatedEvent>();
  for (const match of block.matchAll(/<a\b[^>]*onclick=["']viewDetail\('([0-9]{4,8})'\);["'][^>]*>([\s\S]*?)<\/a>/g)) {
    const title = plain(match[2]);
    if (!title || title.length > 200) continue;
    const url = sourceUrl(`https://event.culture.tw/mocweb/reg/NTMOFA/Detail.init.ctr?actId=${match[1]}`)!;
    const eventType = /導覽/.test(title) ? 'guided_tour' : /講座|講演|座談/.test(title) ? 'lecture'
      : /工作坊|體驗/.test(title) ? 'workshop' : 'other';
    events.set(url.url, { title, sourceUrl: url.url, eventType });
  }
  return [...events.values()];
}

function areaFromDetail(html: string): string | null {
  const content = plain(html.match(/<!-- 活動內容介紹START -->([\s\S]*?)<!-- 活動內容介紹END -->/)?.[1] ?? html);
  const match = content.match(/展覽地點\s*[︱│|：:]\s*(國立臺灣美術館[^。]{0,100}?)(?=展覽介紹|活動信箱|主辦單位|$)/);
  return match ? match[1].replace(/^國立臺灣美術館\s*/, '').trim() || null : null;
}

/** Only on-site, limited exhibitions enter the shared exhibition search. */
export async function classifyNtmofaPages(pages: string[], fetchDetail: (url: string) => Promise<string>):
  Promise<{ rows: ArtExhibitionDraft[]; records: SourceRecord[] }> {
  if (pages.length !== ntmofaPages.length) throw new Error('國美館需要當期與預告兩頁');
  const cards = pages.flatMap((page) => [...page.matchAll(/<a\b([^>]*class="div-activity"[^>]*)>([\s\S]*?)<\/a>/gi)]);
  if (cards.length === 0) throw new Error('國美館展覽卡格式變更：停止匯入');
  const rows: ArtExhibitionDraft[] = [];
  const records: SourceRecord[] = [];
  const seen = new Set<string>();
  for (const [, attrs, body] of cards) {
    const target = sourceUrl(attrs.match(/\bhref="([^"]+)"/i)?.[1] ?? '');
    const title = plain(attrs.match(/\btitle="([^"]+)"/i)?.[1] ?? '');
    if (!target || !title) throw new Error('國美館展覽卡缺少官方詳情網址或標題');
    if (seen.has(target.id)) throw new Error(`國美館來源 ID 重複：${target.id}`);
    seen.add(target.id);
    const venue = plain(body.match(/activity-season[^>]*>([^<]+)/i)?.[1] ?? '').replace(/^地點[:：]\s*/, '');
    const dateText = plain(body.match(/activity-time[^>]*>([^<]+)/i)?.[1] ?? '');
    const dates = dateText.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
    const raw = { title, venue, dateText, sourceUrl: target.url };
    const record: SourceRecord = { sourceKey: `ntmofa:${target.id}`, sourceUrl: target.url,
      raw, status: 'review', reason: null };
    records.push(record);
    if (/常設展|名單公布|線上|數位博物館/.test(title)
      || /國家攝影文化中心|桃園國際機場|光州|機場|線上/.test(venue + title)) {
      record.status = 'ignored'; record.reason = '常設、公告、線上或館外項目'; continue;
    }
    if (!dates) { record.reason = '缺少完整展期'; continue; }
    try {
      const html = await fetchDetail(target.url);
      const detailTitle = plain(html.match(/<div class="programDetailGroup">[\s\S]*?<div class="title_01">([\s\S]*?)<\/div>/)?.[1] ?? '');
      if (detailTitle.normalize('NFKC') !== title.normalize('NFKC')) throw new Error('詳情標題與官方清單不符');
      const onSite = /展覽室|教育展示空間|美術街/.test(venue)
        || /展覽地點\s*[︱│|：:]\s*國立臺灣美術館/.test(plain(html));
      if (!onSite || /國家攝影文化中心|桃園國際機場|光州/.test(venue)) {
        record.status = 'ignored'; record.reason = '無法確認在國美館臺中本館展出'; continue;
      }
      const venueArea = venue || areaFromDetail(html);
      const normalized = normalizeExhibition({ museumId: 'ntmofa', title,
        sourceUrl: target.url, startDate: dates[1], endDate: dates[2],
        venue: venueArea, priceNote: null, summary: null, isSample: false }, 'ntmofa');
      const floor = venueArea?.match(/\b(B\d|\dF)\b/i)?.[1]?.toUpperCase() ?? null;
      rows.push({ ...normalized, art: {
        artistNames: explicitNames(html, ['參展藝術家']),
        curatorNames: explicitNames(html, ['策展人']),
        exhibitionType: /雙年展/.test(title) ? 'biennial' : /藝術教育展/.test(title) ? 'education' : 'temporary',
        venueArea, floor, relatedEvents: relatedEvents(html),
      } });
      record.status = 'ready';
    } catch (error) { record.reason = error instanceof Error ? error.message : String(error); }
  }
  if (rows.length === 0) throw new Error('國美館官方清單沒有可驗證的本館限期展，停止匯入');
  return { rows, records };
}
