import { useState } from "react";
import { apiFetch } from "../utils/api";
import { PasswordInput } from "../components/PasswordInput";

// Same rules as the Sign Up page.
const RULES = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One number", test: (p) => /[0-9]/.test(p) },
];

export default function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type: "success" | "error", text }
  const [errors, setErrors] = useState({});      // per-field messages

  const validate = () => {
    const e = {};
    if (!current) e.current = "Enter your current password";
    if (!RULES.every((r) => r.test(next))) e.next = "The new password does not meet the requirements";
    else if (next === current) e.next = "The new password must be different from your current one";
    if (!confirm) e.confirm = "Confirm your new password";
    else if (confirm !== next) e.confirm = "The two new passwords do not match";
    if (next && new TextEncoder().encode(next).length > 72) e.next = "The new password must be 72 bytes or fewer";
    return e;
  };

  const submit = async () => {
    if (busy) return;
    setMessage(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const res = await apiFetch("/account/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setCurrent(""); setNext(""); setConfirm(""); setErrors({});
      setMessage({
        type: "success",
        text: res?.otherSessionsSignedOut ? "Password changed. Your other devices have been signed out." : "Password changed.",
      });
    } catch (err) {
      const text = err.message || "Could not change your password";
      // a wrong current password belongs next to that field
      if (/current password/i.test(text)) setErrors({ current: text });
      else setMessage({ type: "error", text });
    }
    setBusy(false);
  };

  const onEnter = (ev) => { if (ev.key === "Enter") submit(); };

  return (
    <div style={{ background: "#fff", border: "1px solid #fce7f3", borderRadius: 16, padding: "24px 28px", boxShadow: "0 2px 12px rgba(190,24,93,0.05)" }}>
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a", margin: "0 0 4px" }}>Change password</h3>
      <p style={{ fontSize: 13, color: "#888", margin: "0 0 18px" }}>You will stay signed in here. Other devices are signed out.</p>

      {message && (
        <div
          role={message.type === "error" ? "alert" : "status"}
          style={{
            marginBottom: 16, padding: "11px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: message.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${message.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            color: message.type === "success" ? "#15803d" : "#dc2626",
          }}
        >
          {message.type === "success" ? "✓ " : ""}{message.text}
        </div>
      )}

      <PasswordInput label="CURRENT PASSWORD" value={current} onChange={(e) => setCurrent(e.target.value)} onKeyDown={onEnter} autoComplete="current-password" error={errors.current} placeholder="Your current password" />
      <PasswordInput label="NEW PASSWORD" value={next} onChange={(e) => setNext(e.target.value)} onKeyDown={onEnter} autoComplete="new-password" error={errors.next} placeholder="Choose a new password" marginBottom={8} />

      {next && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px", display: "flex", gap: 14, flexWrap: "wrap" }}>
          {RULES.map((r) => (
            <li key={r.label} style={{ fontSize: 12, color: r.test(next) ? "#16a34a" : "#9ca3af", fontWeight: 600 }}>
              {r.test(next) ? "✓" : "○"} {r.label}
            </li>
          ))}
        </ul>
      )}

      <PasswordInput label="CONFIRM NEW PASSWORD" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={onEnter} autoComplete="new-password" error={errors.confirm} placeholder="Type the new password again" marginBottom={18} />

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        style={{ background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 1, padding: "12px 26px", cursor: "pointer", opacity: busy ? 0.7 : 1 }}
      >
        {busy ? "SAVING..." : "CHANGE PASSWORD"}
      </button>
    </div>
  );
}
