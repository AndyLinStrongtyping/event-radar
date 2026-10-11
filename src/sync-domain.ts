import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { importDomainEvents } from './domain-events.ts';
import { nttListUrl, nttDetailUrls, parseNttDetail } from './sources/ntt-events.ts';
import { nmmbaProgrammeUrl, parseNmmbaProgrammes } from './sources/nmmba-programmes.ts';

const source = process.argv[process.argv.indexOf('--source') + 1];
const snapshot = process.argv.includes('--snapshot')
  ? process.argv[process.argv.indexOf('--snapshot') + 1] : null;
const detail = process.argv.includes('--detail')
  ? process.argv[process.argv.indexOf('--detail') + 1] : null;

async function officialHtml(url: string, hostname: string): Promise<string> {
  const requested = new URL(url);
  if (requested.protocol !== 'https:' || requested.hostname !== hostname
    || requested.username || requested.password) throw new Error('來源網址不是預期館方 HTTPS 主機');
  const response = await fetch(url, { headers: { 'User-Agent': 'EventRadar/0.1 (+https://github.com/AndyLinStrongtyping)',
    Accept: 'text/html' }, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  if (!response.ok || new URL(response.url).hostname !== hostname) throw new Error(`官方網頁無法安全取得：${url}`);
  const html = await response.text();
  if (html.length > 2_000_000) throw new Error('官方網頁超過大小限制');
  return html;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('需要 DATABASE_URL');
  if (!['ntt','nmmba'].includes(source)) throw new Error('用法：npm run sync:domain -- --source ntt|nmmba');
  let checkedAt = new Date().toISOString();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(new Date());
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (source === 'ntt') {
      let details: { url: string; html: string }[];
      if (snapshot) {
        const input = JSON.parse(await readFile(snapshot,'utf8')) as { checkedAt?: string; details?: { url: string; html: string }[] };
        if (!Array.isArray(input.details) || !input.details.length) throw new Error('歌劇院快照缺詳情');
        if (!input.checkedAt || Number.isNaN(Date.parse(input.checkedAt))) throw new Error('歌劇院快照缺核對時間');
        checkedAt = input.checkedAt;
        details = input.details;
      } else if (detail) details = [{ url: detail, html: await officialHtml(detail,'www.npac-ntt.org') }];
      else {
        const urls = nttDetailUrls(await officialHtml(nttListUrl,'www.npac-ntt.org'));
        details = [];
        for (const url of urls) details.push({ url, html: await officialHtml(url,'www.npac-ntt.org') });
      }
      const rows = details.map(({url,html}) => parseNttDetail(html,url));
      const scope = detail || (snapshot && details.length === 1) ? 'single_detail' : 'sampled_list';
      const counts = await importDomainEvents(pool,rows,scope,checkedAt);
      process.stdout.write(JSON.stringify({ source,scope,
        accepted:rows.length,...counts,coverage:'僅官方首頁樣本；未處理 MORE 分頁或全站清單' })+'\n');
    } else {
      const input = snapshot ? JSON.parse(await readFile(snapshot,'utf8')) as { html?: string; observedOn?: string; checkedAt?: string } : null;
      if (input && (!input.checkedAt || Number.isNaN(Date.parse(input.checkedAt)))) throw new Error('海生館快照缺核對時間');
      if (input) checkedAt = input.checkedAt!;
      const html = input?.html ?? await officialHtml(nmmbaProgrammeUrl,'www.nmmba.gov.tw');
      const observedOn = input?.observedOn ?? today;
      const rows = parseNmmbaProgrammes(html,observedOn);
      const counts = await importDomainEvents(pool,rows,'daily_page',checkedAt);
      process.stdout.write(JSON.stringify({ source,scope:'daily_page',accepted:rows.length,...counts,
        observedOn,coverage:'僅當日官網節目表；未推定未來日期或特殊開館' })+'\n');
    }
  } finally { await pool.end(); }
}

main().catch((error: unknown) => {
  process.stderr.write(`活動同步失敗：${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
