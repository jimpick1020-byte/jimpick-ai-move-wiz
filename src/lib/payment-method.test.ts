import { test } from "node:test";
import { strict as assert } from "node:assert";
import { normalizePaymentMethod, remainingPayment } from "./payment-method";
test("cash is stored separately", () => assert.equal(normalizePaymentMethod("cash"), "cash"));
test("bank transfer is not cash", () => assert.equal(normalizePaymentMethod("bank_transfer"), "bank_transfer"));
test("card is not cash", () => assert.equal(normalizePaymentMethod("card"), "card"));
test("unknown legacy methods remain unclassified", () => assert.equal(normalizePaymentMethod(null), "unclassified"));
test("remaining payment is 950000 without adding VAT", () => assert.equal(remainingPayment(1000000, 50000, 0), 950000));
test("previous balance is not charged again", () => assert.equal(remainingPayment(1000000, 50000, 100000), 850000));
test("confirmed 110000 deposit on 1110000 estimate leaves 1000000 balance", () => assert.equal(remainingPayment(1110000, 110000, 0), 1000000));
test("confirmed 1000000 balance after 110000 deposit leaves zero", () => assert.equal(remainingPayment(1110000, 110000, 1000000), 0));
test("owner reviews 950000 bank balance after 80000 deposit without changing total", () => {
  assert.equal(remainingPayment(1030000, 80000, 0), 950000);
  assert.equal(remainingPayment(1030000, 80000, 950000), 0);
  assert.equal(normalizePaymentMethod("bank_transfer"), "bank_transfer");
});