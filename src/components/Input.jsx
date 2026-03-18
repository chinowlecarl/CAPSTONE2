export default function Input({ label, error, style, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      {label && <label style={styles.label}>{label}</label>}
      <input style={{ ...styles.input, ...(error ? styles.inputError : {}) }} {...props} />
      {error && <span style={styles.error}>{error}</span>}
    </div>
  )
}

const styles = {
  label: { fontSize: '0.875rem', fontWeight: 500, color: 'var(--gray-700)' },
  input: {
    padding: '10px 12px',
    border: '1px solid var(--gray-200)',
    borderRadius: '8px',
    fontSize: '0.9rem',
    color: 'var(--gray-900)',
    background: 'var(--white)',
    transition: 'border-color 0.2s',
    width: '100%',
  },
  inputError: { borderColor: 'var(--red)' },
  error: { fontSize: '0.8rem', color: 'var(--red)' },
}
