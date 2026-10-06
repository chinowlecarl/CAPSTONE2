import { useApp } from "../../context/AppContext";

export function AdminLayout({ setPage, children }) {
  const { logout } = useApp();
  return (
    <div style={{ minHeight: "100vh", background: "#fff5f7" }}>
      <header style={{ background: "linear-gradient(135deg, #1a1a1a, #2d1d2e)", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>FITCHEQUE</span>
          <span style={{ background: "#be185d", color: "#fff", fontSize: 9, fontWeight: 800, padding: "3px 10px", borderRadius: 20, letterSpacing: 1 }}>ADMIN</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setPage("home")} style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "rgba(255,255,255,0.7)", fontSize: 12, padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}>View Store</button>
          <button onClick={() => { logout(); setPage("login"); }} style={{ background: "#be185d", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, padding: "6px 14px", cursor: "pointer", fontWeight: 700 }}>Logout</button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
