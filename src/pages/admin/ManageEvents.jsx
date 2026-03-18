import { useState, useEffect } from "react";
import { apiFetch } from "../../utils/api";
import { useApp } from "../../context/AppContext";

const STATUS_COLORS = {
  pending:   { bg: "#fffbeb", color: "#f59e0b", border: "#fde68a" },
  confirmed: { bg: "#eff6ff", color: "#3b82f6", border: "#bfdbfe" },
  shipped:   { bg: "#f0fdf4", color: "#22c55e", border: "#bbf7d0" },
  delivered: { bg: "#f5f3ff", color: "#8b5cf6", border: "#ddd6fe" },
  cancelled: { bg: "#fff5f7", color: "#be185d", border: "#fce7f3" },
};

export default function ManageEvents({ setPage }) {
  const { user } = useApp();
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("all");
  const [search, setSearch]   = useState("");
  const [msg, setMsg]         = useState(null);

  const showMsg = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    apiFetch("/admin/orders")
      .then((data) => { setOrders(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const updateStatus = async (orderId, status) => {
    try {
      await apiFetch(`/admin/orders/${orderId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
      showMsg("Order status updated!");
    } catch (err) {
      showMsg(err.message, "error");
    }
  };

  const filtered = orders.filter((o) => {
    const matchFilter = filter === "all" || o.status === filter;
    const matchSearch =
      !search ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      (o.users?.fullname || "").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = ["pending","confirmed","shipped","delivered","cancelled"].reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {});

  if (!user || user.role !== "admin") return null;

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: "0 0 4px" }}>Manage Orders</h1>
        <p style={{ color: "#aaa", fontSize: 13 }}>Track and update order fulfilment status</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 24 }}>
        {Object.entries(counts).map(([status, count]) => {
          const c = STATUS_COLORS[status];
          return (
            <button key={status} onClick={() => setFilter(filter === status ? "all" : status)}
              style={{ background: filter === status ? c.bg : "#fff", border: `1.5px solid ${filter === status ? c.border : "#fce7f3"}`, borderRadius: 12, padding: "14px 10px", cursor: "pointer", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: c.color }}>{count}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>{status}</div>
            </button>
          );
        })}
      </div>

      {msg && (
        <div style={{ borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, background: msg.type === "success" ? "#f0fdf4" : "#fff5f7", borderLeft: `4px solid ${msg.type === "success" ? "#22c55e" : "#be185d"}`, color: msg.type === "success" ? "#16a34a" : "#be185d" }}>
          {msg.type === "success" ? "✓" : "✗"} {msg.text}
        </div>
      )}

      <div style={{ position: "relative", marginBottom: 20, maxWidth: 360 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#db2777" }}>🔍</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order ID or customer..."
          style={{ width: "100%", paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, border: "1.5px solid #fce7f3", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff5f7", boxSizing: "border-box" }} />
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #fce7f3", overflow: "hidden", boxShadow: "0 2px 16px rgba(190,24,93,0.06)" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ width: 36, height: 36, border: "4px solid #fce7f3", borderTopColor: "#be185d", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "#ccc" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <p style={{ fontWeight: 600 }}>No orders found</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "linear-gradient(135deg, #fce7f3, #fbcfe8)" }}>
                  {["Order ID", "Customer", "Items", "Total", "Date", "Status", "Update"].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#be185d", letterSpacing: 1.2, textTransform: "uppercase", borderBottom: "1.5px solid #fce7f3" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((order, i) => {
                  const c = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
                  return (
                    <tr key={order.id} style={{ borderBottom: "1px solid #fce7f3", background: i % 2 === 0 ? "#fff" : "#fff8fb" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fff5f7")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fff8fb")}>
                      <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 11, color: "#666" }}>#{order.id.slice(0,8).toUpperCase()}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 700, color: "#1a1a1a" }}>{order.users?.fullname || "Guest"}</div>
                        <div style={{ fontSize: 11, color: "#bbb" }}>{order.users?.email || ""}</div>
                      </td>
                      <td style={{ padding: "12px 14px", color: "#555" }}>{order.order_items?.length || 0} item{order.order_items?.length !== 1 ? "s" : ""}</td>
                      <td style={{ padding: "12px 14px", fontWeight: 800, color: "#be185d" }}>₱{Number(order.total_amount).toFixed(2)}</td>
                      <td style={{ padding: "12px 14px", color: "#888", fontSize: 12 }}>{new Date(order.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{order.status}</span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <select value={order.status} onChange={(e) => updateStatus(order.id, e.target.value)}
                          style={{ padding: "6px 10px", border: "1.5px solid #fce7f3", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#fff5f7", color: "#be185d", cursor: "pointer", outline: "none" }}>
                          {["pending","confirmed","shipped","delivered","cancelled"].map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
