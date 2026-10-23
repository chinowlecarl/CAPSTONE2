import { useState } from "react";
import { useApp } from "../context/AppContext";
import { PasswordInput } from "../components/PasswordInput";

const RULES = [
  { label: "At least 8 characters", test: (password) => password.length >= 8 },
  { label: "One uppercase letter", test: (password) => /[A-Z]/.test(password) },
  { label: "One number", test: (password) => /[0-9]/.test(password) },
];

export default function ResetPassword({ setPage }) {
  const { authLoading, passwordRecoveryReady, completePasswordReset } = useApp();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const returnToSignIn = () => {
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    setPage("login");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!RULES.every((rule) => rule.test(password))) {
      setError("The new password does not meet the requirements.");
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError("The new password must be 72 bytes or fewer.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await completePasswordReset(password);
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Could not reset your password.");
    } finally {
      setBusy(false);
    }
  };

  const cardStyle = { position: "relative", zIndex: 2, width: "100%", maxWidth: 380, background: "#fff", borderRadius: 20, boxShadow: "0 20px 60px rgba(190, 24, 93, 0.3)", padding: "48px 40px" };
  const bgStyle = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden" };

  return (
    <div style={bgStyle}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=70')", backgroundSize: "cover", backgroundPosition: "center", zIndex: 0 }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(252,231,243,0.88) 0%, rgba(251,207,232,0.88) 40%, rgba(249,168,212,0.88) 100%)", zIndex: 1 }} />
      <section style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#1a1a1a", letterSpacing: 2, marginBottom: 8 }}>FITCHEQUE</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#1a1a1a", margin: "0 0 8px" }}>
            {success ? "Password updated" : "Reset your password"}
          </h1>
          {!success && <p style={{ color: "#888", fontSize: 13, margin: 0 }}>Choose a new password for your account.</p>}
        </div>

        {success ? (
          <>
            <p role="status" style={{ color: "#15803d", fontSize: 13, textAlign: "center", marginBottom: 22 }}>
              Your password has been reset. You can now sign in with your new password.
            </p>
            <button type="button" onClick={returnToSignIn} style={{ width: "100%", background: "linear-gradient(135deg, #f9a8d4 0%, #be185d 100%)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 1.5, padding: "13px 0", cursor: "pointer" }}>
              GO TO SIGN IN
            </button>
          </>
        ) : authLoading ? (
          <p role="status" style={{ color: "#888", fontSize: 13, textAlign: "center" }}>Checking your reset link…</p>
        ) : !passwordRecoveryReady ? (
          <>
            <p role="alert" style={{ background: "#fff5f7", border: "1px solid #fce7f3", borderLeft: "4px solid #be185d", borderRadius: 8, padding: "12px 14px", color: "#be185d", fontSize: 12, fontWeight: 600 }}>
              This reset link is invalid or has expired. Request a new password reset email.
            </p>
            <button type="button" onClick={returnToSignIn} style={{ width: "100%", background: "none", border: "none", color: "#be185d", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              BACK TO SIGN IN
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            {error && <p role="alert" style={{ background: "#fff5f7", border: "1px solid #fce7f3", borderLeft: "4px solid #be185d", borderRadius: 8, padding: "10px 14px", color: "#be185d", fontSize: 12, fontWeight: 600, margin: "0 0 16px" }}>{error}</p>}
            <PasswordInput label="NEW PASSWORD" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Choose a new password" />
            {password && (
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px", display: "flex", gap: 14, flexWrap: "wrap" }}>
                {RULES.map((rule) => (
                  <li key={rule.label} style={{ fontSize: 12, color: rule.test(password) ? "#16a34a" : "#9ca3af", fontWeight: 600 }}>
                    {rule.test(password) ? "✓" : "○"} {rule.label}
                  </li>
                ))}
              </ul>
            )}
            <PasswordInput label="CONFIRM NEW PASSWORD" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" placeholder="Type the new password again" marginBottom={20} />
            <button type="submit" disabled={busy} style={{ width: "100%", background: "linear-gradient(135deg, #f9a8d4 0%, #be185d 100%)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 1.5, padding: "13px 0", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>
              {busy ? "UPDATING..." : "RESET PASSWORD"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
