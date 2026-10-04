import { normalizeExhibition, type ExhibitionDraft } from '../normalize.ts';

const base = 'https://south.npm.gov.tw/';
export const npmSouthPages = [
  `${base}ExhibitionsListC003110.aspx?Pindex=1&SearchAdvanced=False&appname=Exhibition3112`,
  `${base}ExhibitionsListC003110.aspx?Pindex=1&SearchAdvanced=False&appname=Exhibition3111`,
] as const;

function text(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ').trim();
}

function rocDate(value: string): string {
  const match = value.trim().match(/^(\d{2,3})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`故宮南院展期格式錯誤：${value}`);
  return `${Number(match[1]) + 1911}-${match[2]}-${match[3]}`;
}

/** Parse only the official exhibition cards, excluding navigation, events and open-ended permanent halls. */
export function parseNpmSouthPage(html: string): ExhibitionDraft[] {
  const cards = [...html.matchAll(/<a\b([^>]*\bid=["']ContentPlaceHolder1_ucExhibitionsList_repList_aLinkDetail_\d+["'][^>]*)>([\s\S]*?)<\/a>/gi)];
  if (cards.length === 0) throw new Error('故宮南院展覽列表格式變更：找不到展覽卡');
  const rows: ExhibitionDraft[] = [];
  for (const [, attributes, body] of cards) {
    const href = attributes.match(/\bhref=["']([^"']+)["']/i)?.[1]?.replaceAll('&amp;', '&');
    const title = attributes.match(/\btitle=["']([^"']+)["']/i)?.[1];
    if (!href || !title) throw new Error('故宮南院展覽卡缺少網址或標題');
    const dateBlock = body.match(/class=["'][^"']*kf_imglist_time[^"']*["']>([\s\S]*?)<\/div>/i)?.[1] || '';
    const dates = [...dateBlock.matchAll(/<span[^>]*>\s*(\d{2,3}-\d{2}-\d{2})\s*<\/span>/gi)].map((match) => match[1]);
    if (dates.length < 2) continue; // No end date: permanent exhibition or annual schedule.
    const detail = new URL(href, base);
    const cond = detail.searchParams.get('Cond');
    if (detail.hostname !== 'south.npm.gov.tw' || detail.pathname !== '/ExhibitionsDetailC003110.aspx'
      || !cond || !/^[0-9a-f-]{36}$/i.test(cond)) throw new Error('故宮南院展覽網址格式錯誤');
    const sourceUrl = `${base}ExhibitionsDetailC003110.aspx?Cond=${cond.toLowerCase()}`;
    const venueBlock = body.match(/class=["'][^"']*remarks_ic-map[^"']*["']>([\s\S]*?)<\/div>/i)?.[1] || '';
    rows.push(normalizeExhibition({
      museumId: 'npm-south', title: text(title), venue: text(venueBlock) || null,
      startDate: rocDate(dates[0]), endDate: rocDate(dates[1]),
      sourceUrl, priceNote: null, summary: null, isSample: false,
    }, 'npm-south'));
  }
  return rows;
}

export function mergeNpmSouthPages(pages: string[]): ExhibitionDraft[] {
  const unique = new Map<string, ExhibitionDraft>();
  for (const html of pages) {
    for (const row of parseNpmSouthPage(html)) {
      const existing = unique.get(row.sourceKey);
      if (existing && existing.contentHash !== row.contentHash) {
        throw new Error(`故宮南院同一展覽在當期與預告頁資訊不一致：${row.sourceUrl}`);
      }
      unique.set(row.sourceKey, row);
    }
  }
  if (unique.size === 0) throw new Error('故宮南院展覽頁沒有可匯入的有限期展覽');
  return [...unique.values()];
}
