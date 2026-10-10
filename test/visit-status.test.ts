import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseNmnsHours, validVisitDate, visitStatus } from '../src/visit-status.ts';

test('休館日期驗證與奇美週三例外提醒', async () => {
  assert.equal(validVisitDate('2026-02-30'), false);
  assert.equal(validVisitDate('2026-10-07'), true);
  const wednesday = await visitStatus('chimei', '2026-10-07');
  assert.equal(wednesday.status, 'unknown'); // 特別場次可能開放，不能單靠星期判定休館
  assert.match(wednesday.message, /特別開放場次/);
  assert.match(wednesday.sourceUrl, /chimeimuseum\.org\/visit\/calendar/);
  const other = await visitStatus('chimei', '2026-10-08');
  assert.equal(other.status, 'unknown'); // 臨時休館未核對，不能宣稱開館
});

test('科博館逐日 holiday 欄位決定狀態，不推測缺失資料', () => {
  const payload = { success: true, dates: [
    { date: '2026/10/05', holiday: true },
    { date: '2026/10/06', holiday: false, startHour: '09:00', endHour: '17:00' },
  ] };
  assert.equal(parseNmnsHours(payload, '2026-10-05').status, 'closed');
  assert.match(parseNmnsHours(payload, '2026-10-06').message, /09:00–17:00/);
  assert.throws(() => parseNmnsHours(payload, '2026-10-07'));
});

test('未設定科博館金鑰時安全退回官方開放時間頁', async () => {
  const previous = process.env.NMNS_API_KEY;
  delete process.env.NMNS_API_KEY;
  try {
    const result = await visitStatus('nmns', '2026-10-05');
    assert.equal(result.status, 'unknown');
    assert.match(result.sourceUrl, /nmns\.edu\.tw\/ch\/visit\/hours/);
  } finally {
    if (previous) process.env.NMNS_API_KEY = previous;
  }
});
