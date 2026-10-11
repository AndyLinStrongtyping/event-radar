import { robotsAllowPath } from './sources/chimei.ts';

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

function records(value: unknown, group: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${group} 不是陣列`);
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${group} 項目格式錯誤`);
    return item as Record<string, unknown>;
  });
}

async function main(): Promise<void> {
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
  const body = await readLimited(response, 'application/json');
  const parsed: unknown = JSON.parse(body);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('頂層 JSON 格式錯誤');
  const payload = parsed as Record<string, unknown>;
  const counts: Record<string, number> = {};
  const fields: Record<string, string[]> = {};
  const seen = new Set<string>();
  let usableSpecialDates = 0;
  for (const group of ['specialEvent', 'permanentEvent', 'expoEvent']) {
    const items = records(payload[group], group);
    counts[group] = items.length;
    fields[group] = [...new Set(items.flatMap((item) => Object.keys(item)))].sort();
    for (const item of items) {
      if (typeof item.title !== 'string' || !item.title.trim()) throw new Error(`${group} 缺少標題`);
      if (typeof item.link !== 'string') throw new Error(`${group} 缺少連結`);
      const link = new URL(item.link);
      if (link.origin !== origin) throw new Error(`${group} 連結不是奇美官網`);
      const key = group === 'permanentEvent' ? link.href : String(item.id ?? '');
      if (!key || seen.has(`${group}:${key}`)) throw new Error(`${group} 來源身份缺失或重複`);
      seen.add(`${group}:${key}`);
      if (group === 'specialEvent' && typeof item.date === 'string'
        && /^\d{4}[./]\d{2}[./]\d{2}\s*-\s*\d{4}[./]\d{2}[./]\d{2}$/.test(item.date.trim())) {
        usableSpecialDates += 1;
      }
    }
  }
  if (Object.values(counts).every((count) => count === 0)) throw new Error('三組資料皆為空');
  process.stdout.write(`${JSON.stringify({ checkedAt: new Date().toISOString(), status: 'candidate_probe_ok',
    counts, fields, usableSpecialDates, note: '只讀契約檢查；不代表授權、完整性或跨日穩定性' })}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`奇美候選來源檢查失敗：${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
