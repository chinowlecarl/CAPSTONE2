export function Input({ label, type = "text", value, onChange, placeholder, required, min }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{
          display: "block", fontSize: 10, fontWeight: 800,
          color: "#888", letterSpacing: 1.5, marginBottom: 6,
          textTransform: "uppercase",
        }}>
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        min={min}
        style={{
          width: "100%", padding: "10px 14px",
          border: "1.5px solid #fce7f3", borderRadius: 10,
          fontSize: 13, outline: "none", background: "#fff5f7",
          boxSizing: "border-box", transition: "border-color .2s",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#db2777")}
        onBlur={(e) => (e.target.style.borderColor = "#fce7f3")}
      />
    </div>
  );
}
