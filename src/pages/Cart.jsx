import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { apiFetch, fmt, salePrice } from "../utils/api";
import { calculateCartTotals } from "../utils/cart.mjs";
import { formatVariantSelection } from "../utils/productVariants.mjs";
import { canResumePendingOrder } from "../utils/checkout.mjs";

export default function Cart({ setPage }) {
  const { cart, removeFromCart, user, toast, setCheckoutResume } = useApp();
  const [pendingOrders, setPendingOrders] = useState([]);
  const [ordersError, setOrdersError] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [resumingId, setResumingId] = useState(null);

  const loadPendingOrders = async () => {
    if (!user) return;
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const orders = await apiFetch("/orders");
      setPendingOrders(orders.filter(canResumePendingOrder));
    } catch (error) {
      setOrdersError(error.message || "Could not load pending orders.");
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadPendingOrders();
  }, [user?.id]);

  const resumeOrder = async (order) => {
    setResumingId(order.id);
    try {
      const items = await apiFetch(`/orders/${order.id}/items`);
      if (!items.length) throw new Error("This order has no items to resume.");
      setCheckoutResume({ order, items });
      setPage("checkout");
    } catch (error) {
      toast(error.message || "Could not resume this order.", "error");
    } finally {
      setResumingId(null);
    }
  };

  const getPrice = (item) => {
    const p = item.products || item;
    return salePrice(p.price, p.discount);
  };
  const getName = (item) => item.products?.title || item.title;
  const getImg = (item) => item.products?.image_url || item.image_url;
  const getCat = (item) => item.products?.category || item.category;
  const getStock = (item) => Number(item.products?.stock ?? item.stock) || 0;

  const hasUnavailableItem = cart.some((item) => getStock(item) === 0);

  const { subtotal, shipping, tax, total } = calculateCartTotals(cart, getPrice);

  return (
    <div style={{ background: "#fff5f7", minHeight: "100vh" }}>
      <div style={{ background: "linear-gradient(135deg, #fce7f3, #fbcfe8)", padding: "28px 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#1a1a1a", margin: 0, letterSpacing: 2 }}>SHOPPING CART</h1>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", display: "grid", gridTemplateColumns: cart.length > 0 ? "1fr 340px" : "1fr", gap: 24 }}>
        <div>
          {ordersError && (
            <div role="alert" style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 12, padding: 14, marginBottom: 16, color: "#b91c1c", fontSize: 13 }}>
              Could not check for pending orders: {ordersError}
              <button onClick={loadPendingOrders} disabled={ordersLoading} style={{ marginLeft: 10, border: 0, background: "none", color: "#be185d", fontWeight: 700, cursor: "pointer" }}>
                {ordersLoading ? "Retrying..." : "Retry"}
              </button>
            </div>
          )}
          {pendingOrders.map((order) => (
            <div key={order.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", background: "#fff", border: "1px solid #f9a8d4", borderRadius: 14, padding: "16px 18px", marginBottom: 16, boxShadow: "0 2px 10px rgba(190,24,93,0.06)" }}>
              <div>
                <p style={{ color: "#be185d", fontSize: 10, fontWeight: 800, letterSpacing: 1.2, margin: "0 0 5px" }}>PAYMENT NOT COMPLETED</p>
                <p style={{ color: "#333", fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>
                  Order #{order.id.slice(0, 8).toUpperCase()} is awaiting payment
                </p>
                <p style={{ color: "#888", fontSize: 12, margin: 0 }}>
                  {fmt(order.total_amount)} · Resume without creating another order.
                </p>
              </div>
              <button
                onClick={() => resumeOrder(order)}
                disabled={!!resumingId}
                style={{ background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 12, letterSpacing: 0.6, padding: "11px 18px", cursor: resumingId ? "wait" : "pointer", opacity: resumingId && resumingId !== order.id ? 0.6 : 1 }}
              >
                {resumingId === order.id ? "LOADING..." : "RESUME ORDER"}
              </button>
            </div>
          ))}
          {cart.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 16, padding: "60px 24px", textAlign: "center", border: "1px solid #fce7f3" }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#be185d", marginBottom: 8 }}>Your cart is empty</h3>
              <p style={{ color: "#aaa", marginBottom: 24 }}>Start adding some beautiful pieces!</p>
              <button onClick={() => setPage("products")} style={{ background: "linear-gradient(135deg, #f9a8d4, #be185d)", color: "#fff", border: "none", borderRadius: 24, padding: "12px 32px", fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: 1 }}>BROWSE PRODUCTS</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {cart.map((item, idx) => {
                const soldOut = getStock(item) === 0;
                const cartItemId = item.id || item.product_id;
                return (
                  <div key={item.id || idx} style={{ background: "#fff", borderRadius: 14, padding: 16, display: "flex", gap: 16, alignItems: "center", border: soldOut ? "1.5px solid #fecaca" : "1px solid #fce7f3", boxShadow: "0 2px 8px rgba(190,24,93,0.05)", opacity: soldOut ? 0.7 : 1 }}>
                    <img src={getImg(item)} alt={getName(item)} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10, flexShrink: 0, filter: soldOut ? "grayscale(1)" : "none" }} onError={(e) => (e.target.src = "https://via.placeholder.com/80/fce7f3/be185d?text=??")} />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#db2777", fontSize: 10, fontWeight: 700, letterSpacing: 1, margin: "0 0 3px", textTransform: "uppercase" }}>{getCat(item)}</p>
                      <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#1a1a1a", fontFamily: "'Playfair Display', serif" }}>{getName(item)}</h4>
                      {formatVariantSelection(item.variant_selection) && (
                        <p style={{ margin: "0 0 6px", color: "#777", fontSize: 12 }}>
                          {formatVariantSelection(item.variant_selection)}
                        </p>
                      )}
                      {soldOut && (
                        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: "#ef4444" }}>
                          No longer available — please remove
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", minWidth: 80 }}>
                      <div style={{ fontWeight: 800, color: "#1a1a1a", marginBottom: 6 }}>{fmt(getPrice(item))}</div>
                      <button onClick={() => removeFromCart(item.id || item.product_id)} style={{ background: "none", border: "none", color: "#f9a8d4", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Remove</button>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setPage("products")} style={{ background: "none", border: "1.5px solid #fce7f3", borderRadius: 10, color: "#be185d", fontWeight: 700, fontSize: 12, padding: "10px 20px", cursor: "pointer", alignSelf: "flex-start", letterSpacing: 0.8 }}>← CONTINUE SHOPPING</button>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #fce7f3", height: "fit-content", boxShadow: "0 4px 20px rgba(190,24,93,0.08)" }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#1a1a1a", margin: "0 0 20px", paddingBottom: 14, borderBottom: "1.5px solid #fce7f3" }}>ORDER SUMMARY</h3>
            {[["Subtotal", fmt(subtotal)], ["Shipping", shipping === 0 ? "FREE" : fmt(shipping)], ["Tax (12%)", fmt(tax)]].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 13, color: "#666" }}>
                <span>{label}</span>
                <span style={{ fontWeight: 600, color: label === "Shipping" && shipping === 0 ? "#22c55e" : "#333" }}>{val}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 900, color: "#1a1a1a", borderTop: "2px solid #fce7f3", paddingTop: 14, marginTop: 8 }}>
              <span>TOTAL</span>
              <span style={{ color: "#be185d" }}>{fmt(total)}</span>
            </div>
            {hasUnavailableItem && (
              <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: "#ef4444", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px" }}>
                Remove unavailable items to continue
              </div>
            )}
            <button
              onClick={() => user ? setPage("checkout") : setPage("login")}
              disabled={hasUnavailableItem}
              style={{ width: "100%", background: hasUnavailableItem ? "#e5e5e5" : "linear-gradient(135deg, #f9a8d4 0%, #be185d 100%)", border: "none", borderRadius: 10, color: hasUnavailableItem ? "#999" : "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 1, padding: "14px 0", cursor: hasUnavailableItem ? "not-allowed" : "pointer", marginTop: 20 }}
            >
              {hasUnavailableItem ? "REMOVE UNAVAILABLE ITEMS" : user ? "PROCEED TO CHECKOUT" : "LOGIN TO CHECKOUT"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}