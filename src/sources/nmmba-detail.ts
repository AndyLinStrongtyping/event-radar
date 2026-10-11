import { normalizeExhibition } from '../normalize.ts';
import { parseNmmbaDate, type NmmbaBatch, type SourceRecord } from './nmmba.ts';

type DateRange = { startDate: string; endDate: string };

function plainText(value: string): string {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ').trim();
}

/** A labelled, complete ROC date range is the only prose format we accept. */
export function nmmbaLabelledDateRange(value: string): DateRange | null {
  const text = plainText(value);
  const pattern = /展出日期\s*[｜|:：]?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(?:至|到|[－–—~～-])\s*(?:(\d{2,3})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日/gu;
  const matches = [...text.matchAll(pattern)];
  if (matches.length !== 1) return null;
  const match = matches[0];
  try {
    const startDate = parseNmmbaDate(`${match[1].padStart(3, '0')}${match[2].padStart(2, '0')}${match[3].padStart(2, '0')}`);
    const endDate = parseNmmbaDate(`${(match[4] ?? match[1]).padStart(3, '0')}${match[5].padStart(2, '0')}${match[6].padStart(2, '0')}`);
    return endDate >= startDate ? { startDate, endDate } : null;
  } catch {
    return null;
  }
}

function officialDetailUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.nmmba.gov.tw'
      && url.pathname === '/News_Content.aspx' && url.searchParams.has('s') ? url.href : null;
  } catch {
    return null;
  }
}

function candidate(record: SourceRecord): DateRange | null {
  if (record.status !== 'review' || !officialDetailUrl(record.sourceUrl)) return null;
  const description = record.raw['特展內容'];
  return typeof description === 'string' ? nmmbaLabelledDateRange(description) : null;
}

/** Recheck only promising official records, never every old or undated entry. */
export async function verifyNmmbaDetails(batch: NmmbaBatch,
  loadDetail: (url: string) => Promise<string>): Promise<NmmbaBatch> {
  for (const record of batch.records) {
    const proposed = candidate(record);
    if (!proposed) continue;
    const title = record.raw['特展名稱'];
    if (typeof title !== 'string' || !title.trim()) continue;
    try {
      const html = await loadDetail(record.sourceUrl!);
      const pageTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
      const confirmed = nmmbaLabelledDateRange(html);
      if (!pageTitle || plainText(pageTitle[1]) !== title.trim() || !confirmed
        || confirmed.startDate !== proposed.startDate || confirmed.endDate !== proposed.endDate) continue;
      const originalStart = record.raw['app用開始時間'];
      const originalEnd = record.raw['app用結束時間'];
      if (typeof originalStart === 'string' && originalStart.trim()
        && parseNmmbaDate(originalStart) !== confirmed.startDate) continue;
      if (typeof originalEnd === 'string' && originalEnd.trim()
        && parseNmmbaDate(originalEnd) !== confirmed.endDate) continue;
      batch.rows.push(normalizeExhibition({ museumId: 'nmmba', title,
        startDate: confirmed.startDate, endDate: confirmed.endDate,
        venue: record.raw['展出地點'] || null, sourceUrl: record.sourceUrl,
        summary: null, priceNote: null, isSample: false }, 'nmmba'));
      record.status = 'ready';
      record.reason = null;
    } catch {
      // A missing or changed detail page keeps this record in review; it must not fail the source batch.
    }
  }
  return batch;
}
