import { useEffect } from "react";

export default function ConfirmDialog({
  open,
  title = "Please confirm",
  message,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(26,26,26,.55)",
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        style={{
          width: "100%",
          maxWidth: 440,
          padding: 24,
          borderRadius: 16,
          background: "#fff",
          boxShadow: "0 20px 60px rgba(0,0,0,.25)",
        }}
      >
        <h2 id="confirm-title" style={{ margin: "0 0 10px", color: "#1a1a1a", fontSize: 18 }}>
          {title}
        </h2>
        <p id="confirm-message" style={{ margin: "0 0 24px", color: "#666", fontSize: 14, lineHeight: 1.6 }}>
          {message}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: "10px 16px",
              border: "1px solid #fce7f3",
              borderRadius: 9,
              background: "#fff",
              color: "#be185d",
              fontWeight: 700,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: "10px 16px",
              border: "none",
              borderRadius: 9,
              background: destructive ? "#b91c1c" : "linear-gradient(135deg,#f9a8d4,#be185d)",
              color: "#fff",
              fontWeight: 800,
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
