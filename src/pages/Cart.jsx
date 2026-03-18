import { useApp } from "../context/AppContext";
import { fmt, salePrice } from "../utils/api";

export default function Cart({ setPage }) {
  const { cart, removeFromCart, updateQty, user } = useApp();

  const getPrice = (item) => {
    const p = item.products || item;
    return salePrice(p.price, p.discount);
  };
  const getName = (item) => item.products?.title || item.title;
  const getImg = (item) => item.products?.image_url || item.image_url;
  const getCat = (item) => item.products?.category || item.category;

  const subtotal = cart.reduce((s, i) => s + getPrice(i) * i.quantity, 0);
  const shipping = subtotal > 500 ? 0 : 80;
  const tax = subtotal * 0.12;
  const total = subtotal + shipping + tax;

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
              {cart.map((item, idx) => (
                <div key={item.id || idx} style={{ background: "#fff", borderRadius: 14, padding: 16, display: "flex", gap: 16, alignItems: "center", border: "1px solid #fce7f3", boxShadow: "0 2px 8px rgba(190,24,93,0.05)" }}>
                  <img src={getImg(item)} alt={getName(item)} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} onError={(e) => (e.target.src = "https://via.placeholder.com/80/fce7f3/be185d?text=??")} />
                  <div style={{ flex: 1 }}>
                    <p style={{ color: "#db2777", fontSize: 10, fontWeight: 700, letterSpacing: 1, margin: "0 0 3px", textTransform: "uppercase" }}>{getCat(item)}</p>
                    <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#1a1a1a", fontFamily: "'Playfair Display', serif" }}>{getName(item)}</h4>
                    <span style={{ color: "#be185d", fontWeight: 800 }}>{fmt(getPrice(item))}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => updateQty(item.id || item.product_id, item.quantity - 1)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1.5px solid #fce7f3", background: "#fff5f7", cursor: "pointer", fontWeight: 800, color: "#be185d", fontSize: 16 }}>−</button>
                    <span style={{ fontWeight: 800, color: "#1a1a1a", width: 24, textAlign: "center" }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.id || item.product_id, item.quantity + 1)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1.5px solid #fce7f3", background: "#fff5f7", cursor: "pointer", fontWeight: 800, color: "#be185d", fontSize: 16 }}>+</button>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 80 }}>
                    <div style={{ fontWeight: 800, color: "#1a1a1a", marginBottom: 6 }}>{fmt(getPrice(item) * item.quantity)}</div>
                    <button onClick={() => removeFromCart(item.id || item.product_id)} style={{ background: "none", border: "none", color: "#f9a8d4", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Remove</button>
                  </div>
                </div>
              ))}
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
            <button
              onClick={() => !user && setPage("login")}
              style={{ width: "100%", background: "linear-gradient(135deg, #f9a8d4 0%, #be185d 100%)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 1, padding: "14px 0", cursor: "pointer", marginTop: 20 }}
            >
              {user ? "PROCEED TO CHECKOUT" : "LOGIN TO CHECKOUT"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
