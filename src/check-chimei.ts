import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { chimeiDetailMatches, extractChimeiExhibitionLinks, robotsAllowPath } from './sources/chimei.ts';

const listingUrl = 'https://www.chimeimuseum.org/exhibition-event';
const robotsUrl = 'https://www.chimeimuseum.org/robots.txt';
const userAgent = 'EventRadarMonitor/0.1 (+https://github.com/AndyLinStrongtyping)';

async function fetchText(url: string, type: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent, Accept: type },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  if (new URL(response.url).hostname !== 'www.chimeimuseum.org') throw new Error('來源重新導向到其他網域');
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes(type)) throw new Error(`${url}: 內容型別不是 ${type}`);
  if (Number(response.headers.get('content-length')) > 2_000_000) throw new Error(`${url}: 回應過大`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 2_000_000) throw new Error(`${url}: 回應過大`);
  return new TextDecoder().decode(bytes);
}

async function main(): Promise<void> {
  const fileIndex = process.argv.indexOf('--file');
  const robots = fileIndex < 0 ? await fetchText(robotsUrl, 'text/plain') : '';
  if (fileIndex < 0 && !robotsAllowPath(robots, '/exhibition-event')) {
    throw new Error('robots.txt 禁止讀取特展頁');
  }
  const html = fileIndex < 0
    ? await fetchText(listingUrl, 'text/html')
    : await readFile(process.argv[fileIndex + 1], 'utf8');
  const known = JSON.parse(await readFile(new URL('../data/chimei-known-links.json', import.meta.url), 'utf8')) as string[];
  if (!Array.isArray(known) || known.some((url) => typeof url !== 'string')) throw new Error('已知連結清單格式錯誤');
  const details = JSON.parse(await readFile(new URL('../data/chimei-known-details.json', import.meta.url), 'utf8')) as Array<{
    url: string; title: string; startDate: string; endDate: string;
  }>;
  if (!Array.isArray(details) || details.some((item) => !item || typeof item.url !== 'string'
    || typeof item.title !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.startDate)
    || !/^\d{4}-\d{2}-\d{2}$/.test(item.endDate) || !known.includes(item.url))) {
    throw new Error('已知特展詳情清單格式錯誤');
  }
  const links = extractChimeiExhibitionLinks(html);
  if (links.length === 0) throw new Error('官方頁未找到個別特展連結；需人工檢查頁面格式');
  const discovered = links.filter((link) => !known.includes(link));
  const missing = known.filter((link) => !links.includes(link));
  const changedDetails: string[] = [];
  if (fileIndex < 0) {
    for (const item of details) {
      const url = new URL(item.url);
      if (url.protocol !== 'https:' || url.hostname !== 'www.chimeimuseum.org'
        || !/^\/special-exhibition\/[^/]+\/[^/]+$/.test(url.pathname)) {
        throw new Error('已知特展詳情網址無效');
      }
      if (!robotsAllowPath(robots, url.pathname)) throw new Error('robots.txt 禁止讀取特展詳情頁');
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const detailHtml = await fetchText(url.href, 'text/html');
      if (!chimeiDetailMatches(detailHtml, item.title, item.startDate, item.endDate)) changedDetails.push(url.href);
    }
  }
  process.stdout.write(`${JSON.stringify({ checkedAt: new Date().toISOString(), page: listingUrl,
    coverage: '只檢查初始 HTML 可見連結及已知特展詳情；不代表完整自動同步',
    visibleLinks: links, newLinks: discovered, missingLinks: missing,
    checkedDetails: fileIndex < 0 ? details.length : 0, changedDetails }, null, 2)}\n`);
  if (discovered.length || missing.length || changedDetails.length) {
    process.stderr.write('奇美可見特展連結或已知展期有變化，請到館方頁人工核對；資料庫未修改。\n');
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
