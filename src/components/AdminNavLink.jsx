export function AdminNavLink({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "rgba(190,24,93,0.15)" : "none",
        border: "none",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 1,
        padding: "8px 14px",
        borderRadius: 8,
        color: active ? "#be185d" : "rgba(255,255,255,0.6)",
        transition: "all .2s",
      }}
    >
      {label}
    </button>
  );
}
