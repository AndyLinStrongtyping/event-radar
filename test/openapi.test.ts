import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';

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
