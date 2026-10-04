import { createHash } from 'node:crypto';
import { normalizeExhibition, type ExhibitionDraft } from './normalize.ts';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

export function sourceHash(raw: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(stable(raw))).digest('hex');
}

export function correctedDraft(museum: string, raw: Record<string, unknown>,
  startDate: string, endDate: string, evidenceUrl: string): ExhibitionDraft {
  let title: unknown;
  let venue: unknown;
  let sourceUrl: unknown;
  if (museum === 'nmmba') {
    title = raw['特展名稱']; venue = raw['展出地點'] || null; sourceUrl = raw.Source;
  } else if (museum === 'npm-north') {
    title = raw.title; venue = raw.location; sourceUrl = raw.link;
    if (typeof venue !== 'string' || !venue.includes('北部院區')) {
      throw new Error('人工補正僅適用於確認為北部院區的展覽');
    }
  } else {
    throw new Error('此來源尚不支援人工展期補正');
  }
  const sourceKey = museum === 'npm-north' ? raw.sno : undefined;
  const values = { museumId: museum, title, venue, startDate, endDate, sourceKey,
    sourceUrl, isSample: false };
  const row = normalizeExhibition(values, museum);
  normalizeExhibition({ ...values, sourceUrl: evidenceUrl }, museum);
  return row;
}
