export function PageWrapper({ children, style = {} }) {
  return (
    <div style={{ background: "#fff", minHeight: "100vh", ...style }}>
      {children}
    </div>
  );
}
