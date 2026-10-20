import process from 'node:process';
import { checkNpmNorthKnownCoverage, classifyNpmNorthFeed, npmNorthDataUrl } from './sources/npm-north.ts';

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

try {
  const response = await fetch(npmNorthDataUrl, {
    headers: { 'User-Agent': 'EventRadar/0.1 (+https://github.com/AndyLinStrongtyping)', Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok || new URL(response.url).hostname !== 'odapi.npm.gov.tw') {
    throw new Error(`官方 JSON 回應異常：HTTP ${response.status}`);
  }
  if (Number(response.headers.get('content-length')) > 10_000_000) throw new Error('來源回應過大');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 10_000_000) throw new Error('來源回應過大');
  const batch = classifyNpmNorthFeed(JSON.parse(new TextDecoder().decode(bytes)), today);
  const counts = { ready: batch.rows.length,
    review: batch.records.filter((record) => record.status === 'review').length,
    ignored: batch.records.filter((record) => record.status === 'ignored').length };
  const gaps = checkNpmNorthKnownCoverage(batch.rows, today);
  console.log(JSON.stringify({ date: today, source: npmNorthDataUrl, httpStatus: response.status,
    sourceRecords: batch.records.length, ...counts, knownCoverage: gaps.length ? 'incomplete' : 'matched', gaps }, null, 2));
  if (gaps.length) process.exitCode = 1;
} catch (error) {
  const cause = error instanceof Error ? error.cause : null;
  const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : null;
  console.error(`故宮北院唯讀診斷失敗：${typeof code === 'string' ? code : error instanceof Error ? error.name : 'UNKNOWN'}`);
  process.exitCode = 1;
}
