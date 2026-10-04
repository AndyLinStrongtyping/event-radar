import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyNpmNorthFeed } from '../src/sources/npm-north.ts';

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
