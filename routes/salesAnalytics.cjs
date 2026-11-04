function buildBestSellersByCategory(orders) {
  const products = new Map();

  for (const order of orders) {
    if (order.payment_status !== "PAID" || order.status === "cancelled") continue;

    for (const item of order.order_items || []) {
      if (!item.product_id) continue;
      const category = item.products?.category || "Uncategorised";
      const key = `${category}\u0000${item.product_id}`;
      const product = products.get(key) || {
        id: item.product_id,
        title: item.products?.title || "Deleted product",
        category,
        units: 0,
        revenue: 0,
      };
      const quantity = Number(item.quantity) || 0;
      product.units += quantity;
      product.revenue += quantity * (Number(item.unit_price) || 0);
      products.set(key, product);
    }
  }

  const bestByCategory = new Map();
  for (const product of products.values()) {
    const currentBest = bestByCategory.get(product.category);
    if (
      !currentBest ||
      product.units > currentBest.units ||
      (product.units === currentBest.units && product.revenue > currentBest.revenue) ||
      (product.units === currentBest.units &&
        product.revenue === currentBest.revenue &&
        product.title.localeCompare(currentBest.title) < 0)
    ) {
      bestByCategory.set(product.category, product);
    }
  }

  return [...bestByCategory.values()]
    .sort((a, b) => a.category.localeCompare(b.category))
    .map((product) => ({
      ...product,
      revenue: Math.round(product.revenue * 100) / 100,
    }));
}

module.exports = { buildBestSellersByCategory };
