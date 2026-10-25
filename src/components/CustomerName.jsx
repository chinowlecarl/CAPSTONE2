export default function CustomerName({ name, status }) {
  const suspended = status === "suspended";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
        color: suspended ? "#b91c1c" : "inherit",
      }}
    >
      <span>{name}</span>
      {suspended && (
        <span
          style={{
            display: "inline-block",
            padding: "2px 7px",
            borderRadius: 10,
            background: "#fee2e2",
            color: "#b91c1c",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Suspended
        </span>
      )}
    </span>
  );
}
