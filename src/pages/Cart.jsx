import { useApp } from "../context/AppContext";
import { fmt, salePrice } from "../utils/api";
import { calculateCartTotals } from "../utils/cart.mjs";

export default function Cart({ setPage }) {
  const { cart, removeFromCart, updateQty, updatingCartItems, user } = useApp();

  const getPrice = (item) => {
    const p = item.products || item;
    return salePrice(p.price, p.discount);
  };
  const getName = (item) => item.products?.title || item.title;
  const getImg = (item) => item.products?.image_url || item.image_url;
  const getCat = (item) => item.products?.category || item.category;
  const getStock = (item) => Number(item.products?.stock ?? item.stock) || 0;

  const hasUnavailableItem = cart.some((item) =>
    getStock(item) === 0 || Number(item.quantity) > getStock(item)
  );

  const { subtotal, shipping, tax, total } = calculateCartTotals(cart, getPrice);

  return (
    <div style={{ background: "#fff5f7", minHeight: "100vh" }}>
      <div style={{ background: "linear-gradient(135deg, #fce7f3, #fbcfe8)", padding: "28px 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#1a1a1a", margin: 0, letterSpacing: 2 }}>SHOPPING CART</h1>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", display: "grid", gridTemplateColumns: cart.length > 0 ? "1fr 340px" : "1fr", gap: 24 }}>
        <div>
          {cart.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 16, padding: "60px 24px", textAlign: "center", border: "1px solid #fce7f3" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🛍</div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#be185d", marginBottom: 8 }}>Your cart is empty</h3>
              <p style={{ color: "#aaa", marginBottom: 24 }}>Start adding some beautiful pieces!</p>
              <button onClick={() => setPage("products")} style={{ background: "linear-gradient(135deg, #f9a8d4, #be185d)", color: "#fff", border: "none", borderRadius: 24, padding: "12px 32px", fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: 1 }}>BROWSE PRODUCTS</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {cart.map((item, idx) => {
                const soldOut = getStock(item) === 0;
                const exceedsStock = Number(item.quantity) > getStock(item);
                const cartItemId = item.id || item.product_id;
                const updating = Boolean(updatingCartItems[String(cartItemId)]);
                return (
                  <div key={item.id || idx} style={{ background: "#fff", borderRadius: 14, padding: 16, display: "flex", gap: 16, alignItems: "center", border: soldOut ? "1.5px solid #fecaca" : "1px solid #fce7f3", boxShadow: "0 2px 8px rgba(190,24,93,0.05)", opacity: soldOut ? 0.7 : 1 }}>
                    <img src={getImg(item)} alt={getName(item)} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10, flexShrink: 0, filter: soldOut ? "grayscale(1)" : "none" }} onError={(e) => (e.target.src = "https://via.placeholder.com/80/fce7f3/be185d?text=??")} />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#db2777", fontSize: 10, fontWeight: 700, letterSpacing: 1, margin: "0 0 3px", textTransform: "uppercase" }}>{getCat(item)}</p>
                      <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#1a1a1a", fontFamily: "'Playfair Display', serif" }}>{getName(item)}</h4>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          aria-label={`Decrease ${getName(item)} quantity`}
                          onClick={() => Number(item.quantity) <= 1
                            ? removeFromCart(cartItemId)
                            : updateQty(cartItemId, Number(item.quantity) - 1)}
                          disabled={updating}
                          style={{ width: 28, height: 28, border: "1px solid #fce7f3", borderRadius: 7, background: "#fff", color: "#be185d", fontWeight: 800, cursor: updating ? "wait" : "pointer" }}
                        >−</button>
                        <span style={{ color: "#be185d", fontWeight: 800, minWidth: 62, textAlign: "center" }}>
                          {updating ? "Saving..." : `Qty: ${item.quantity}`}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase ${getName(item)} quantity`}
                          onClick={() => updateQty(cartItemId, Number(item.quantity) + 1)}
                          disabled={updating || soldOut || Number(item.quantity) >= getStock(item)}
                          style={{ width: 28, height: 28, border: "1px solid #fce7f3", borderRadius: 7, background: "#fff", color: "#be185d", fontWeight: 800, cursor: updating || soldOut || Number(item.quantity) >= getStock(item) ? "not-allowed" : "pointer" }}
                        >+</button>
                      </div>
                      {(soldOut || exceedsStock) && (
                        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: "#ef4444" }}>
                          ⚠ {soldOut ? "No longer available — please remove" : `Only ${getStock(item)} available — adjust quantity`}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", minWidth: 80 }}>
                      <div style={{ fontWeight: 800, color: "#1a1a1a", marginBottom: 6 }}>{fmt(getPrice(item) * Number(item.quantity || 0))}</div>
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
                ⚠ Adjust or remove unavailable items to continue
              </div>
            )}
            <button
              onClick={() => user ? setPage("checkout") : setPage("login")}
              disabled={hasUnavailableItem}
              style={{ width: "100%", background: hasUnavailableItem ? "#e5e5e5" : "linear-gradient(135deg, #f9a8d4 0%, #be185d 100%)", border: "none", borderRadius: 10, color: hasUnavailableItem ? "#999" : "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 1, padding: "14px 0", cursor: hasUnavailableItem ? "not-allowed" : "pointer", marginTop: 20 }}
            >
              {hasUnavailableItem ? "ADJUST CART QUANTITIES" : user ? "PROCEED TO CHECKOUT" : "LOGIN TO CHECKOUT"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}