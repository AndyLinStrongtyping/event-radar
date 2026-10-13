export const nttListUrl = 'https://www.npac-ntt.org/program/events?place=1';
export type PerformanceSession = { sessionKey: string; startsAt: string; hall: string | null;
  ticketUrl: string | null; priceMin: number | null; priceMax: number | null;
  status: 'scheduled' | 'sold_out' | 'cancelled' | 'postponed' | 'unknown' };
export type PerformanceEvent = { sourceId: 'ntt'; sourceKey: string; domain: 'performance';
  title: string; venue: string | null; sourceUrl: string; ticketUrl: string | null;
  priceNote: string | null; observedOn: null; sessions: PerformanceSession[] };

function plain(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ').trim();
}

function nttUrl(raw: string): URL {
  const url = new URL(raw, 'https://www.npac-ntt.org');
  if (url.protocol !== 'https:' || url.hostname !== 'www.npac-ntt.org'
    || !/^\/program\/events\/c-[a-zA-Z0-9_-]{8,24}$/.test(url.pathname)
    || url.username || url.password || url.search || url.hash) throw new Error('非歌劇院官方節目詳情網址');
  return url;
}

export function nttDetailUrls(listHtml: string, max = 30): string[] {
  if (!Number.isInteger(max) || max < 1 || max > 30) throw new Error('歌劇院清單上限無效');
  const urls = new Set<string>();
  for (const match of listHtml.matchAll(/<a\b[^>]*class="[^"]*img-link[^"]*"[^>]*href="([^"]+)"/gi)) {
    try { urls.add(nttUrl(match[1]).href); } catch { /* Other cards do not enter this source. */ }
    if (urls.size > max) throw new Error('歌劇院初始清單超過安全上限，停止匯入並檢查分頁');
  }
  if (!urls.size) throw new Error('歌劇院節目清單沒有可辨識詳情網址');
  return [...urls];
}

function validDate(year: string, month: string, day: string): string {
  const date = `${year}-${month}-${day}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`歌劇院場次日期無效：${date}`);
  }
  return date;
}

export function parseNttDetail(html: string, rawUrl: string): PerformanceEvent {
  const url = nttUrl(rawUrl);
  const title = plain(html.match(/<input\b[^>]*id="txtSubject"[^>]*value="([^"]+)"/i)?.[1] ?? '');
  if (!title || title.length > 240) throw new Error('歌劇院詳情缺少可核對標題');
  if (/取消(?:演出|節目)|延期|異動公告/.test(title)) throw new Error('歌劇院異動公告須逐場人工核對');
  const hall = plain(html.match(/<div\b[^>]*class="post-place"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '') || null;
  const timeBlock = html.match(/<div\b[^>]*class="event-time"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  const ticketRaw = html.match(/<a\b[^>]*class="[^"]*btn-buy-ticket[^"]*"[^>]*href="([^"]+)"/i)?.[1];
  let ticketUrl: string | null = null;
  if (ticketRaw) {
    const ticket = new URL(ticketRaw);
    if (ticket.protocol !== 'https:' || ticket.username || ticket.password) throw new Error('歌劇院購票網址無效');
    ticketUrl = ticket.href;
  }
  const priceBlock = html.match(/<div class="info-title">票價<\/div>\s*<div class="info-cont">([\s\S]*?)<\/div>/i)?.[1] ?? '';
  const priceNote = plain(priceBlock).slice(0, 500) || null;
  const simplePrices = priceNote && !/平日場|假日場|優惠|折扣/.test(priceNote)
    ? [...priceNote.matchAll(/\b\d{2,6}\b/g)].map((match) => Number(match[0])) : [];
  const priceMin = simplePrices.length ? Math.min(...simplePrices) : null;
  const priceMax = simplePrices.length ? Math.max(...simplePrices) : null;
  const sessions: PerformanceSession[] = [];
  for (const match of timeBlock.matchAll(/<span>\s*(\d{4})\/(\d{2})\/(\d{2})\s*<b>[^<]*<\/b>\s*(\d{2}):(\d{2})\s*<\/span>/gi)) {
    const day = validDate(match[1], match[2], match[3]);
    const hh = Number(match[4]);
    const mm = Number(match[5]);
    if (hh > 23 || mm > 59) throw new Error('歌劇院場次時間無效');
    const sessionKey = `${day}T${match[4]}:${match[5]}+08:00`;
    if (sessions.some((session) => session.sessionKey === sessionKey)) throw new Error('歌劇院場次重複');
    sessions.push({ sessionKey, startsAt: sessionKey, hall, ticketUrl,
      priceMin, priceMax, status: 'scheduled' });
  }
  if (!sessions.length) throw new Error('歌劇院詳情沒有完整年份與時間的場次');
  return { sourceId: 'ntt', sourceKey: url.pathname.split('/').at(-1)!, domain: 'performance',
    title, venue: hall, sourceUrl: url.href, ticketUrl, priceNote, observedOn: null, sessions };
}
