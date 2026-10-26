import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { atlasEntries, atlasEntryFor } from '../frontend/src/collection-atlas.ts';

test('每間既有館舍都有一筆圖鑑，連回對應館舍並提供可辨識的影像說明', async () => {
  const expected = ['chimei','nmns','ntm','nmth','npm-north','npm-south','nstm','ntsec','ntmofa','nmmba','okinawa-churaumi','penghu-fossil','zuojhen-fossil','ntt'];
  assert.deepEqual(atlasEntries.map((entry) => entry.museum).sort(), expected.sort());
  assert.equal(new Set(atlasEntries.map((entry) => entry.museum)).size, 14);
  for (const entry of atlasEntries) {
    assert.equal(atlasEntryFor(entry.museum), entry);
    assert.equal(entry.observations.length, 3);
    assert.ok(entry.relationship && entry.era && entry.imageNote);
    assert.match(entry.image, /^\/assets\/[a-z0-9-]+\.(webp|jpg)$/);
    const asset = await stat(new URL(`../web${entry.image}`, import.meta.url));
    assert.ok(asset.size > 1000);
    const guide = await readFile(new URL(`../web/guides/${entry.museum}.html`, import.meta.url), 'utf8');
    assert.ok(guide.includes(`/explore/collections/?museum=${entry.museum}`));
    for (const source of [entry.source, entry.extension].filter(Boolean)) {
      const url = new URL(source!.url);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.username, '');
      assert.equal(url.password, '');
    }
    if (entry.imageKind === 'illustration') assert.match(entry.imageNote, /AI.*(?:非|不)/);
    else assert.match(entry.image, /-user\.(?:jpg|webp)$/, '圖鑑實拍僅使用使用者現場照片；其他來源使用概念插畫');
  }
});

test('未知或缺少館別時使用預設條目，不把查詢值插入畫面或檔案路徑', () => {
  assert.equal(atlasEntryFor(null), atlasEntries[0]);
  assert.equal(atlasEntryFor('../private/credentials'), atlasEntries[0]);
  assert.equal(atlasEntryFor('<script>'), atlasEntries[0]);
});
