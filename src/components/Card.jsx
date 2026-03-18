export default function Card({ children, style }) {
  return (
    <div style={{ ...styles.card, ...style }}>
      {children}
    </div>
  )
}

const styles = {
  card: {
    background: 'var(--white)',
    border: '1px solid var(--gray-200)',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
}
