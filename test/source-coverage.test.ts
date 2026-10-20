import assert from 'node:assert/strict';
import test from 'node:test';
import type pg from 'pg';
import { assessOfficialSourceCoverage, isSuspiciousDrop, isSuspiciousReplacement } from '../src/source-coverage.ts';
import type { ExhibitionDraft } from '../src/normalize.ts';

test('large official list drops require manual source review before missing detection', () => {
  assert.equal(isSuspiciousDrop(6, 2), true);
  assert.equal(isSuspiciousDrop(4, 2), true);
  assert.equal(isSuspiciousDrop(6, 5), false);
  assert.equal(isSuspiciousDrop(3, 1), true);
  assert.equal(isSuspiciousDrop(3, 2), false);
  assert.equal(isSuspiciousDrop(2, 1), true);
  assert.equal(isSuspiciousDrop(1, 0), false);
});

test('same-size official lists with mostly different identities require review', () => {
  const previous = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.equal(isSuspiciousReplacement(previous, ['a', 'x', 'y', 'z', 'q', 'r']), true);
  assert.equal(isSuspiciousReplacement(previous, ['a', 'b', 'c', 'x', 'y', 'z']), false);
  assert.equal(isSuspiciousReplacement(previous, previous), false);
  assert.equal(isSuspiciousReplacement(['a', 'b', 'c'], ['x', 'y', 'z']), false);
});

function coverageClient(previous: { identity_count: number; row_count: number;
  identity_keys: string[] | null } | null) {
  const writes: string[] = [];
  const client = { query: async (sql: string) => {
    if (sql.includes('SELECT identity_count,row_count,identity_keys')) {
      return { rowCount: previous ? 1 : 0, rows: previous ? [previous] : [] };
    }
    writes.push(sql);
    return { rowCount: 1, rows: [] };
  } } as unknown as pg.PoolClient;
  return { client, writes };
}

const rows = [{ sourceKey: '04014505' }] as ExhibitionDraft[];

test('已知漏展時保留合格資料，但不建立官方完整度基準', async () => {
  const { client, writes } = coverageClient(null);
  const result = await assessOfficialSourceCoverage(client, 'npm-north', 'npm-north', 'run-1', rows, [], true);
  assert.equal(result.status, 'deferred_partial');
  assert.equal(result.rowCount, 1);
  assert.deepEqual(writes, []);
});

test('已知漏展時不覆寫先前的完整度基準', async () => {
  const { client, writes } = coverageClient({ identity_count: 22, row_count: 1,
    identity_keys: ['04014505'] });
  const result = await assessOfficialSourceCoverage(client, 'npm-north', 'npm-north', 'run-2', rows, [], true);
  assert.equal(result.status, 'deferred_partial');
  assert.equal(result.baselineCount, 22);
  assert.deepEqual(writes, []);
});
