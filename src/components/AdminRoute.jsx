import { useApp } from "../../context/AppContext";

export function AdminRoute({ setPage, children }) {
  const { user } = useApp();

  if (!user || user.role !== "admin") {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#be185d" }}>Admin Access Required</h2>
        <button
          onClick={() => setPage("login")}
          style={{ background: "linear-gradient(135deg, #f9a8d4, #be185d)", border: "none", borderRadius: 20, color: "#fff", fontWeight: 700, padding: "10px 28px", cursor: "pointer", marginTop: 16 }}
        >
          LOGIN AS ADMIN
        </button>
      </div>
    );
  }

  return children;
}
