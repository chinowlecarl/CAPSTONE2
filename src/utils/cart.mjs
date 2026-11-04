export function addProductToCart(cart, product) {
  const productId = String(product.id);
  const index = cart.findIndex((item) =>
    String(item.product_id ?? item.products?.id ?? item.id) === productId
  );
  const currentQuantity = index === -1 ? 0 : Number(cart[index].quantity) || 0;
  const availableStock = Number(product.stock) || 0;

  if (currentQuantity + 1 > availableStock) {
    return {
      added: false,
      cart,
      error: availableStock > 0
        ? `Only ${availableStock} item${availableStock === 1 ? "" : "s"} available`
        : "This product is out of stock",
    };
  }

  if (index === -1) {
    return {
      added: true,
      cart: [...cart, { ...product, product_id: product.id, quantity: 1 }],
    };
  }

  return {
    added: true,
    cart: cart.map((item, itemIndex) =>
      itemIndex === index ? { ...item, quantity: currentQuantity + 1 } : item
    ),
  };
}

export function calculateCartSubtotal(cart, getPrice) {
  return cart.reduce(
    (subtotal, item) => subtotal + getPrice(item) * (Number(item.quantity) || 0),
    0,
  );
}

export function calculateCartTotals(cart, getPrice) {
  const subtotal = calculateCartSubtotal(cart, getPrice);
  const shipping = subtotal > 500 ? 0 : 80;
  const tax = subtotal * 0.12;
  return { subtotal, shipping, tax, total: subtotal + shipping + tax };
}

export function createCartAddGuard(cooldownMs = 400) {
  const pending = new Set();
  const lastStartedAt = new Map();

  return {
    tryStart(productId, now = Date.now()) {
      if (
        pending.has(productId) ||
        now - (lastStartedAt.get(productId) ?? -Infinity) < cooldownMs
      ) return false;

      pending.add(productId);
      lastStartedAt.set(productId, now);
      return true;
    },
    finish(productId) {
      pending.delete(productId);
    },
  };
}
