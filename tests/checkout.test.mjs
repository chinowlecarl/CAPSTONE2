import assert from "node:assert/strict";
import test from "node:test";
import {
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
