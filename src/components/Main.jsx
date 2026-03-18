export default function Main({ children, style }) {
  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto', width: '100%', ...style }}>
      {children}
    </div>
  )
}
