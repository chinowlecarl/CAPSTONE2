import { useEffect, useRef, useState } from "react";

// One reusable confirm dialog for the whole app.
//
//   import { confirmDialog } from "../components/ConfirmDialog";
//
//   if (!(await confirmDialog({
//     title: "Archive this product?",
//     message: "It will be hidden from the shop. You can restore it within 10 days.",
//     confirmLabel: "Archive",
//     tone: "danger",            // "default" (pink) or "danger" (red)
//   }))) return;
//
// Pass cancelLabel: null to use it as a simple OK message instead of a question.
// <ConfirmHost /> must be mounted once (it is, in App.jsx).

let openDialog = null;

export function confirmDialog(options = {}) {
  return new Promise((resolve) => {
    // If the host is not mounted (for example in a test), fall back to the browser's own confirm.
    if (!openDialog) return resolve(window.confirm(options.message || "Are you sure?"));
    openDialog({ ...options, resolve });
  });
}

const PINK = "#be185d";

const buttonBase = {
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  padding: "11px 22px",
  cursor: "pointer",
  minWidth: 96,
};

export function ConfirmDialog({
  open = true,
  title = "Are you sure?",
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const panelRef = useRef(null);
  const titleId = "confirm-dialog-title";
  const messageId = "confirm-dialog-message";

  // Focus the safe button first, give focus back afterwards, and stop the page behind from scrolling.
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    (cancelRef.current || confirmRef.current)?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (previouslyFocused && typeof previouslyFocused.focus === "function") previouslyFocused.focus();
    };
  }, [open]);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (!busy) onCancel?.();
      return;
    }
    if (e.key === "Tab") {
      // keep keyboard focus inside the dialog
      const focusable = [...panelRef.current.querySelectorAll("button")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  if (!open) return null;

  const danger = tone === "danger" || destructive;

  return (
    <div
      onMouseDown={(e) => { if (!busy && e.target === e.currentTarget && cancelLabel !== null) onCancel?.(); }}
      onKeyDown={onKeyDown}
      style={{ position: "fixed", inset: 0, background: "rgba(26,10,16,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        style={{ background: "#fff", border: "1px solid #fce7f3", borderRadius: 16, boxShadow: "0 20px 60px rgba(190,24,93,0.18)", padding: "26px 28px 22px", width: "100%", maxWidth: 420 }}
      >
        <h2 id={titleId} style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 800, color: "#1a1a1a", margin: "0 0 8px" }}>
          {title}
        </h2>
        <p id={messageId} style={{ fontSize: 14, color: "#555", lineHeight: 1.55, margin: "0 0 22px", whiteSpace: "pre-line" }}>
          {message}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          {cancelLabel !== null && (
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              disabled={busy}
              style={{ ...buttonBase, background: "#fff", border: "1.5px solid #fce7f3", color: PINK }}
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              ...buttonBase,
              border: "none",
              color: "#fff",
              background: danger ? "linear-gradient(135deg,#f87171,#dc2626)" : "linear-gradient(135deg,#f9a8d4,#be185d)",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;

// Mounted once near the top of the app. Handles one dialog at a time and queues the rest.
export function ConfirmHost() {
  const current = useRef(null);
  const queue = useRef([]);
  const [, rerender] = useState(0);

  useEffect(() => {
    openDialog = (request) => {
      if (current.current) queue.current.push(request);
      else { current.current = request; rerender((n) => n + 1); }
    };
    return () => { openDialog = null; };
  }, []);

  const finish = (answer) => {
    current.current?.resolve(answer);
    current.current = queue.current.shift() || null;
    rerender((n) => n + 1);
  };

  if (!current.current) return null;
  const { title, message, confirmLabel, cancelLabel, tone } = current.current;
  return (
    <ConfirmDialog
      key={queue.current.length + (title || "")}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel === undefined ? "Cancel" : cancelLabel}
      tone={tone}
      onConfirm={() => finish(true)}
      onCancel={() => finish(false)}
    />
  );
}