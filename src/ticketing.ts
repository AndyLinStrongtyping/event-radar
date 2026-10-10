/** Manually checked ticket information. This is separate from the exhibition feed. */
export type PriceGuide = {
  label: string;
  price: string;
  infoUrl: string;
  purchaseUrl: string | null;
  checkedOn: string;
  note: string;
};

type MuseumGuide = PriceGuide;

export const museumTickets: Record<string, MuseumGuide> = {
  chimei: {
    label: '常設展', price: '全票 NT$200', infoUrl: 'https://www.chimeimuseum.org/visit',
    purchaseUrl: 'https://chimeimuseum.fonticket.com/', checkedOn: '2026-10-10',
    note: '不含需另購票的特展。',
  },
  nmns: {
    label: '展示場', price: '全票 NT$120', infoUrl: 'https://www.nmns.edu.tw/ch/visit/ticket/index.html',
    purchaseUrl: 'https://iticket.nmns.edu.tw/iticket/', checkedOn: '2026-10-10',
    note: '收費特展另計；請在售票頁選對票種。',
  },
  ntm: {
    label: '本館／古生物館', price: '全票 NT$30', infoUrl: 'https://www.ntm.gov.tw/cp.aspx?Create=1&n=5444',
    purchaseUrl: null, checkedOn: '2026-10-10', note: '館方票務頁列現場購票方式；特展另查公告。',
  },
  nmth: {
    label: '一般入館', price: '全票 NT$100', infoUrl: 'https://the.nmth.gov.tw/nmth/zh-TW/QuestionAnswer/_ListByType',
    purchaseUrl: null, checkedOn: '2026-10-10', note: '購票方式及特展規定請查館方。',
  },
  'npm-south': {
    label: '南院參觀券', price: '普通票 NT$150', infoUrl: 'https://south.npm.gov.tw/Visit/Ticket.htm',
    purchaseUrl: 'https://npm.fonticket.com/', checkedOn: '2026-10-10',
    note: '個別特展若另售票，請以該展公告為準。',
  },
  'npm-north': {
    label: '北院參觀券', price: '國人持證 NT$150／一般 NT$350', infoUrl: 'https://www.npm.gov.tw/Articles.aspx?l=1&sno=02007004',
    purchaseUrl: 'https://npm.fonticket.com/', checkedOn: '2026-10-10',
    note: '有身分別優惠；個別特展若另售票，請以該展公告為準。',
  },
  nstm: {
    label: '常設展示廳', price: '全票 NT$120', infoUrl: 'https://www.nstm.gov.tw/Reference/VisitorInformation/Price.htm',
    purchaseUrl: 'https://mobile.nstm.gov.tw/Ticket', checkedOn: '2026-10-10',
    note: '特展票券依各展規定，可能需要另外購買。',
  },
  ntsec: {
    label: '常設展 3–6 樓', price: '全票 NT$120', infoUrl: 'https://www.ntsec.gov.tw/article/detail.aspx?a=23',
    purchaseUrl: 'https://ntsec.fonticket.com/', checkedOn: '2026-10-10',
    note: '館方線上票只售當日常設展票；特展另計。',
  },
  nmmba: {
    label: '一般入館', price: '全票 NT$450', infoUrl: 'https://www.nmmba.gov.tw/cp.aspx?n=A6476B49BA86BBD5&s=B3CCAAE6060F5DB7',
    purchaseUrl: 'https://www.aquarium.com.tw/products_a.asp', checkedOn: '2026-10-10',
    note: '線上入口由館方票價頁連至經營團隊；特殊活動另查公告。',
  },
};

const pharaohUrl = 'https://www.chimeimuseum.org/special-exhibition/68a68f0a422a6/68a68fa1d1a3b';
const pharaohTicket: PriceGuide = {
  label: '《埃及之王：法老》特展', price: '全票 NT$580／優惠票 NT$480',
  infoUrl: 'https://www.chimeimuseum.org/special-exhibition/68a68f0a422a6/68a690b20b793',
  purchaseUrl: 'https://chimeimuseum.fonticket.com/', checkedOn: '2026-10-10',
  note: '網路購票需選參觀日期；票種與剩餘名額以售票頁為準。',
};

export function ticketingForExhibition(row: { museumId: string; sourceUrl: string; isSample?: boolean }) {
  if (row.isSample) return { exhibition: null, generalAdmission: null };
  return {
    exhibition: row.museumId === 'chimei' && row.sourceUrl === pharaohUrl ? pharaohTicket : null,
    generalAdmission: museumTickets[row.museumId] ?? null,
  };
}
