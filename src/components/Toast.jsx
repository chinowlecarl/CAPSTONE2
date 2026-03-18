export function Toast({ toasts }) {
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background:
            t.type === "success" ? "#be185d"
            : t.type === "error" ? "#9f1239"
            : "#db2777",
          color: "#fff", padding: "12px 20px", borderRadius: 12,
          fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 20px rgba(190,24,93,0.35)", minWidth: 240,
          display: "flex", alignItems: "center", gap: 8,
          animation: "toastIn .3s ease",
        }}>
          <span>
            {t.type === "success" ? "✓" : t.type === "error" ? "✗" : "ℹ"}
          </span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
