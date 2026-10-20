import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { checkNpmNorthKnownCoverage, classifyNpmNorthFeed } from '../src/sources/npm-north.ts';
import { normalizeExhibition } from '../src/normalize.ts';

const base = {
  sno: '04014505', link: 'https://www.npm.gov.tw/Articles.aspx?sno=04014505',
  title: '《龍藏經》特展', time: '2026-05-09 ~ 2026-11-08',
  location: '北部院區　第一展覽館 103,104', description: '館方展覽資料',
};

test('故宮 JSON 必須分院、排除過期、隔離長期或缺日期資料', () => {
  const batch = classifyNpmNorthFeed([
    base,
    { ...base, sno: '04014534', link: 'https://www.npm.gov.tw/Articles.aspx?sno=04014534', location: '南部院區' },
    { ...base, sno: '04014555', link: 'https://www.npm.gov.tw/Articles.aspx?sno=04014555',
      time: '2026-01-01 ~ 2026-09-16' },
    { ...base, sno: '04013668', link: 'https://www.npm.gov.tw/Articles.aspx?sno=04013668',
      time: '2024-05-17 ~ 2027-08-15' },
    { ...base, sno: '04012832', link: 'https://www.npm.gov.tw/Articles.aspx?sno=04012832',
      time: '2021-12-24 ~ ' },
  ], '2026-10-04');
  assert.equal(batch.rows.length, 1);
  assert.equal(batch.rows[0].museumId, 'npm-north');
  assert.deepEqual(batch.records.map((item) => item.status),
    ['ready', 'ignored', 'ignored', 'review', 'review']);
});

test('故宮展覽連結不能指向非官方網站', () => {
  const batch = classifyNpmNorthFeed([{ ...base, link: 'https://example.com/Articles.aspx?sno=04014505' }],
    '2026-10-04');
  assert.equal(batch.rows.length, 0);
  assert.equal(batch.records[0].status, 'review');
});

test('已知當期展缺漏可標為部分涵蓋，展期結束後停止警示', () => {
  const rows = classifyNpmNorthFeed([base], '2026-10-20').rows;
  assert.equal(checkNpmNorthKnownCoverage(rows, '2026-10-20').length, 2);
  assert.deepEqual(checkNpmNorthKnownCoverage(rows, '2026-12-28'), []);
});

test('已知展覽必須同時符合來源鍵、標題、展期與官方詳情網址', () => {
  const known = [
    { sno: '04014549', title: '真知灼見：美感原則與書法欣賞', time: '2026-09-25 ~ 2026-12-27' },
    { sno: '04014551', title: '養心：巨幅名作展', time: '2026-09-22 ~ 2026-12-27' },
  ];
  const rows = classifyNpmNorthFeed(known.map((item) => ({ ...base, ...item,
    link: `https://www.npm.gov.tw/Exhibition-Content.aspx?l=1&sno=${item.sno}` })), '2026-10-20').rows;
  assert.deepEqual(checkNpmNorthKnownCoverage(rows, '2026-10-20'), []);
  assert.equal(checkNpmNorthKnownCoverage([{ ...rows[0], endDate: '2026-12-28' }, rows[1]], '2026-10-20').length, 1);
  assert.equal(checkNpmNorthKnownCoverage([{ ...rows[0], sourceUrl:
    'https://www.npm.gov.tw/Articles.aspx?sno=04014549' }, rows[1]], '2026-10-20').length, 1);
});

test('人工補充清單只收已核對的故宮北院詳情網址與完整展期', () => {
  const file = new URL('../data/npm-north-verified-supplement.json', import.meta.url);
  const items: unknown = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(Array.isArray(items));
  const rows = items.map((item) => normalizeExhibition(item, 'npm-north'));
  assert.equal(rows.length, 2);
  assert.deepEqual(checkNpmNorthKnownCoverage(rows, '2026-10-20'), []);
  assert.equal(new Set(rows.map((row) => row.sourceKey)).size, rows.length);
});
