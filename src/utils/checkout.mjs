export function getCheckoutOrderRequest(orderId) {
  return orderId
    ? { path: `/orders/${orderId}/checkout`, method: "PUT" }
    : { path: "/orders", method: "POST" };
}

export function getPostCheckoutStep(payment) {
  return ["gcash", "maya"].includes(payment) ? 2.5 : 3;
}
