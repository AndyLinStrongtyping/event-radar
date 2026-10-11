import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseDocument } from 'yaml';

const require = createRequire(import.meta.url);
const { assertOpenApiResponse } = require('./openapi-response-validator.cjs');

test('OpenAPI 文件可解析，公開路由與所有引用存在', () => {
  const source = readFileSync(new URL('../docs/openapi.yaml', import.meta.url), 'utf8');
  const document = parseDocument(source, { uniqueKeys: true });
  assert.deepEqual(document.errors, []);
  const api = document.toJS() as Record<string, unknown>;
  assert.equal(api.openapi, '3.0.3');
  const paths = api.paths as Record<string, unknown>;
  assert.deepEqual(Object.keys(paths).sort(), [
    '/health', '/museums', '/visit-status', '/exhibitions',
    '/exhibitions/{id}', '/exhibitions/{id}/changes',
  ].sort());
  function checkRefs(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(checkRefs); return; }
    const fields = value as Record<string, unknown>;
    if (typeof fields.$ref === 'string') {
      assert.ok(fields.$ref.startsWith('#/components/'));
      const path = fields.$ref.slice(2).split('/');
      let current: unknown = api;
      for (const key of path) current = (current as Record<string, unknown>)?.[key];
      assert.ok(current, `找不到 ${fields.$ref}`);
    }
    Object.values(fields).forEach(checkRefs);
  }
  checkRefs(api);
});

test('OpenAPI 回應驗證能抓出 enum 與巢狀票務格式錯誤', () => {
  assertOpenApiResponse('/health', 200, { status: 'ok', database: 'ok' });
  assert.throws(() => assertOpenApiResponse('/health', 200,
    { status: 'ok', database: 'offline' }), /database.*enum/);
  const museum = {
    id: 'chimei', name: '奇美博物館', city: '臺南市', homepageUrl: 'https://www.chimeimuseum.org/',
    sourceStatus: 'curated', lastSuccessAt: null, lastOfficialSuccessAt: null,
    lastAttemptStatus: null, lastAttemptAt: null, coverageStatus: null,
    pendingReviewCount: 0, dataStatus: 'manual', generalAdmission: null,
  };
  assertOpenApiResponse('/museums', 200, { items: [museum] });
  const price = { label: '一般票', price: '以官網為準', infoUrl: 'https://www.chimeimuseum.org/',
    purchaseUrl: 42, checkedOn: '2026-10-11', note: '測試' };
  assert.throws(() => assertOpenApiResponse('/museums', 200,
    { items: [{ ...museum, generalAdmission: price }] }),
  /generalAdmission\.purchaseUrl.*string/);
  assert.throws(() => assertOpenApiResponse('/museums', 200,
    { items: [{ ...museum, dataStatus: undefined }] }), /dataStatus.*enum/);
});
