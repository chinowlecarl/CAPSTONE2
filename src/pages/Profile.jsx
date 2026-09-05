import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { apiFetch, fmt, salePrice } from "../utils/api";

const STATUS_STYLES = {
  pending:   { bg: "#fef9c3", color: "#854d0e", label: "⏳ Pending" },
  confirmed: { bg: "#dbeafe", color: "#1e40af", label: "✅ Confirmed" },
  shipped:   { bg: "#ede9fe", color: "#6d28d9", label: "🚚 Shipped" },
  delivered: { bg: "#dcfce7", color: "#166534", label: "📦 Delivered" },
  cancelled: { bg: "#fee2e2", color: "#991b1b", label: "❌ Cancelled" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { bg: "#f3f4f6", color: "#374151", label: status };
  return (
    <span style={{
      display: "inline-block",
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 800,
      padding: "4px 12px", borderRadius: 20,
      letterSpacing: 0.5,
    }}>{s.label}</span>
  );
}

function OrderCard({ order }) {
  const [open, setOpen] = useState(false);
  const date = new Date(order.created_at).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
  });

  return (
    <div style={{
      border: "1px solid #fce7f3", borderRadius: 14,
      overflow: "hidden", marginBottom: 14,
      boxShadow: "0 2px 10px rgba(190,24,93,0.05)",
    }}>
      {/* Order header row */}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", background: "#fff", cursor: "pointer",
          flexWrap: "wrap", gap: 10,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: "#aaa", fontWeight: 700, letterSpacing: 1 }}>
            ORDER ID
          </span>
          <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#be185d" }}>
            #{order.id.slice(0, 8).toUpperCase()}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3, textAlign: "center" }}>
          <span style={{ fontSize: 11, color: "#aaa", fontWeight: 700, letterSpacing: 1 }}>DATE</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{date}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3, textAlign: "center" }}>
          <span style={{ fontSize: 11, color: "#aaa", fontWeight: 700, letterSpacing: 1 }}>TOTAL</span>
          <span style={{ fontSize: 14, fontWeight: 900, color: "#be185d" }}>{fmt(order.total_amount)}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusBadge status={order.status} />
          <span style={{ fontSize: 18, color: "#be185d", transition: "transform .2s", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
            ▾
          </span>
        </div>
      </div>

      {/* Expandable order details */}
      {open && (
        <div style={{ borderTop: "1px solid #fce7f3", background: "#fff5f7", padding: "16px 18px" }}>

          {/* Shipping info */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: "#be185d", letterSpacing: 1.5, margin: "0 0 6px" }}>
              SHIPPING ADDRESS
            </p>
            <p style={{ fontSize: 13, color: "#555", margin: 0 }}>{order.shipping_address || "—"}</p>
          </div>

          {/* Items list */}
          <p style={{ fontSize: 10, fontWeight: 800, color: "#be185d", letterSpacing: 1.5, margin: "0 0 10px" }}>
            ITEMS ORDERED
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {order.order_items?.map((item, idx) => {
              const product = item.products || {};
              const imgUrl  = product.image_url || `https://placehold.co/52/fce7f3/be185d?text=?`;
              const title   = product.title || "Unknown Product";
              const price   = item.unit_price ?? salePrice(product.price, product.discount);
              return (
                <div key={item.id || idx} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: "#fff", borderRadius: 10,
                  padding: "10px 14px", border: "1px solid #fce7f3",
                }}>
                  <img
                    src={imgUrl} alt={title}
                    onError={(e) => (e.target.src = "https://placehold.co/52/fce7f3/be185d?text=?")}
                    style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, flexShrink: 0, border: "1px solid #fce7f3" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {title}
                    </p>
                    <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>
                      Qty: <strong style={{ color: "#555" }}>{item.quantity}</strong>
                      &nbsp;·&nbsp;{fmt(price)} each
                    </p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#be185d", flexShrink: 0 }}>
                    {fmt(price * item.quantity)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Total row */}
          <div style={{
            display: "flex", justifyContent: "flex-end", alignItems: "center",
            marginTop: 14, paddingTop: 12, borderTop: "1px dashed #fce7f3",
          }}>
            <span style={{ fontSize: 13, color: "#888", marginRight: 12 }}>Order Total</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#be185d" }}>{fmt(order.total_amount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Profile({ setPage }) {
  const { user, logout, updateProfile, toast } = useApp();

  const [activeTab, setActiveTab] = useState("profile"); // "profile" | "orders"
  const [edit, setEdit]           = useState(false);
  const [form, setForm]           = useState({
    fullname: user?.fullname || "",
    phone:    user?.phone    || "",
    address:  user?.address  || "",
  });
  const [loading, setLoading]     = useState(false);

  const [orders, setOrders]       = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError]     = useState(null);

  useEffect(() => {
    if (activeTab === "orders" && user) {
      setOrdersLoading(true);
      setOrdersError(null);
      apiFetch("/orders")
        .then(setOrders)
        .catch((err) => setOrdersError(err.message))
        .finally(() => setOrdersLoading(false));
    }
  }, [activeTab, user]);

  if (!user) return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <p style={{ color: "#be185d" }}>Please login to view your profile.</p>
      <button onClick={() => setPage("login")} style={{ background: "linear-gradient(135deg, #f9a8d4, #be185d)", border: "none", borderRadius: 20, color: "#fff", fontWeight: 700, padding: "10px 28px", cursor: "pointer", marginTop: 12 }}>LOGIN</button>
    </div>
  );

  const save = async () => {
    setLoading(true);
    try { await updateProfile(form); setEdit(false); }
    catch (err) { toast(err.message, "error"); }
    setLoading(false);
  };

  const tabStyle = (tab) => ({
    flex: 1, padding: "12px 0", border: "none", cursor: "pointer",
    fontSize: 12, fontWeight: 800, letterSpacing: 1,
    textTransform: "uppercase",
    background: activeTab === tab ? "#fff" : "transparent",
    color: activeTab === tab ? "#be185d" : "#aaa",
    borderBottom: activeTab === tab ? "2.5px solid #be185d" : "2.5px solid transparent",
    transition: "all .2s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#fff5f7" }}>
      {/* Top bar */}
      <div style={{ background: "linear-gradient(135deg, #fce7f3, #fbcfe8)", padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setPage("home")} style={{ background: "none", border: "none", cursor: "pointer", color: "#be185d", fontSize: 20, fontWeight: 700 }}>←</button>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a", margin: 0, letterSpacing: 1 }}>MY ACCOUNT</h2>
      </div>

      <div style={{ maxWidth: 660, margin: "32px auto", padding: "0 20px" }}>

        {/* Avatar card */}
        <div style={{ background: "linear-gradient(135deg, #fce7f3, #f9a8d4)", borderRadius: 20, padding: "32px 24px", textAlign: "center", marginBottom: 20, border: "1px solid #fce7f3", boxShadow: "0 4px 24px rgba(190,24,93,0.08)" }}>
          <div style={{ width: 82, height: 82, borderRadius: "50%", margin: "0 auto 14px", background: "linear-gradient(135deg, #f9a8d4, #be185d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 900, color: "#fff", border: "4px solid #fff", boxShadow: "0 4px 16px rgba(190,24,93,0.25)" }}>
            {user.fullname?.charAt(0).toUpperCase()}
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a", margin: "0 0 3px" }}>{user.fullname}</h2>
          <p style={{ color: "#db2777", fontSize: 12, fontWeight: 600, letterSpacing: 1, margin: "0 0 8px", textTransform: "uppercase" }}>{user.username}</p>
          <span style={{ display: "inline-block", background: user.role === "admin" ? "#be185d" : "#f9a8d4", color: user.role === "admin" ? "#fff" : "#be185d", fontSize: 10, fontWeight: 800, padding: "4px 14px", borderRadius: 20, letterSpacing: 1 }}>
            {user.role?.toUpperCase()}
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "#fff", borderRadius: 12, border: "1px solid #fce7f3", marginBottom: 20, overflow: "hidden" }}>
          <button style={tabStyle("profile")} onClick={() => setActiveTab("profile")}>👤 Profile</button>
          <button style={tabStyle("orders")}  onClick={() => setActiveTab("orders")}>📦 My Orders</button>
        </div>

        {/* ── PROFILE TAB ── */}
        {activeTab === "profile" && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #fce7f3", boxShadow: "0 2px 16px rgba(190,24,93,0.06)", padding: 24 }}>
            {edit ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[["Full Name", "fullname", "text"], ["Phone Number", "phone", "tel"], ["Address", "address", "text"]].map(([label, key, type]) => (
                  <div key={key}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#888", letterSpacing: 1.5, marginBottom: 6 }}>{label.toUpperCase()}</label>
                    <input
                      type={type}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #fce7f3", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff5f7", boxSizing: "border-box" }}
                      onFocus={(e) => (e.target.style.borderColor = "#db2777")}
                      onBlur={(e)  => (e.target.style.borderColor = "#fce7f3")}
                    />
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button onClick={save} disabled={loading} style={{ flex: 1, background: "linear-gradient(135deg, #f9a8d4, #be185d)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 13, padding: "12px 0", cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
                    {loading ? "SAVING..." : "SAVE CHANGES"}
                  </button>
                  <button onClick={() => setEdit(false)} style={{ flex: 1, background: "#fff", border: "1.5px solid #fce7f3", borderRadius: 10, color: "#be185d", fontWeight: 700, fontSize: 13, padding: "12px 0", cursor: "pointer" }}>CANCEL</button>
                </div>
              </div>
            ) : (
              <div>
                {[["EMAIL", user.email], ["PHONE NUMBER", user.phone || "Not set"], ["ADDRESS", user.address || "Not set"]].map(([label, val]) => (
                  <div key={label} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid #fce7f3" }}>
                    <p style={{ color: "#aaa", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, margin: "0 0 5px" }}>{label}</p>
                    <p style={{ color: val === "Not set" ? "#ddd" : "#333", fontSize: 14, fontWeight: 600, margin: 0 }}>{val}</p>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button onClick={() => setEdit(true)} style={{ flex: 1, background: "linear-gradient(135deg, #f9a8d4, #be185d)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 13, padding: "12px 0", cursor: "pointer" }}>EDIT PROFILE</button>
                  <button onClick={() => { logout(); setPage("home"); }} style={{ flex: 1, background: "#fff", border: "1.5px solid #fce7f3", borderRadius: 10, color: "#be185d", fontWeight: 700, fontSize: 13, padding: "12px 0", cursor: "pointer" }}>LOGOUT</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {activeTab === "orders" && (
          <div>
            {ordersLoading && (
              <div style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
                <p style={{ color: "#be185d", fontWeight: 600 }}>Loading your orders...</p>
              </div>
            )}

            {ordersError && (
              <div style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
                <p style={{ color: "#be185d", fontWeight: 600 }}>{ordersError}</p>
                <button
                  onClick={() => setActiveTab("orders")}
                  style={{ background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, padding: "10px 24px", cursor: "pointer", marginTop: 10 }}
                >
                  RETRY
                </button>
              </div>
            )}

            {!ordersLoading && !ordersError && orders.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 24px", background: "#fff", borderRadius: 16, border: "1px solid #fce7f3" }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>🛍️</div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#be185d", margin: "0 0 8px" }}>No orders yet</h3>
                <p style={{ color: "#aaa", fontSize: 13, margin: "0 0 20px" }}>Start shopping to see your orders here!</p>
                <button onClick={() => setPage("products")} style={{ background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, padding: "10px 28px", cursor: "pointer" }}>
                  SHOP NOW
                </button>
              </div>
            )}

            {!ordersLoading && !ordersError && orders.length > 0 && (
              <div>
                <p style={{ fontSize: 12, color: "#aaa", fontWeight: 600, margin: "0 0 14px", letterSpacing: 0.5 }}>
                  {orders.length} order{orders.length !== 1 ? "s" : ""} found — tap any order to expand
                </p>
                {orders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}