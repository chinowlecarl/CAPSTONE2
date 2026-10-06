import { useState } from "react";
import { useApp } from "../../context/AppContext";
import ManageProducts from "../ManageProducts";
import ManageEvents   from "../ManageEvents";
import CheckInDesk    from "../CheckInDesk";
import CreateEvent    from "../CreateEvent";
import EventDetails   from "../EventDetails";

const TABS = [
  { id: "products", label: "📦 Products",     icon: "📦" },
  { id: "add",      label: "➕ Add Product",  icon: "➕" },
  { id: "orders",   label: "🛍 Orders",       icon: "🛍" },
  { id: "users",    label: "👥 Users",         icon: "👥" },
  { id: "checkin",  label: "🔍 Check-In",     icon: "🔍" },
];

export default function AdminHome({ setPage }) {
  const { user, logout } = useApp();
  const [tab, setTab] = useState("products");

  if (!user || user.role !== "admin") return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#be185d" }}>Admin Access Required</h2>
      <button onClick={() => setPage("login")} style={{ background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 20, color: "#fff", fontWeight: 700, padding: "10px 28px", cursor: "pointer", marginTop: 16 }}>
        LOGIN AS ADMIN
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#fff5f7" }}>
      {/* Admin header */}
      <header style={{ background: "linear-gradient(135deg,#1a1a1a,#2d1d2e)", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>FITCHEQUE</span>
          <span style={{ background: "#be185d", color: "#fff", fontSize: 9, fontWeight: 800, padding: "3px 10px", borderRadius: 20, letterSpacing: 1 }}>ADMIN</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setPage("home")} style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "rgba(255,255,255,0.7)", fontSize: 12, padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}>
            View Store
          </button>
          <button onClick={() => { logout(); setPage("login"); }} style={{ background: "#be185d", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, padding: "6px 14px", cursor: "pointer", fontWeight: 700 }}>
            Logout
          </button>
        </div>
      </header>

      {/* Tab nav */}
      <div style={{ background: "#fff", borderBottom: "2px solid #fce7f3", padding: "0 24px", display: "flex", gap: 0, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "14px 18px", fontSize: 12, fontWeight: 700, letterSpacing: 0.8, whiteSpace: "nowrap", color: tab === t.id ? "#be185d" : "#888", borderBottom: tab === t.id ? "3px solid #be185d" : "3px solid transparent", transition: "all .2s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "products" && <ManageProducts setPage={setPage} />}
        {tab === "add"      && <CreateEvent    setPage={setPage} />}
        {tab === "orders"   && <ManageEvents   setPage={setPage} />}
        {tab === "users"    && <EventDetails   setPage={setPage} />}
        {tab === "checkin"  && <CheckInDesk    setPage={setPage} />}
      </div>
    </div>
  );
}
