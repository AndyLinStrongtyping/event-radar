import type { ExhibitionDraft } from './normalize.ts';

export type ExistingExhibition = Pick<ExhibitionDraft,
  'title' | 'venue' | 'startDate' | 'endDate' | 'sourceUrl'> & { id: string };

function key(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-TW').replace(/[^\p{L}\p{N}]/gu, '');
}

/** Exact official URL wins; title/date/venue only merge when all three agree. */
export function duplicateCandidates(row: ExhibitionDraft, existing: ExistingExhibition[]): ExistingExhibition[] {
  const sameUrl = existing.filter((item) => item.sourceUrl === row.sourceUrl);
  if (sameUrl.length) return sameUrl;
  return existing.filter((item) => item.venue && row.venue
    && key(item.title) === key(row.title)
    && key(item.venue) === key(row.venue)
    && item.startDate <= row.endDate && item.endDate >= row.startDate);
}

export const changeFields = ['title', 'venue', 'startDate', 'endDate', 'priceNote', 'sourceUrl', 'summary'] as const;
export type ChangeField = typeof changeFields[number];

export function changedValues(previous: ExhibitionDraft, next: ExhibitionDraft): Array<{
  field: ChangeField; oldValue: string | null; newValue: string | null;
}> {
  return changeFields.filter((field) => previous[field] !== next[field]).map((field) => ({
    field, oldValue: previous[field], newValue: next[field],
  }));
}
