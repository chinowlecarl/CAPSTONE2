import { useRef, useState } from "react";
import { useApp } from "../context/AppContext";

export default function SignIn({ setPage }) {
  const { login, verifyTotpChallenge, verifyEmailOtpChallenge, resendEmailOtpChallenge, cancelChallenge, requestPasswordReset } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  // challenge state
  const [challenge, setChallenge] = useState(null); // { type: 'totp'|'email_otp', factorId?, email? }
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const verifyingRef = useRef(false);
  const resendingRef = useRef(false);

  const handleLogin = async () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    try {
      const result = await login(email, password);
      if (result.status === "totp_required") {
        setChallenge({ type: "totp", factorId: result.factorId });
      } else if (result.status === "email_otp_required") {
        setChallenge({ type: "email_otp", email: result.email });
        setNotice("");
      } else {
        setPage("home"); // role-based redirect can't happen here since ctx.user updates async; App-level routing can bounce admins if needed
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    if (!challenge || verifyingRef.current) return;
    const expectedLength = challenge.type === "totp" ? 6 : 8;
    if (code.length !== expectedLength) {
      setError(`Enter the ${expectedLength}-digit code from your ${challenge.type === "totp" ? "authenticator app" : "email"}.`);
      return;
    }
    verifyingRef.current = true;
    setVerifying(true); setError("");
    try {
      if (challenge.type === "totp") {
        await verifyTotpChallenge(challenge.factorId, code);
      } else {
        await verifyEmailOtpChallenge(challenge.email, code);
      }
      setPage("home");
    } catch (err) {
      setError(
        challenge.type === "email_otp" && /token.*(expired|invalid)|(expired|invalid).*token/i.test(err.message)
          ? "That code is invalid or expired. Request a new code, then use the latest email."
          : err.message
      );
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (challenge?.type !== "email_otp" || resendingRef.current) return;
    resendingRef.current = true;
    setResending(true);
    setError("");
    setNotice("");
    setCode("");
    try {
      await resendEmailOtpChallenge(challenge.email);
      setNotice("A new 8-digit code was sent. Use the newest email.");
    } catch (err) {
      setError(err.message || "Could not send a new verification code.");
    } finally {
      resendingRef.current = false;
      setResending(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError("Enter your email address first so we can send a reset link.");
      return;
    }
    setResetSending(true);
    setError("");
    setNotice("");
    try {
      await requestPasswordReset(email);
      setNotice("If an account exists for that email, a password reset link has been sent.");
    } catch (err) {
      setError(err.message || "Could not send a password reset link.");
    } finally {
      setResetSending(false);
    }
  };

  const handleCancel = async () => {
    await cancelChallenge();
    setChallenge(null);
    setCode("");
    setError("");
  };

  const cardStyle = { position: "relative", zIndex: 2, width: "100%", maxWidth: 380, background: "#fff", borderRadius: 20, boxShadow: "0 20px 60px rgba(190, 24, 93, 0.3)", padding: "48px 40px" };
  const bgStyle = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden" };

  // ── CHALLENGE SCREEN (TOTP or email code) ──────────────────
  if (challenge) return (
    <div style={bgStyle}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=70')", backgroundSize: "cover", backgroundPosition: "center", zIndex: 0 }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(252,231,243,0.88) 0%, rgba(251,207,232,0.88) 40%, rgba(249,168,212,0.88) 100%)", zIndex: 1 }} />
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>{challenge.type === "totp" ? "🔐" : "📧"}</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#1a1a1a", margin: "0 0 6px" }}>
            {challenge.type === "totp" ? "Enter Authenticator Code" : "Check Your Email"}
          </h2>
          <p style={{ color: "#aaa", fontSize: 12 }}>
            {challenge.type === "totp"
              ? "Enter the 6-digit code from your authenticator app"
              : `We sent an 8-digit code to ${challenge.email}`}
          </p>
        </div>

        {error && (
          <div style={{ background: "#fff5f7", border: "1px solid #fce7f3", borderLeft: "4px solid #be185d", borderRadius: 8, padding: "10px 14px", color: "#be185d", fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
            ⚠ {error}
          </div>
        )}
        {notice && (
          <div role="status" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", color: "#15803d", fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
            {notice}
          </div>
        )}
        <label htmlFor="verification-code" style={{ display: "block", color: "#888", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, marginBottom: 6, textAlign: "center" }}>
          {challenge.type === "totp" ? "AUTHENTICATOR CODE · 6 DIGITS" : "EMAIL VERIFICATION CODE · 8 DIGITS"}
        </label>
        <input
          id="verification-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, challenge.type === "totp" ? 6 : 8))}
          onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          placeholder={`${challenge.type === "totp" ? 6 : 8}-digit code`}
          maxLength={challenge.type === "totp" ? 6 : 8}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={challenge.type === "totp" ? "6-digit authenticator code" : "8-digit email verification code"}
          style={{ width: "100%", padding: "14px", border: "1.5px solid #fce7f3", borderRadius: 10, fontSize: 22, letterSpacing: challenge.type === "totp" ? 8 : 5, textAlign: "center", outline: "none", background: "#fff5f7", boxSizing: "border-box", marginBottom: 20, fontFamily: "monospace" }}
        />

        <button
          onClick={handleVerify}
          disabled={verifying || resending}
          style={{ width: "100%", background: "linear-gradient(135deg, #f9a8d4 0%, #be185d 100%)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 1.5, padding: "13px 0", cursor: "pointer", marginBottom: 12, opacity: verifying ? 0.7 : 1 }}
        >
          {verifying ? "VERIFYING..." : "VERIFY & CONTINUE"}
        </button>
        {challenge.type === "email_otp" && (
          <button
            type="button"
            onClick={handleResendCode}
            disabled={resending || verifying}
            style={{ width: "100%", background: "none", border: "none", color: "#be185d", fontSize: 12, fontWeight: 700, cursor: resending || verifying ? "default" : "pointer", marginBottom: 12, opacity: resending ? 0.7 : 1 }}
          >
            {resending ? "SENDING NEW CODE..." : "Resend code"}
          </button>
        )}
        <button onClick={handleCancel} disabled={verifying || resending} style={{ width: "100%", background: "none", border: "none", color: "#aaa", fontSize: 12, cursor: "pointer" }}>
          ← Back to login
        </button>
      </div>
    </div>
  );

  // ── NORMAL LOGIN SCREEN ─────────────────────────────────────
  return (
    <div style={bgStyle}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=70')", backgroundSize: "cover", backgroundPosition: "center", zIndex: 0 }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(252,231,243,0.88) 0%, rgba(251,207,232,0.88) 40%, rgba(249,168,212,0.88) 100%)", zIndex: 1 }} />

      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "#1a1a1a", letterSpacing: 2, marginBottom: 4 }}>FITCHEQUE</div>
          <p style={{ color: "#aaa", fontSize: 13 }}>Sign in to your account</p>
        </div>

        {error && (
          <div style={{ background: "#fff5f7", border: "1px solid #fce7f3", borderLeft: "4px solid #be185d", borderRadius: 8, padding: "10px 14px", color: "#be185d", fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
            ⚠ {error}
          </div>
        )}
        {notice && (
          <div role="status" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", color: "#15803d", fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
            {notice}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#888", letterSpacing: 1.5, marginBottom: 6 }}>EMAIL</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #fce7f3", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff5f7", boxSizing: "border-box" }}
            onFocus={(e) => (e.target.style.borderColor = "#db2777")}
            onBlur={(e) => (e.target.style.borderColor = "#fce7f3")}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#888", letterSpacing: 1.5 }}>PASSWORD</label>
            <button type="button" onClick={handlePasswordReset} disabled={resetSending} style={{ background: "none", border: "none", color: "#be185d", fontSize: 11, fontWeight: 700, cursor: resetSending ? "default" : "pointer", padding: 0 }}>
              {resetSending ? "SENDING..." : "Forgot password?"}
            </button>
          </div>
          <div style={{ position: "relative" }}>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              style={{ width: "100%", padding: "11px 40px 11px 14px", border: "1.5px solid #fce7f3", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff5f7", boxSizing: "border-box" }}
              onFocus={(e) => (e.target.style.borderColor = "#db2777")}
              onBlur={(e) => (e.target.style.borderColor = "#fce7f3")}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#db2777", padding: 0, display: "flex", alignItems: "center" }}
            >
              {showPw ? "🙈" : "👁"}
            </button>
          </div>
        </div>

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