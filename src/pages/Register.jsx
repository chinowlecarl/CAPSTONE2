import { useState } from "react";
import { useApp } from "../context/AppContext";

export default function Register({ setPage }) {
  const { registerUser } = useApp();
  const [form, setForm] = useState({ fullname: "", username: "", email: "", password: "", confirm: "", phone: "", address: "" });
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pw = form.password;
  const pwReqs = [
    { ok: pw.length >= 6, label: "At least 6 characters" },
    { ok: /[A-Z]/.test(pw), label: "One uppercase letter" },
    { ok: /[0-9]/.test(pw), label: "One number" },
  ];

  const handleSubmit = async () => {
    const errs = [];
    if (!form.fullname) errs.push("Full name is required");
    if (form.username.length < 3) errs.push("Username must be at least 3 characters");
    if (!form.email.includes("@")) errs.push("Valid email is required");
    if (!pwReqs.every((r) => r.ok)) errs.push("Password does not meet requirements");
    if (form.password !== form.confirm) errs.push("Passwords do not match");
    setErrors(errs);
    if (errs.length > 0) return;
    setLoading(true);
    try {
      await registerUser(form);
      setPage("home");
    } catch (err) {
      setErrors([err.message]);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#fff" }}>
      {/* Left panel */}
      <div style={{ flex: 1, background: "linear-gradient(160deg, #fce7f3 0%, #fbcfe8 40%, #f9a8d4 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.12, backgroundImage: "url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=60')", backgroundSize: "cover" }} />
        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 52, fontWeight: 900, color: "#be185d", letterSpacing: 4 }}>FITCHEQUE</div>
          <div style={{ color: "#db2777", fontSize: 14, fontWeight: 500, letterSpacing: 3 }}>Join Our Community</div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ width: 480, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 40px", background: "#fff", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "#1a1a1a", letterSpacing: 2, marginBottom: 4 }}>FITCHEQUE</div>
          <p style={{ color: "#aaa", fontSize: 13, marginBottom: 24 }}>Create your account</p>

          {errors.length > 0 && (
            <div style={{ background: "#fff5f7", border: "1px solid #fce7f3", borderLeft: "4px solid #be185d", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
              {errors.map((e, i) => (
                <p key={i} style={{ color: "#be185d", fontSize: 12, fontWeight: 600, margin: "2px 0" }}>⚠ {e}</p>
              ))}
            </div>
          )}

          <div style={{ background: "#fff5f7", borderRadius: 10, padding: "10px 14px", marginBottom: 20, border: "1px solid #fce7f3" }}>
            <p style={{ color: "#db2777", fontSize: 10, fontWeight: 800, letterSpacing: 1, margin: "0 0 6px" }}>PASSWORD REQUIREMENTS</p>
            {pwReqs.map((r) => (
              <p key={r.label} style={{ fontSize: 11, margin: "3px 0", color: r.ok ? "#22c55e" : "#ccc", fontWeight: r.ok ? 700 : 400 }}>
                {r.ok ? "✓" : "○"} {r.label}
              </p>
            ))}
          </div>

          {[["EMAIL", "email", "email"], ["USERNAME", "username", "text"], ["FULL NAME", "fullname", "text"], ["PHONE", "phone", "tel"], ["PASSWORD", "password", "password"], ["CONFIRM PASSWORD", "confirm", "password"]].map(([label, key, type]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#888", letterSpacing: 1.5, marginBottom: 6 }}>{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={sf(key)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #fce7f3", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff5f7", boxSizing: "border-box" }}
                onFocus={(e) => (e.target.style.borderColor = "#db2777")}
                onBlur={(e) => (e.target.style.borderColor = "#fce7f3")}
              />
              {key === "confirm" && form.confirm && (
                <p style={{ fontSize: 11, margin: "4px 0 0", color: form.password === form.confirm ? "#22c55e" : "#be185d", fontWeight: 600 }}>
                  {form.password === form.confirm ? "✓ Passwords match" : "✗ Do not match"}
                </p>
              )}
            </div>
          ))}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#888", letterSpacing: 1.5, marginBottom: 6 }}>ADDRESS</label>
            <textarea
              value={form.address}
              onChange={sf("address")}
              rows={2}
              style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #fce7f3", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff5f7", boxSizing: "border-box", resize: "none" }}
              onFocus={(e) => (e.target.style.borderColor = "#db2777")}
              onBlur={(e) => (e.target.style.borderColor = "#fce7f3")}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: "100%", background: "linear-gradient(135deg, #f9a8d4 0%, #be185d 100%)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 1.5, padding: "13px 0", cursor: "pointer", marginTop: 8, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
          </button>

          <p style={{ textAlign: "center", color: "#aaa", fontSize: 12, marginTop: 20 }}>
            Already have an account?{" "}
            <button onClick={() => setPage("login")} style={{ background: "none", border: "none", color: "#be185d", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Login here</button>
          </p>
        </div>
      </div>
    </div>
  );
}
