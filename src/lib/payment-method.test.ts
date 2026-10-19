import { test } from "node:test";
import { strict as assert } from "node:assert";
import { normalizePaymentMethod, remainingPayment } from "./payment-method";
test("cash is stored separately", () => assert.equal(normalizePaymentMethod("cash"), "cash"));
test("bank transfer is not cash", () => assert.equal(normalizePaymentMethod("bank_transfer"), "bank_transfer"));
test("card is not cash", () => assert.equal(normalizePaymentMethod("card"), "card"));
test("unknown legacy methods remain unclassified", () => assert.equal(normalizePaymentMethod(null), "unclassified"));
test("remaining payment is 950000 without adding VAT", () => assert.equal(remainingPayment(1000000, 50000, 0), 950000));
test("previous balance is not charged again", () => assert.equal(remainingPayment(1000000, 50000, 100000), 850000));