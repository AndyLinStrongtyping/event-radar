import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSuspiciousDrop, isSuspiciousReplacement } from '../src/source-coverage.ts';

test('large official list drops require manual source review before missing detection', () => {
  assert.equal(isSuspiciousDrop(6, 2), true);
  assert.equal(isSuspiciousDrop(4, 2), true);
  assert.equal(isSuspiciousDrop(6, 5), false);
  assert.equal(isSuspiciousDrop(3, 1), false);
});

test('same-size official lists with mostly different identities require review', () => {
  const previous = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.equal(isSuspiciousReplacement(previous, ['a', 'x', 'y', 'z', 'q', 'r']), true);
  assert.equal(isSuspiciousReplacement(previous, ['a', 'b', 'c', 'x', 'y', 'z']), false);
  assert.equal(isSuspiciousReplacement(previous, previous), false);
  assert.equal(isSuspiciousReplacement(['a', 'b', 'c'], ['x', 'y', 'z']), false);
});
