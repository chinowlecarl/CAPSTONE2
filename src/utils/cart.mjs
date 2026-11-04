export function normalizeSingleItemCart(cart) {
  const seen = new Set();
  return (Array.isArray(cart) ? cart : []).reduce((items, item) => {
    const productId = String(item.product_id ?? item.products?.id ?? item.id);
    if (seen.has(productId)) return items;
    seen.add(productId);
    items.push({ ...item, quantity: 1 });
    return items;
  }, []);
}

export function addProductToCart(cart, product) {
  const productId = String(product.id);
  const exists = cart.some((item) =>
    String(item.product_id ?? item.products?.id ?? item.id) === productId
  );
  const availableStock = Number(product.stock) || 0;

  if (exists) {
    return {
      added: false,
      cart,
      error: "This one-of-a-kind item is already in your cart",
    };
  }

  if (availableStock < 1) {
    return {
      added: false,
      cart,
      error: "This product is out of stock",
    };
  }

  return {
    added: true,
    cart: [...cart, { ...product, product_id: product.id, quantity: 1 }],
  };
}

export function calculateCartSubtotal(cart, getPrice) {
  return cart.reduce(
    (subtotal, item) => subtotal + getPrice(item),
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
