import { createHash } from 'node:crypto';

const museums = {
  chimei: { city: '臺南市', host: 'chimeimuseum.org' },
  nmns: { city: '臺中市', host: 'nmns.edu.tw' },
  'npm-south': { city: '嘉義縣', host: 'south.npm.gov.tw' },
} as const;

export type ExhibitionDraft = {
  museumId: keyof typeof museums;
  sourceKey: string;
  title: string;
  city: string;
  venue: string | null;
  startDate: string;
  endDate: string;
  priceNote: string | null;
  sourceUrl: string;
  summary: string | null;
  isSample: boolean;
  contentHash: string;
};

function optionalText(value: unknown, max: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('文字欄位格式錯誤');
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length > max) throw new Error(`文字超過 ${max} 字`);
  return clean || null;
}

function validDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('展期必須使用 YYYY-MM-DD');
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`無效日期：${value}`);
  }
  return value;
}

export function normalizeExhibition(row: Record<string, unknown>, expectedMuseum: string): ExhibitionDraft {
  if (expectedMuseum !== 'chimei' && expectedMuseum !== 'nmns' && expectedMuseum !== 'npm-south') {
    throw new Error('此館尚無匯入 adapter');
  }
  if (row.museumId !== expectedMuseum) throw new Error('資料列館別與匯入來源不一致');
  const title = optionalText(row.title, 200);
  const sourceUrl = optionalText(row.sourceUrl, 1000);
  if (!title || !sourceUrl) throw new Error('缺少展覽標題或官方網址');
  const url = new URL(sourceUrl);
  const host = museums[expectedMuseum].host;
  if (url.protocol !== 'https:' || (url.hostname !== host && !url.hostname.endsWith(`.${host}`))) {
    throw new Error('展覽網址不是該館的官方 HTTPS 網址');
  }
  const startDate = validDate(row.startDate);
  const endDate = validDate(row.endDate);
  if (endDate < startDate) throw new Error('結束日早於開始日');
  const isSample = row.isSample === true;
  if (row.isSample !== undefined && typeof row.isSample !== 'boolean') throw new Error('isSample 必須是布林值');
  const sourceKey = isSample ? optionalText(row.sourceKey, 200) : sourceUrl;
  if (!sourceKey) throw new Error('模擬資料需要 sourceKey');
  const data: Omit<ExhibitionDraft, 'contentHash'> = {
    museumId: expectedMuseum,
    sourceKey,
    title,
    city: museums[expectedMuseum].city,
    venue: optionalText(row.venue, 200),
    startDate,
    endDate,
    priceNote: optionalText(row.priceNote, 200),
    sourceUrl,
    summary: optionalText(row.summary, 320),
    isSample,
  };
  return { ...data, contentHash: createHash('sha256').update(JSON.stringify(data)).digest('hex') };
}
