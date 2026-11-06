export function getCheckoutOrderRequest(orderId) {
  return orderId
    ? { path: `/orders/${orderId}/checkout`, method: "PUT" }
    : { path: "/orders", method: "POST" };
}

export function getPostCheckoutStep(payment) {
  return ["gcash", "maya"].includes(payment) ? 2.5 : 3;
}

export function canResumePendingOrder(order) {
  return order?.status === "pending" &&
    order.payment_status === "PENDING" &&
    ["GCASH", "MAYA"].includes(order.payment_method);
}
