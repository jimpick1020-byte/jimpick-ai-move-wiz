import { test } from "node:test";
import { strict as assert } from "node:assert";
import { customerPaymentDue } from "./customer-payment";
import { paymentReview } from "./payment-review";

test("김호영 310000 total less 110000 deposit gives 200000 balance", () => assert.deepEqual(customerPaymentDue(310000,110000,0,"deposit_paid"), { kind:"balance", amount:200000 }));
test("200000 pending bank balance identifies 김호영 without confirming", () => {
  const review = paymentReview([{ amount:200000, status:"pending_review", source:"customer_claim", paymentMethod:"bank_transfer", paymentKind:"balance", depositorName:"김호영" }], "deposit_paid",110000,0,310000);
  assert.equal(review?.kind,"balance"); assert.equal(review?.amount,200000); assert.deepEqual(review?.names,["김호영"]);
});
test("confirmed balance removes review", () => assert.equal(paymentReview([{ amount:200000, status:"confirmed", source:"customer_claim", paymentMethod:"bank_transfer", paymentKind:"balance", depositorName:"김호영" }], "completed",110000,200000,310000),null));
test("completed has no further customer balance claim", () => assert.equal(customerPaymentDue(310000,110000,200000,"completed").amount,0));
test("partial balance subtracts already confirmed amount", () => assert.equal(customerPaymentDue(310000,110000,50000,"partial").amount,150000));