import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { paymentSummaryParts } from './payment-method';
import { paymentReview } from './payment-review';

test('1,400,000 quote with planned 140,000 and confirmed 100,000 shows deposit 100,000 / balance 1,300,000', () => {
  assert.deepEqual(paymentSummaryParts(1400000, 100000, 0, 140000), { total: 1400000, deposit: 100000, balance: 1300000, planned: false });
});
test('raising the total to 1,500,000 keeps the confirmed 100,000 and leaves 1,400,000', () => {
  assert.deepEqual(paymentSummaryParts(1500000, 100000, 0, 150000), { total: 1500000, deposit: 100000, balance: 1400000, planned: false });
});
test('before any deposit the planned 500,000 is shown as planned, not paid', () => {
  assert.deepEqual(paymentSummaryParts(2160000, 0, 0, 500000), { total: 2160000, deposit: 500000, balance: 1660000, planned: true });
});
test('planned deposit 0 with confirmed 100,000 shows the actual 100,000', () => {
  assert.deepEqual(paymentSummaryParts(1400000, 100000, 0, 0), { total: 1400000, deposit: 100000, balance: 1300000, planned: false });
});
test('summed confirmed deposits and a partial balance reduce the remainder', () => {
  assert.equal(paymentSummaryParts(1400000, 50000 + 50000, 300000, 140000).balance, 1000000);
});
test('a confirmed balance without deposit is still actual and never negative', () => {
  assert.deepEqual(paymentSummaryParts(1400000, 0, 1500000, 140000), { total: 1400000, deposit: 0, balance: 0, planned: false });
});
test('pending bank evidence is not counted as paid in the summary', () => {
  const receipt = { amount: 200000, status: 'pending_review', source: 'sms_paste', paymentKind: 'deposit', depositorName: '시험' };
  assert.equal(paymentReview([receipt], 'unpaid', 0, 0, 2160000)?.amount, 200000);
  assert.deepEqual(paymentSummaryParts(2160000, 0, 0, 216000), { total: 2160000, deposit: 216000, balance: 1944000, planned: true });
});
import { receivedWithNew } from './payment-method';
test('overpayment check counts 100,000 deposit, 300,000 partial balance and the new 1,200,000 receipt', () => {
  assert.equal(receivedWithNew(100000, 300000, 1200000), 1600000);
});
