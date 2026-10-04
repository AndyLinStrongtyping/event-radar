import assert from 'node:assert/strict';
import test from 'node:test';
import { changedValues, duplicateCandidates } from '../src/dedupe.ts';
import { normalizeExhibition } from '../src/normalize.ts';

const source = {
  museumId: 'npm-south', title: '天團降臨：藝術中的仙佛組合', venue: 'S302 3F',
  startDate: '2026-09-08', endDate: '2026-12-06', priceNote: null, summary: null,
  sourceUrl: 'https://south.npm.gov.tw/ExhibitionsDetailC003110.aspx?Cond=ac20c438-1a48-4f54-8484-fd437bef211f',
};

test('跨來源只在同館展名、展廳、展期都吻合時視為同展', () => {
  const row = normalizeExhibition(source, 'npm-south');
  const candidate = { id: 'one', title: '天團降臨 : 藝術中的仙佛組合', venue: 'S302 3F',
    startDate: '2026-09-10', endDate: '2026-12-01', sourceUrl: 'https://south.npm.gov.tw/other' };
  assert.equal(duplicateCandidates(row, [candidate]).length, 1);
  assert.equal(duplicateCandidates(row, [{ ...candidate, venue: 'S201 2F' }]).length, 0);
  assert.equal(duplicateCandidates(row, [{ ...candidate, startDate: '2027-01-01' }]).length, 0);
});

test('展期變動記錄舊值與新值', () => {
  const previous = normalizeExhibition(source, 'npm-south');
  const next = normalizeExhibition({ ...source, endDate: '2026-12-07' }, 'npm-south');
  assert.deepEqual(changedValues(previous, next), [
    { field: 'endDate', oldValue: '2026-12-06', newValue: '2026-12-07' },
  ]);
});
