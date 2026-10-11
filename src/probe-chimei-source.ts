import { classifyChimeiInternalPayload } from './sources/chimei-internal.ts';
import { fetchChimeiPublicPayload } from './sources/fetch-chimei-public.ts';

const origin = 'https://www.chimeimuseum.org';

function records(value: unknown, group: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${group} 不是陣列`);
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${group} 項目格式錯誤`);
    return item as Record<string, unknown>;
  });
}

async function main(): Promise<void> {
  const parsed: unknown = await fetchChimeiPublicPayload();
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('頂層 JSON 格式錯誤');
  const payload = parsed as Record<string, unknown>;
  const counts: Record<string, number> = {};
  const fields: Record<string, string[]> = {};
  const seen = new Set<string>();
  for (const group of ['specialEvent', 'permanentEvent', 'expoEvent']) {
    const items = records(payload[group], group);
    counts[group] = items.length;
    fields[group] = [...new Set(items.flatMap((item) => Object.keys(item)))].sort();
    for (const item of items) {
      if (typeof item.title !== 'string' || !item.title.trim()) throw new Error(`${group} 缺少標題`);
      if (typeof item.link !== 'string') throw new Error(`${group} 缺少連結`);
      const link = new URL(item.link);
      if (link.origin !== origin) throw new Error(`${group} 連結不是奇美官網`);
      const key = group === 'permanentEvent' ? link.href : String(item.id ?? '');
      if (!key || seen.has(`${group}:${key}`)) throw new Error(`${group} 來源身份缺失或重複`);
      seen.add(`${group}:${key}`);
    }
  }
  if (Object.values(counts).every((count) => count === 0)) throw new Error('三組資料皆為空');
  const classified = classifyChimeiInternalPayload(payload);
  process.stdout.write(`${JSON.stringify({ checkedAt: new Date().toISOString(), status: 'candidate_probe_ok',
    counts, fields, candidateSpecialRows: classified.rows.length,
    specialNeedsReview: classified.records.filter((record) => record.status === 'review').length,
    specialReviewReasons: [...new Set(classified.records.filter((record) => record.status === 'review')
      .map((record) => record.reason))],
    note: '只讀契約檢查；不代表授權、完整性或跨週穩定性' })}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`奇美候選來源檢查失敗：${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
