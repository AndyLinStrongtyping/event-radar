import { fetchNmnsApi } from './nmns-api.ts';

export type VisitStatus = {
  museumId: string;
  date: string;
  status: 'open' | 'closed' | 'unknown';
  message: string;
  sourceUrl: string;
  newsUrl?: string;
  checkedAt?: string;
};

const links: Record<string, string> = {
  chimei: 'https://www.chimeimuseum.org/visit/calendar',
  nmns: 'https://www.nmns.edu.tw/ch/visit/hours/',
  'npm-south': 'https://south.npm.gov.tw/',
  'npm-north': 'https://www.npm.gov.tw/',
  nmmba: 'https://www.nmmba.gov.tw/',
  nstm: 'https://www.nstm.gov.tw/',
  ntm: 'https://www.ntm.gov.tw/',
  nmth: 'https://www.nmth.gov.tw/',
  ntsec: 'https://www.ntsec.gov.tw/',
};
const hoursCache = new Map<string, { payload: unknown; expires: number }>();

export function validVisitDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function parseNmnsHours(payload: unknown, date: string): { status: 'open' | 'closed'; message: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('科博館行事曆格式錯誤');
  const feed = payload as { success?: unknown; dates?: unknown };
  if (feed.success !== true || !Array.isArray(feed.dates)) throw new Error('科博館行事曆缺少 dates');
  const day = feed.dates.find((item) => item && typeof item === 'object' &&
    (item as { date?: unknown }).date === date.replaceAll('-', '/')) as Record<string, unknown> | undefined;
  if (!day || typeof day.holiday !== 'boolean') throw new Error('科博館行事曆未提供指定日期');
  if (day.holiday) return { status: 'closed', message: '科博館行事曆標示這天休館。出發前請再次查看官方公告。' };
  const hours = typeof day.startHour === 'string' && typeof day.endHour === 'string'
    && /^\d{2}:\d{2}$/.test(day.startHour) && /^\d{2}:\d{2}$/.test(day.endHour)
    ? `（${day.startHour}–${day.endHour}）` : '';
  return { status: 'open', message: `科博館行事曆標示這天開館${hours}。展廳與特展仍請以館方公告為準。` };
}

export async function visitStatus(museumId: string, date: string,
  now = new Date()): Promise<VisitStatus> {
  if (!links[museumId] || !validVisitDate(date)) throw new Error('館所或日期無效');
  const base: VisitStatus = { museumId, date, status: 'unknown',
    message: '目前沒有可驗證的逐日開放資料；出發前請查看館方資訊。', sourceUrl: links[museumId] };
  if (museumId === 'chimei') {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { ...base, status: weekday === 3 ? 'closed' : 'unknown',
      message: weekday === 3
        ? '奇美博物館公布週三休館；其他臨時異動請再看全年行事曆與最新消息。'
        : '奇美博物館公布開館時間 9:30–17:30，週三及除夕休館；這天是否有臨時異動，請查看全年行事曆與最新消息。',
      newsUrl: 'https://www.chimeimuseum.org/news/5fd2eee2256ee' };
  }
  if (museumId !== 'nmns' || !process.env.NMNS_API_KEY) return base;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(now);
  const days = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  if (days < 0 || days > 6) return { ...base,
    message: '科博館 API 僅提供未來一週開放時間；此日期請查館方行事曆。' };
  try {
    const cached = hoursCache.get(today);
    const payload = cached && cached.expires > Date.now() ? cached.payload
      : await fetchNmnsApi('Calendar/weekHours', {
        calendarCode: 'nmns', date: today.replaceAll('-', '/'),
      });
    const result = parseNmnsHours(payload, date);
    if (!cached || cached.expires <= Date.now()) {
      hoursCache.set(today, { payload, expires: Date.now() + 60 * 60 * 1000 });
    }
    return { ...base, ...result, checkedAt: new Date().toISOString() };
  } catch {
    return { ...base, message: '科博館行事曆目前無法核對；出發前請查看館方公告。' };
  }
}
