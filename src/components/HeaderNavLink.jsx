export function HeaderNavLink({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none", border: "none", cursor: "pointer",
        fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
        padding: "8px 12px",
        color: active ? "#be185d" : "#555",
        borderBottom: active ? "2px solid #be185d" : "2px solid transparent",
        transition: "all .2s",
      }}
    >
      {label}
    </button>
  );
}
