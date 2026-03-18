import { useState } from "react";
import { useApp } from "../context/AppContext";

export default function Profile({ setPage }) {
  const { user, logout, updateProfile } = useApp();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ fullname: user?.fullname || "", phone: user?.phone || "", address: user?.address || "" });
  const [loading, setLoading] = useState(false);

  if (!user) return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <p style={{ color: "#be185d" }}>Please login to view your profile.</p>
      <button onClick={() => setPage("login")} style={{ background: "linear-gradient(135deg, #f9a8d4, #be185d)", border: "none", borderRadius: 20, color: "#fff", fontWeight: 700, padding: "10px 28px", cursor: "pointer", marginTop: 12 }}>LOGIN</button>
    </div>
  );

  const save = async () => {
    setLoading(true);
    try { await updateProfile(form); setEdit(false); }
    catch (err) { alert(err.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fff5f7" }}>
      <div style={{ background: "linear-gradient(135deg, #fce7f3, #fbcfe8)", padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setPage("home")} style={{ background: "none", border: "none", cursor: "pointer", color: "#be185d", fontSize: 20, fontWeight: 700 }}>←</button>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a", margin: 0, letterSpacing: 1 }}>MY PROFILE</h2>
      </div>

      <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 24px" }}>
        <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", border: "1px solid #fce7f3", boxShadow: "0 4px 24px rgba(190,24,93,0.08)" }}>
          <div style={{ background: "linear-gradient(135deg, #fce7f3, #f9a8d4)", padding: "40px 24px", textAlign: "center" }}>
            <div style={{ width: 90, height: 90, borderRadius: "50%", margin: "0 auto 16px", background: "linear-gradient(135deg, #f9a8d4, #be185d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 900, color: "#fff", border: "4px solid #fff", boxShadow: "0 4px 16px rgba(190,24,93,0.25)" }}>
              {user.fullname?.charAt(0).toUpperCase()}
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#1a1a1a", margin: "0 0 4px" }}>{user.fullname}</h2>
            <p style={{ color: "#db2777", fontSize: 12, fontWeight: 600, letterSpacing: 1, margin: 0, textTransform: "uppercase" }}>{user.username}</p>
            <span style={{ display: "inline-block", marginTop: 10, background: user.role === "admin" ? "#be185d" : "#f9a8d4", color: user.role === "admin" ? "#fff" : "#be185d", fontSize: 10, fontWeight: 800, padding: "4px 14px", borderRadius: 20, letterSpacing: 1 }}>
              {user.role?.toUpperCase()}
            </span>
          </div>

          <div style={{ padding: 28 }}>
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
                      onBlur={(e) => (e.target.style.borderColor = "#fce7f3")}
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
                  <div key={label} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid #fce7f3" }}>
                    <p style={{ color: "#aaa", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, margin: "0 0 6px" }}>{label}</p>
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
        </div>
      </div>
    </div>
  );
}
