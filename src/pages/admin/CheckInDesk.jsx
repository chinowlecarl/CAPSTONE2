import { useState, useEffect } from "react";
import { apiFetch } from "../../utils/api";
import { useApp } from "../../context/AppContext";

export default function CheckInDesk() {
  const { user } = useApp();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState(null);
  const [orders, setOrders]       = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    apiFetch("/admin/users")
      .then((data) => { setCustomers(data.filter(u => u.role === "customer")); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const selectCustomer = async (customer) => {
    setSelected(customer);
    setLoadingOrders(true);
    try {
      const data = await apiFetch(`/admin/users/${customer.id}/orders`);
      setOrders(data);
    } catch {
      setOrders([]);
    }
    setLoadingOrders(false);
  };

  const filtered = customers.filter((c) =>
    !search ||
    c.fullname.toLowerCase().includes(search.toLowerCase()) ||
    c.username.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  if (!user || user.role !== "admin") return null;

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: "0 0 4px" }}>Customer Check-In Desk</h1>
        <p style={{ color: "#aaa", fontSize: 13 }}>Look up customers and their order history</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20 }}>
        {/* Left: customer list */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #fce7f3", overflow: "hidden", boxShadow: "0 2px 16px rgba(190,24,93,0.06)" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1.5px solid #fce7f3", background: "linear-gradient(135deg,#fce7f3,#fbcfe8)" }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#be185d", letterSpacing: 1.2, textTransform: "uppercase", margin: "0 0 10px" }}>Customers ({filtered.length})</p>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, username, email..."
              style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #fce7f3", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", boxSizing: "border-box" }} />
          </div>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ width: 30, height: 30, border: "3px solid #fce7f3", borderTopColor: "#be185d", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }} />
              </div>
            ) : filtered.length === 0 ? (
              <p style={{ color: "#ccc", textAlign: "center", padding: "30px 16px", fontSize: 13 }}>No customers found</p>
            ) : filtered.map((c) => (
              <button key={c.id} onClick={() => selectCustomer(c)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: selected?.id === c.id ? "#fff5f7" : "none", border: "none", borderBottom: "1px solid #fce7f3", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#f9a8d4,#be185d)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                  {c.fullname?.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "#1a1a1a", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.fullname}</div>
                  <div style={{ color: "#aaa", fontSize: 11 }}>@{c.username}</div>
                </div>
                {selected?.id === c.id && <span style={{ color: "#be185d", fontSize: 16 }}>›</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Right: selected customer detail */}
        <div>
          {!selected ? (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #fce7f3", padding: "60px 24px", textAlign: "center", color: "#ddd", boxShadow: "0 2px 16px rgba(190,24,93,0.06)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
              <p style={{ fontWeight: 600, fontSize: 14 }}>Select a customer to view details</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Profile card */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #fce7f3", overflow: "hidden", boxShadow: "0 2px 16px rgba(190,24,93,0.06)" }}>
                <div style={{ background: "linear-gradient(135deg,#fce7f3,#f9a8d4)", padding: "24px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg,#f9a8d4,#be185d)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 24, border: "3px solid #fff", boxShadow: "0 4px 12px rgba(190,24,93,0.25)" }}>
                    {selected.fullname?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a", margin: "0 0 2px" }}>{selected.fullname}</h2>
                    <p style={{ color: "#db2777", fontSize: 12, fontWeight: 600, margin: 0 }}>@{selected.username}</p>
                  </div>
                </div>
                <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  {[["Email", selected.email], ["Phone", selected.phone || "—"], ["Address", selected.address || "—"]].map(([label, val]) => (
                    <div key={label}>
                      <p style={{ color: "#aaa", fontSize: 10, fontWeight: 800, letterSpacing: 1.2, margin: "0 0 4px", textTransform: "uppercase" }}>{label}</p>
                      <p style={{ color: "#333", fontSize: 13, fontWeight: 600, margin: 0, wordBreak: "break-word" }}>{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Orders */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #fce7f3", overflow: "hidden", boxShadow: "0 2px 16px rgba(190,24,93,0.06)" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1.5px solid #fce7f3", background: "linear-gradient(135deg,#fce7f3,#fbcfe8)" }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: "#be185d", letterSpacing: 1.2, textTransform: "uppercase", margin: 0 }}>Order History ({orders.length})</p>
                </div>
                {loadingOrders ? (
                  <div style={{ textAlign: "center", padding: 30 }}>
                    <div style={{ width: 28, height: 28, border: "3px solid #fce7f3", borderTopColor: "#be185d", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }} />
                  </div>
                ) : orders.length === 0 ? (
                  <p style={{ color: "#ccc", textAlign: "center", padding: "24px 16px", fontSize: 13 }}>No orders yet</p>
                ) : orders.map((order, i) => (
                  <div key={order.id} style={{ padding: "14px 20px", borderBottom: i < orders.length - 1 ? "1px solid #fce7f3" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ fontFamily: "monospace", fontSize: 11, color: "#888", margin: "0 0 2px" }}>#{order.id.slice(0,8).toUpperCase()}</p>
                      <p style={{ fontSize: 12, color: "#555", margin: 0 }}>{new Date(order.created_at).toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"})}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontWeight: 800, color: "#be185d", margin: "0 0 4px" }}>₱{Number(order.total_amount).toFixed(2)}</p>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: "#fff5f7", color: "#be185d", border: "1px solid #fce7f3", textTransform: "uppercase" }}>{order.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
