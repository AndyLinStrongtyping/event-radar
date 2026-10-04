import { normalizeExhibition, type ExhibitionDraft } from '../normalize.ts';

export function normalizeNmnsFeed(payload: unknown): ExhibitionDraft[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('科博館資料格式錯誤');
  const feed = payload as Record<string, unknown>;
  if (feed.success !== true || !Array.isArray(feed.itemList)) throw new Error('科博館資料缺少 itemList');
  return feed.itemList.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`第 ${index + 1} 筆格式錯誤`);
    const row = item as Record<string, unknown>;
    const slashDate = (value: unknown): string => {
      if (typeof value !== 'string' || !/^\d{4}\/\d{2}\/\d{2}$/.test(value)) throw new Error('科博館展期格式錯誤');
      return value.replaceAll('/', '-');
    };
    return normalizeExhibition({
      museumId: 'nmns',
      title: row.title,
      venue: row.location,
      startDate: slashDate(row.dateStart),
      endDate: slashDate(row.dateEnd),
      sourceUrl: row.url,
      priceNote: null,
      summary: null,
      isSample: false,
    }, 'nmns');
  });
}
