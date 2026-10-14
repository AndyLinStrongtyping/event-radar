import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { importDomainEvents } from './domain-events.ts';
import { nttListUrl, nttDetailUrls, parseNttDetail } from './sources/ntt-events.ts';
import { nmmbaProgrammeUrl, parseNmmbaProgrammes } from './sources/nmmba-programmes.ts';
import { fetchOfficialHtml } from './sources/official-html.ts';

const source = process.argv[process.argv.indexOf('--source') + 1];
const snapshot = process.argv.includes('--snapshot')
  ? process.argv[process.argv.indexOf('--snapshot') + 1] : null;
const detail = process.argv.includes('--detail')
  ? process.argv[process.argv.indexOf('--detail') + 1] : null;
const shrinkReviewNote = process.argv.includes('--review-shrink')
  ? process.argv[process.argv.indexOf('--review-shrink') + 1] : null;

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('需要 DATABASE_URL');
  if (!['ntt','nmmba'].includes(source)) throw new Error('用法：npm run sync:domain -- --source ntt|nmmba');
  if (process.argv.includes('--review-shrink')
    && (!shrinkReviewNote || shrinkReviewNote.startsWith('--'))) {
    throw new Error('--review-shrink 需要具體的人工核對說明');
  }
  if (shrinkReviewNote !== null && (source !== 'ntt' || snapshot || detail)) {
    throw new Error('--review-shrink 只可用於歌劇院官方 place=1 清單同步');
  }
  let checkedAt = new Date().toISOString();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(new Date());
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (source === 'ntt') {
      let details: { url: string; html: string }[];
      let coverage = '人工提供的歌劇院詳情或快照；不代表完整清單';
      if (snapshot) {
        const input = JSON.parse(await readFile(snapshot,'utf8')) as { checkedAt?: string; details?: { url: string; html: string }[] };
        if (!Array.isArray(input.details) || !input.details.length) throw new Error('歌劇院快照缺詳情');
        if (!input.checkedAt || Number.isNaN(Date.parse(input.checkedAt))) throw new Error('歌劇院快照缺核對時間');
        checkedAt = input.checkedAt;
        details = input.details;
      } else if (detail) details = [{ url: detail, html: await fetchOfficialHtml(detail,'www.npac-ntt.org') }];
      else {
        const urls = nttDetailUrls(await fetchOfficialHtml(nttListUrl,'www.npac-ntt.org'));
        details = [];
        coverage = `官方清單 HTML ${urls.length} 筆（含 MORE 預藏卡片）；僅限 place=1 篩選結果`;
        for (const url of urls) {
          if (details.length) await new Promise((resolve) => setTimeout(resolve, 2_000));
          details.push({ url, html: await fetchOfficialHtml(url,'www.npac-ntt.org') });
        }
      }
      const rows = details.map(({url,html}) => parseNttDetail(html,url));
      const scope = detail || (snapshot && details.length === 1) ? 'single_detail'
        : snapshot ? 'sampled_list' : 'ntt_place1_list';
      const counts = await importDomainEvents(pool,rows,scope,checkedAt,
        shrinkReviewNote === null ? {} : { shrinkReviewNote });
      process.stdout.write(JSON.stringify({ source,scope,
        accepted:rows.length,...counts,coverage })+'\n');
    } else {
      const input = snapshot ? JSON.parse(await readFile(snapshot,'utf8')) as { html?: string; observedOn?: string; checkedAt?: string } : null;
      if (input && (!input.checkedAt || Number.isNaN(Date.parse(input.checkedAt)))) throw new Error('海生館快照缺核對時間');
      if (input) checkedAt = input.checkedAt!;
      const html = input?.html ?? await fetchOfficialHtml(nmmbaProgrammeUrl,'www.nmmba.gov.tw');
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
