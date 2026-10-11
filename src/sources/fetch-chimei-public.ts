import { robotsAllowPath } from './chimei.ts';

const origin = 'https://www.chimeimuseum.org';
const userAgent = 'EventRadarMonitor/0.1 (+https://github.com/AndyLinStrongtyping)';
const maxBytes = 2_000_000;

async function readLimited(response: Response, expectedType: string): Promise<string> {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (new URL(response.url).origin !== origin) throw new Error('來源重新導向到其他網域');
  if (!(response.headers.get('content-type') || '').includes(expectedType)) {
    throw new Error(`內容型別不是 ${expectedType}`);
  }
  const length = Number(response.headers.get('content-length'));
  if (length > maxBytes) throw new Error('回應過大');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error('回應過大');
  return new TextDecoder().decode(bytes);
}

/** Only the anonymous flow used by the museum's public listing page. Never persist tokens or cookies. */
export async function fetchChimeiPublicPayload(): Promise<unknown> {
  const common = { 'User-Agent': userAgent };
  const robots = await readLimited(await fetch(`${origin}/robots.txt`, {
    headers: { ...common, Accept: 'text/plain' }, signal: AbortSignal.timeout(15_000),
  }), 'text/plain');
  if (!robotsAllowPath(robots, '/exhibition-event') || !robotsAllowPath(robots, '/exhibition-event/api')) {
    throw new Error('robots.txt 不允許候選來源路徑');
  }
  const page = await fetch(`${origin}/exhibition-event`, {
    headers: { ...common, Accept: 'text/html' }, signal: AbortSignal.timeout(15_000),
  });
  const html = await readLimited(page, 'text/html');
  const csrf = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/i)?.[1];
  if (!csrf) throw new Error('公開頁缺少 CSRF meta');
  const cookies = page.headers.getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .filter((value) => /^(XSRF-TOKEN|chimeimuseum_session)=/i.test(value));
  if (cookies.length !== 2) throw new Error('公開頁匿名 session cookie 格式變更');
  const response = await fetch(`${origin}/exhibition-event/api`, {
    method: 'POST',
    headers: {
      ...common, Accept: 'application/json', 'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf, Cookie: cookies.join('; '),
    },
    body: JSON.stringify({ date: '', tags: '' }),
    signal: AbortSignal.timeout(15_000),
  });
  return JSON.parse(await readLimited(response, 'application/json')) as unknown;
}
