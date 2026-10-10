import test from 'node:test';
import assert from 'node:assert/strict';
import { museumTickets, ticketingForExhibition } from '../src/ticketing.ts';

test('票務索引只放館方來源或館方導向的購票入口', () => {
  assert.equal(Object.keys(museumTickets).length, 9);
  for (const ticket of Object.values(museumTickets)) {
    assert.match(ticket.price, /NT\$\d+/);
    assert.equal(ticket.checkedOn, '2026-10-10');
    assert.equal(new URL(ticket.infoUrl).protocol, 'https:');
    if (ticket.purchaseUrl) assert.equal(new URL(ticket.purchaseUrl).protocol, 'https:');
  }
});

test('一般入館票價不能冒充任何特展票價', () => {
  const ticketing = ticketingForExhibition({ museumId: 'nmns', sourceUrl: 'https://www.nmns.edu.tw/ch/exhibitions/example/' });
  assert.equal(ticketing.exhibition, null);
  assert.equal(ticketing.generalAdmission?.price, '全票 NT$120');
  assert.equal(ticketingForExhibition({ museumId: 'nmns', sourceUrl: 'https://www.nmns.edu.tw/', isSample: true }).generalAdmission, null);
});

test('只有核對過的奇美法老展連結有專屬票價與購票入口', () => {
  const known = ticketingForExhibition({ museumId: 'chimei',
    sourceUrl: 'https://www.chimeimuseum.org/special-exhibition/68a68f0a422a6/68a68fa1d1a3b' });
  assert.equal(known.exhibition?.price, '全票 NT$580／優惠票 NT$480');
  assert.equal(known.exhibition?.purchaseUrl, 'https://chimeimuseum.fonticket.com/');
  const unknown = ticketingForExhibition({ museumId: 'chimei', sourceUrl: 'https://www.chimeimuseum.org/special-exhibition/other' });
  assert.equal(unknown.exhibition, null);
});
