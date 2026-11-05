import assert from "node:assert/strict";
import test from "node:test";
import {
  addProductToCart,
  calculateCartSubtotal,
  calculateCartTotals,
  normalizeSingleItemCart,
} from "../src/utils/cart.mjs";

test("a one-of-a-kind product can only be added once", () => {
  const product = { id: "dress-1", title: "Floral Dress", stock: 1 };
  const firstAdd = addProductToCart([], product);

  assert.equal(firstAdd.added, true);
  assert.equal(firstAdd.cart[0].quantity, 1);
  assert.equal(
    addProductToCart(firstAdd.cart, product).error,
    "This one-of-a-kind item is already in your cart",
  );
});

test("sold products cannot be added to the cart", () => {
  const result = addProductToCart([], { id: "dress-1", stock: 0 });

  assert.equal(result.added, false);
  assert.equal(result.error, "This product is out of stock");
});

test("cart hydration normalizes legacy quantities and duplicate products", () => {
  const cart = normalizeSingleItemCart([
    { id: "cart-1", product_id: "dress-1", quantity: 4 },
    { id: "cart-2", product_id: "dress-1", quantity: 2 },
    { id: "cart-3", product_id: "shirt-1", quantity: 3 },
  ]);

  assert.deepEqual(cart, [
    { id: "cart-1", product_id: "dress-1", quantity: 1 },
    { id: "cart-3", product_id: "shirt-1", quantity: 1 },
  ]);
});

test("cart totals count each garment once", () => {
  const cart = [
    { quantity: 5, price: 100 },
    { quantity: 2, price: 200 },
  ];

  assert.equal(calculateCartSubtotal(cart, (item) => item.price), 300);
  assert.deepEqual(calculateCartTotals(cart, (item) => item.price), {
    subtotal: 300,
    shipping: 80,
    tax: 36,
    total: 416,
  });
});
