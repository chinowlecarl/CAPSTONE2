import { useState } from "react";

// Eye / eye-off icons (shared so Sign In, Sign Up and Change Password all look the same)
export function EyeIcon({ visible, size = 18 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  return visible ? (
    <svg {...common}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg {...common}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// Reusable password field with a show / hide button.
export function PasswordInput({ label, value, onChange, placeholder, autoComplete, id, name, error, hint, onBlur, onKeyDown, marginBottom = 14 }) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const fieldId = id || `pw-${(name || label || "password").toString().toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div style={{ marginBottom }}>
      {label && (
        <label htmlFor={fieldId} style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#888", letterSpacing: 1.5, marginBottom: 6 }}>
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        <input
          id={fieldId}
          name={name}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? "true" : undefined}
          onFocus={() => setFocused(true)}
          onBlur={(e) => { setFocused(false); if (onBlur) onBlur(e); }}
          style={{
            width: "100%", boxSizing: "border-box",
            background: "#fff5f7",
            border: `1.5px solid ${error ? "#ef4444" : focused ? "#db2777" : "#fce7f3"}`,
            borderRadius: 10, padding: "11px 44px 11px 14px",
            fontSize: 13, color: "#1a1a1a", outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          title={show ? "Hide password" : "Show password"}
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#db2777", padding: 4, display: "flex", alignItems: "center", cursor: "pointer" }}
        >
          <EyeIcon visible={show} />
        </button>
      </div>
      {error ? (
        <p role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626" }}>{error}</p>
      ) : (
        hint || null
      )}
    </div>
  );
}
