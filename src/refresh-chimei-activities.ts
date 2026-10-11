import { readFile, rename, writeFile } from 'node:fs/promises';
import { classifyChimeiActivities, type ChimeiActivitySnapshot } from './sources/chimei-activities.ts';
import { classifyChimeiInternalPayload } from './sources/chimei-internal.ts';
import { fetchChimeiPublicPayload } from './sources/fetch-chimei-public.ts';

const target = new URL('../data/chimei-activities.json', import.meta.url);

async function main(): Promise<void> {
  const payload = await fetchChimeiPublicPayload();
  const groups = classifyChimeiInternalPayload(payload);
  const snapshot = classifyChimeiActivities(payload, new Date().toISOString());
  if (groups.counts.expoEvent !== snapshot.items.length) throw new Error('活動組筆數不一致');
  let previous: ChimeiActivitySnapshot | null = null;
  try { previous = JSON.parse(await readFile(target, 'utf8')) as ChimeiActivitySnapshot; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (previous?.items?.length) {
    const previousIds = new Set(previous.items.map((item) => item.id));
    const overlap = snapshot.items.filter((item) => previousIds.has(item.id)).length;
    if (snapshot.items.length < Math.ceil(previous.items.length / 2) || overlap < Math.ceil(previous.items.length / 3)) {
      throw new Error('奇美活動清單疑似縮水或來源 ID 大量更換，保留舊快照供人工核對');
    }
  }
  const temp = new URL('../data/chimei-activities.json.tmp', import.meta.url);
  await writeFile(temp, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'w' });
  await rename(temp, target);
  process.stdout.write(`奇美活動候選快照已更新：${snapshot.items.length} 筆，${snapshot.checkedAt}；需開啟官網核對報名與日期\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`奇美活動快照未更新：${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
