import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { paymentSummaryParts } from './payment-method';
import { paymentReview } from './payment-review';

test('saved 500000 deposit on 2160000 quote is visible before any payment confirmation', () => {
  assert.deepEqual(paymentSummaryParts(2160000, 0, 0, 500000), {
    total: 2160000, deposit: 500000, balance: 1660000,
  });
});
test('editing quoted deposit does not modify pending bank evidence or outstanding payment', () => {
  const receipt = { amount: 200000, status: 'pending_review', source: 'sms_paste', paymentKind: 'deposit', depositorName: '시험' };
  paymentSummaryParts(2160000, 0, 0, 500000);
  assert.equal(paymentReview([receipt], 'unpaid', 0, 0, 2160000)?.amount, 200000);
  assert.equal(paymentSummaryParts(2160000, 0, 0).balance, 2160000);
});
test('saved zero deposit is not replaced by confirmed payment', () => {
  assert.deepEqual(paymentSummaryParts(2160000, 200000, 0, 0), { total: 2160000, deposit: 0, balance: 2160000 });
});