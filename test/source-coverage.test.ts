import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSuspiciousDrop } from '../src/source-coverage.ts';

test('large official list drops require manual source review before missing detection', () => {
  assert.equal(isSuspiciousDrop(6, 2), true);
  assert.equal(isSuspiciousDrop(4, 2), true);
  assert.equal(isSuspiciousDrop(6, 5), false);
  assert.equal(isSuspiciousDrop(3, 1), false);
});
