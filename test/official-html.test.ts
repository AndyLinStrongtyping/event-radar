import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchOfficialHtml } from '../src/sources/official-html.ts';

const url = 'https://www.npac-ntt.org/program/events/c-tv0mE3YHxoF';
const host = 'www.npac-ntt.org';
const htmlResponse = (status: number, body = '<h1>官方節目</h1>') => ({
  ok: status >= 200 && status < 300, status, url, text: async () => body,
}) as Response;

test('官方詳情暫時逾時只重試有限次，成功後保留原文', async () => {
  let calls = 0;
  const delays: number[] = [];
  const fetcher = (async () => {
    calls++;
    if (calls === 1) throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    return htmlResponse(200);
  }) as typeof fetch;
  const html = await fetchOfficialHtml(url, host, { fetcher,
    wait: async (delay) => { delays.push(delay); } });
  assert.equal(html, '<h1>官方節目</h1>');
  assert.equal(calls, 2);
  assert.deepEqual(delays, [2_000]);
});

test('官方來源 5xx 有上限退避，耗盡後指出失敗網址', async () => {
  let calls = 0;
  const delays: number[] = [];
  const fetcher = (async () => { calls++; return htmlResponse(503); }) as typeof fetch;
  await assert.rejects(fetchOfficialHtml(url, host, { fetcher,
    wait: async (delay) => { delays.push(delay); } }),
  (error: unknown) => error instanceof Error && error.message.includes(url)
    && error.message.includes('HTTP 503'));
  assert.equal(calls, 3);
  assert.deepEqual(delays, [2_000, 8_000]);
});

test('4xx、限流與非官方網址不重試', async () => {
  for (const status of [404, 429]) {
    let calls = 0;
    const fetcher = (async () => { calls++; return htmlResponse(status); }) as typeof fetch;
    await assert.rejects(fetchOfficialHtml(url, host, { fetcher,
      wait: async () => { throw new Error('不得重試'); } }), new RegExp(`HTTP ${status}`));
    assert.equal(calls, 1);
  }
  await assert.rejects(fetchOfficialHtml('https://example.com/fake', host), /預期館方/);
});
