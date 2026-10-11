export const nmmbaProgrammeUrl = 'https://www.nmmba.gov.tw/ActiveShow_D_Cus.aspx?n=33D045D1594ED637&sms=00C15C8CDECA96C3';
export type MarineProgramme = { sourceId: 'nmmba'; sourceKey: string; domain: 'marine';
  title: string; venue: string | null; sourceUrl: string; ticketUrl: null;
  priceNote: string | null; observedOn: string; recurrence: 'daily';
  times: { localTime: string; durationMinutes: number | null; venue: string | null }[] };

function plain(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

export function parseNmmbaProgrammes(html: string, observedOn: string): MarineProgramme[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observedOn)
    || new Date(`${observedOn}T00:00:00Z`).toISOString().slice(0, 10) !== observedOn) {
    throw new Error('海生館觀察日期無效');
  }
  const pageDay = plain(html.match(/(\d{1,2}月\d{1,2}日)\s*當日活動/)?.[1] ?? '');
  const expectedDay = `${Number(observedOn.slice(5, 7))}月${Number(observedOn.slice(8, 10))}日`;
  if (pageDay !== expectedDay) throw new Error('海生館節目表日期與本次觀察日不符，停止匯入');
  const list = html.match(/<ul\b[^>]*class="my-list clearfix"[^>]*>([\s\S]*?)<\/ul>\s*<\/div>/i)?.[1]
    ?? html.slice(html.indexOf('<ul class="my-list clearfix">'));
  const cards = [...list.matchAll(/<li>\s*<img\b[^>]*>\s*<ul\b[^>]*class="my-card"[^>]*>([\s\S]*?)<\/ul>\s*<\/li>/gi)];
  if (!cards.length) throw new Error('海生館節目卡格式變更或空清單');
  const results: MarineProgramme[] = [];
  for (const [, card] of cards) {
    const title = plain(card.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1] ?? '');
    const timeText = plain(card.match(/<li[^>]*>\s*<span>時間：([\s\S]*?)<\/li>/i)?.[1] ?? '');
    const durationText = plain(card.match(/<span>持續時間：<\/span>([\s\S]*?)<\/li>/i)?.[1] ?? '');
    const venue = plain(card.match(/<span>地點：<\/span>([\s\S]*?)<\/li>/i)?.[1] ?? '') || null;
    if (!title || title.length > 200 || !/每日\d+場/.test(timeText) || !venue) {
      throw new Error('海生館節目卡缺標題、每日場次或地點；整批停止匯入');
    }
    const times = [...new Set([...timeText.matchAll(/\b([01]\d|2[0-3]):[0-5]\d\b/g)].map((match) => match[0]))];
    const count = Number(timeText.match(/每日(\d+)場/)?.[1] ?? 0);
    if (!times.length || times.length !== count) throw new Error(`海生館「${title}」場次數與時間不符`);
    const durationMinutes = Number(durationText.match(/(\d+)\s*分/)?.[1] ?? 0) || null;
    if (durationMinutes !== null && durationMinutes > 240) throw new Error('海生館節目長度異常');
    const sourceKey = `${title}|${venue}`;
    if (results.some((result) => result.sourceKey === sourceKey)) throw new Error('海生館節目來源鍵重複');
    results.push({ sourceId: 'nmmba', sourceKey, domain: 'marine', title, venue,
      sourceUrl: nmmbaProgrammeUrl, ticketUrl: null,
      priceNote: /收費/.test(title) ? '館方標示收費；金額請依官方頁確認' : null,
      observedOn, recurrence: 'daily',
      times: times.map((localTime) => ({ localTime, durationMinutes, venue })) });
  }
  if (!results.length) throw new Error('海生館沒有可核對的每日節目');
  return results;
}
