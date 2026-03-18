export default function Footer() {
  return (
    <footer style={styles.footer}>
      <p style={styles.line1}>Saint Jude College - PHINMA Education</p>
      <p style={styles.line2}>Powered by TechVille</p>
    </footer>
  )
}

const styles = {
  footer: {
    textAlign: 'center',
    padding: '1.5rem',
    borderTop: '1px solid var(--gray-200)',
    background: 'var(--white)',
    marginTop: 'auto',
  },
  line1: { fontSize: '0.8rem', color: 'var(--gray-500)', fontWeight: 500 },
  line2: { fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '2px' },
}
