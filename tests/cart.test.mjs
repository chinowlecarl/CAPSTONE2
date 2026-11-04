import assert from "node:assert/strict";
import test from "node:test";
import {
  addProductToCart,
  calculateCartTotals,
  createCartAddGuard,
} from "../src/utils/cart.mjs";

test("adding the same product increments its quantity without duplicating the row", () => {
  const product = { id: "p1", title: "Top", stock: 3 };
  const first = addProductToCart([], product);
  const second = addProductToCart(first.cart, product);

  assert.equal(first.cart.length, 1);
  assert.equal(second.cart.length, 1);
  assert.equal(second.cart[0].quantity, 2);
});

test("adding a product is rejected when it would exceed available stock", () => {
  const product = { id: "p1", title: "Top", stock: 1 };
  const first = addProductToCart([], product);
  const second = addProductToCart(first.cart, product);

  assert.equal(second.added, false);
  assert.match(second.error, /Only 1 item available/);
  assert.equal(second.cart[0].quantity, 1);
});

test("cart totals include quantity and per-item discounted prices consistently", () => {
  const cart = [
    { product_id: "p1", quantity: 2, price: 100, discount: 10 },
    { product_id: "p2", quantity: 3, price: 50, discount: 0 },
  ];
  const getPrice = (item) =>
    item.discount > 0 ? item.price * (1 - item.discount / 100) : item.price;

  assert.deepEqual(calculateCartTotals(cart, getPrice), {
    subtotal: 330,
    shipping: 80,
    tax: 39.6,
    total: 449.6,
  });
});

test("rapid add requests for the same product are locked and rate-limited", () => {
  const guard = createCartAddGuard(400);

  assert.equal(guard.tryStart("p1", 1000), true);
  assert.equal(guard.tryStart("p1", 1001), false);
  guard.finish("p1");
  assert.equal(guard.tryStart("p1", 1200), false);
  assert.equal(guard.tryStart("p1", 1400), true);
});
