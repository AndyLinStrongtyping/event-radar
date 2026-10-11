const origin = 'https://www.chimeimuseum.org';

export type ChimeiActivity = {
  id: string;
  title: string;
  dateText: string;
  type: string | null;
  sourceUrl: string;
};

export type ChimeiActivitySnapshot = {
  checkedAt: string;
  sourceUrl: string;
  items: ChimeiActivity[];
};

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max * 4) return '';
  return value.replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\r/g, '')
    .split('\n').map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean).join('\n').slice(0, max);
}

/** The museum's event/programme list is separate from its time-limited exhibitions. */
export function classifyChimeiActivities(payload: unknown, checkedAt: string): ChimeiActivitySnapshot {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('奇美活動回應格式錯誤');
  const items = (payload as { expoEvent?: unknown }).expoEvent;
  if (!Array.isArray(items) || items.length === 0 || items.length > 200) throw new Error('奇美活動清單為空或數量異常');
  if (Number.isNaN(Date.parse(checkedAt))) throw new Error('核對時間無效');
  const seen = new Set<string>();
  const result: ChimeiActivity[] = items.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('奇美活動紀錄格式錯誤');
    const item = value as Record<string, unknown>;
    const id = typeof item.id === 'number' && Number.isSafeInteger(item.id) ? String(item.id)
      : typeof item.id === 'string' ? item.id.trim() : '';
    const title = cleanText(item.title, 180);
    const dateText = cleanText(item.date, 500);
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) || seen.has(id)) throw new Error('奇美活動 ID 缺失或重複');
    if (!title) throw new Error('奇美活動缺少標題');
    if (typeof item.link !== 'string') throw new Error('奇美活動缺少官方連結');
    const url = new URL(item.link, origin);
    if (url.origin !== origin || url.username || url.password
      || !/^\/event\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)) throw new Error('奇美活動連結不是官方詳情頁');
    url.search = '';
    url.hash = '';
    seen.add(id);
    return { id, title, dateText: dateText || '活動時間請查看官網',
      type: cleanText(item.type, 80) || cleanText(item.tag, 80) || null,
      sourceUrl: url.href };
  });
  return { checkedAt, sourceUrl: `${origin}/exhibition-event`, items: result };
}
