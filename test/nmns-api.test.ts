import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchNmnsApi } from '../src/nmns-api.ts';
import { isTransientSyncFailure } from '../src/retry-policy.ts';

test('科博館網路與回應中斷可重試，授權及資料格式錯誤不可重試且不洩漏金鑰', async () => {
  const previousKey = process.env.NMNS_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.NMNS_API_KEY = 'private-test-key';
  try {
    for (const [failure, retry] of [
      ['network', true], ['body', true], ['503', true], ['429', true], ['403', false], ['json', false],
    ] as const) {
      globalThis.fetch = (async () => {
        if (failure === 'network') throw new Error('https://www.nmns.edu.tw/?key=private-test-key');
        return {
          url: 'https://www.nmns.edu.tw/backend/opendata/Exhibition/list',
          ok: failure === 'body' || failure === 'json', status: Number(failure) || 200,
          arrayBuffer: async () => {
            if (failure === 'body') throw new Error('private-test-key');
            return new TextEncoder().encode('invalid-json').buffer;
          },
        } as Response;
      }) as typeof fetch;
      await assert.rejects(fetchNmnsApi('Exhibition/list'), (error: Error) => {
        assert.equal(isTransientSyncFailure(error.message), retry, failure);
        assert.doesNotMatch(error.message, /private-test-key|https:/);
        return true;
      });
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.NMNS_API_KEY;
    else process.env.NMNS_API_KEY = previousKey;
  }
});
