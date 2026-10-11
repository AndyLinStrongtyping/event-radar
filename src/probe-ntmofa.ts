import { classifyNtmofaPages, ntmofaPages } from './sources/ntmofa.ts';

async function official(url: string, host: string): Promise<string> {
  const response = await fetch(url, { headers: {
    'User-Agent': 'EventRadar/0.1 (+https://github.com/AndyLinStrongtyping)',
    Accept: 'text/html',
  }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok || new URL(response.url).hostname !== host) throw new Error(`官方來源無法核對：${url}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 10_000_000) throw new Error('來源頁過大');
  return new TextDecoder().decode(bytes);
}

const pages = [];
for (const url of ntmofaPages) pages.push(await official(url, 'www.ntmofa.gov.tw'));
const result = await classifyNtmofaPages(pages, (url) => official(url, 'event.culture.tw'));
process.stdout.write(`${JSON.stringify({ sourceCount: result.records.length,
  ready: result.rows.map((row) => ({ title: row.title, sourceKey: row.sourceKey,
    venue: row.venue, dates: [row.startDate, row.endDate], art: row.art })),
  review: result.records.filter((record) => record.status === 'review')
    .map((record) => ({ sourceKey: record.sourceKey, reason: record.reason })),
  ignoredCount: result.records.filter((record) => record.status === 'ignored').length }, null, 2)}\n`);
