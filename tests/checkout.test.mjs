import assert from "node:assert/strict";
import test from "node:test";
import {
  canResumePendingOrder,
  getCheckoutOrderRequest,
  getPostCheckoutStep,
} from "../src/utils/checkout.mjs";

test("returning to payment options and continuing updates the existing order", () => {
  assert.deepEqual(getCheckoutOrderRequest("order-123"), {
    path: "/orders/order-123/checkout",
    method: "PUT",
  });
});

test("the first checkout submission creates one order", () => {
  assert.deepEqual(getCheckoutOrderRequest(null), {
    path: "/orders",
    method: "POST",
  });
});

test("GCash and Maya continue to proof while COD and card complete checkout", () => {
  assert.equal(getPostCheckoutStep("gcash"), 2.5);
  assert.equal(getPostCheckoutStep("maya"), 2.5);
  assert.equal(getPostCheckoutStep("cod"), 3);
  assert.equal(getPostCheckoutStep("card"), 3);
});

test("only unpaid pending orders can be resumed", () => {
  assert.equal(canResumePendingOrder({ status: "pending", payment_status: "PENDING", payment_method: "GCASH" }), true);
  assert.equal(canResumePendingOrder({ status: "pending", payment_status: "PENDING", payment_method: "MAYA" }), true);
  assert.equal(canResumePendingOrder({ status: "pending", payment_status: "REJECTED", payment_method: "GCASH" }), false);
  assert.equal(canResumePendingOrder({ status: "pending", payment_status: "PENDING", payment_method: "COD" }), false);
  assert.equal(canResumePendingOrder({ status: "cancelled", payment_status: "PENDING", payment_method: "GCASH" }), false);
  assert.equal(canResumePendingOrder(null), false);
});
