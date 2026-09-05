import { useState } from "react";
import { useApp } from "../context/AppContext";

export default function SignIn({ setPage }) {
  const { login } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    try {
      const user = await login(username, password);
      setPage(user.role === "admin" ? "admin" : "home");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden" }}>
      {/* Background photo + gradient */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=70')", backgroundSize: "cover", backgroundPosition: "center", zIndex: 0 }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(252,231,243,0.88) 0%, rgba(251,207,232,0.88) 40%, rgba(249,168,212,0.88) 100%)", zIndex: 1 }} />

      {/* Centered card */}
      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 380, background: "#fff", borderRadius: 20, boxShadow: "0 20px 60px rgba(190, 24, 93, 0.3)", padding: "48px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "#1a1a1a", letterSpacing: 2, marginBottom: 4 }}>FITCHEQUE</div>
          <p style={{ color: "#aaa", fontSize: 13 }}>Sign in to your account</p>
        </div>

        {error && (
          <div style={{ background: "#fff5f7", border: "1px solid #fce7f3", borderLeft: "4px solid #be185d", borderRadius: 8, padding: "10px 14px", color: "#be185d", fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
            ⚠ {error}
          </div>
        )}

        {[["USERNAME", username, setUsername, "text"], ["PASSWORD", password, setPassword, showPw ? "text" : "password"]].map(([label, val, setter, type]) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#888", letterSpacing: 1.5, marginBottom: 6 }}>{label}</label>
            <div style={{ position: "relative" }}>
              <input
                type={type}
                value={val}
                onChange={(e) => setter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                style={{ width: "100%", padding: "11px 40px 11px 14px", border: "1.5px solid #fce7f3", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff5f7", boxSizing: "border-box" }}
                onFocus={(e) => (e.target.style.borderColor = "#db2777")}
                onBlur={(e) => (e.target.style.borderColor = "#fce7f3")}
              />
              {label === "PASSWORD" && (
                <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#db2777", fontSize: 14 }}>
                  {showPw ? "🙈" : "👁"}
                </button>
              )}
            </div>
          </div>
        ))}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ width: "100%", background: "linear-gradient(135deg, #f9a8d4 0%, #be185d 100%)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 1.5, padding: "13px 0", cursor: "pointer", marginTop: 8, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "SIGNING IN..." : "LOG IN"}
        </button>

        <p style={{ textAlign: "center", color: "#aaa", fontSize: 12, marginTop: 24 }}>
          Don't have an account?{" "}
          <button onClick={() => setPage("signup")} style={{ background: "none", border: "none", color: "#be185d", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Sign up here</button>
        </p>
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button onClick={() => setPage("home")} style={{ background: "none", border: "none", color: "#ccc", fontSize: 12, cursor: "pointer" }}>← Back to store</button>
        </div>
      </div>
    </div>
  );
}