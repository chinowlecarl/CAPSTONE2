import { useState, useEffect } from "react";
import { apiFetch } from "../../utils/api";
import { useApp } from "../../context/AppContext";

export default function EventDetails() {
  const { user } = useApp();
  const [customers, setCustomers] = useState([]);
  const [stats, setStats]         = useState({});
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [msg, setMsg]             = useState(null);

  const showMsg = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    Promise.all([apiFetch("/admin/users"), apiFetch("/admin/stats")])
      .then(([u, s]) => { setCustomers(u); setStats(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      await apiFetch(`/admin/users/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      setCustomers((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
      );
      showMsg(`User ${newStatus === "active" ? "activated" : "suspended"}!`);
    } catch (err) {
      showMsg(err.message, "error");
    }
  };

  const filtered = customers.filter((c) => {
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchSearch =
      !search ||
      c.fullname.toLowerCase().includes(search.toLowerCase()) ||
      c.username.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const admins    = customers.filter((c) => c.role === "admin").length;
  const active    = customers.filter((c) => c.status === "active").length;
  const suspended = customers.filter((c) => c.status === "suspended").length;

  if (!user || user.role !== "admin") return null;

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: "0 0 4px" }}>User Management</h1>
        <p style={{ color: "#aaa", fontSize: 13 }}>View and manage all registered users</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        {[
          ["👥", customers.length, "Total Users",  "#be185d"],
          ["✅", active,           "Active",        "#22c55e"],
          ["🚫", suspended,        "Suspended",     "#ef4444"],
          ["🛡",  admins,           "Admins",        "#8b5cf6"],
        ].map(([icon, val, label, color]) => (
          <div key={label} style={{ background: "#fff", borderRadius: 14, padding: "18px 16px", border: "1px solid #fce7f3", boxShadow: "0 2px 12px rgba(190,24,93,0.06)", textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color, marginBottom: 2 }}>{val}</div>
            <div style={{ color: "#888", fontSize: 11, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div style={{ borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, background: msg.type === "success" ? "#f0fdf4" : "#fff5f7", borderLeft: `4px solid ${msg.type === "success" ? "#22c55e" : "#be185d"}`, color: msg.type === "success" ? "#16a34a" : "#be185d" }}>
          {msg.type === "success" ? "✓" : "✗"} {msg.text}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#db2777" }}>🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
            style={{ width: "100%", paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, border: "1.5px solid #fce7f3", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff5f7", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["all","active","suspended"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: "8px 16px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", background: statusFilter === s ? "linear-gradient(135deg,#f9a8d4,#be185d)" : "#fff", color: statusFilter === s ? "#fff" : "#be185d", border: `1.5px solid ${statusFilter === s ? "transparent" : "#fce7f3"}` }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <span style={{ color: "#aaa", fontSize: 12, marginLeft: "auto" }}>{filtered.length} users</span>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #fce7f3", overflow: "hidden", boxShadow: "0 2px 16px rgba(190,24,93,0.06)" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ width: 36, height: 36, border: "4px solid #fce7f3", borderTopColor: "#be185d", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }} />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "linear-gradient(135deg,#fce7f3,#fbcfe8)" }}>
                  {["User", "Username", "Email", "Phone", "Role", "Status", "Joined", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#be185d", letterSpacing: 1.2, textTransform: "uppercase", borderBottom: "1.5px solid #fce7f3" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #fce7f3", background: i % 2 === 0 ? "#fff" : "#fff8fb" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fff5f7")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fff8fb")}>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#f9a8d4,#be185d)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                          {c.fullname?.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 700, color: "#1a1a1a" }}>{c.fullname}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#666" }}>@{c.username}</td>
                    <td style={{ padding: "10px 14px", color: "#666" }}>{c.email}</td>
                    <td style={{ padding: "10px 14px", color: "#888" }}>{c.phone || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 800, background: c.role === "admin" ? "#fdf4ff" : "#fff5f7", color: c.role === "admin" ? "#8b5cf6" : "#be185d", border: `1px solid ${c.role === "admin" ? "#e9d5ff" : "#fce7f3"}` }}>
                        {c.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 800, background: c.status === "active" ? "#f0fdf4" : "#fff5f5", color: c.status === "active" ? "#22c55e" : "#ef4444", border: `1px solid ${c.status === "active" ? "#bbf7d0" : "#fecaca"}` }}>
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#888", fontSize: 12 }}>
                      {new Date(c.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {c.role !== "admin" && (
                        <button onClick={() => toggleStatus(c.id, c.status)}
                          style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: c.status === "active" ? "#fff5f5" : "#f0fdf4", color: c.status === "active" ? "#ef4444" : "#22c55e", border: `1px solid ${c.status === "active" ? "#fecaca" : "#bbf7d0"}` }}>
                          {c.status === "active" ? "Suspend" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
