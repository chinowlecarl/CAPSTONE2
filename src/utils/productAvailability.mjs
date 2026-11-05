export function getProductAvailability(product, now = Date.now()) {
  const outOfStock = !Number.isInteger(Number(product.stock)) || Number(product.stock) <= 0;
  if (!outOfStock) return { available: true, paymentPending: false };

  const reservedUntil = Date.parse(product.reserved_until);
  if (Number.isFinite(reservedUntil) && reservedUntil > now) {
    return { available: false, paymentPending: true };
  }
  if (Number.isFinite(reservedUntil) && reservedUntil <= now) {
    return { available: true, paymentPending: false, reservationExpired: true };
  }
  return { available: false, paymentPending: false };
}
