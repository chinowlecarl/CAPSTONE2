import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    navigate('/events')
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <span style={styles.brandMain}>EventHub</span>
          <span style={styles.brandSub}>FEU ROOSEVELT</span>
        </div>
        <h2 style={styles.title}>Welcome back</h2>
        <p style={styles.subtitle}>Sign in to your account</p>
        <div style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input style={styles.input} type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
            onClick={handleSubmit} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
        <p style={styles.footer}>
          Don't have an account? <Link to="/register" style={styles.link}>Register</Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'var(--gray-50)',
  },
  card: {
    background: 'var(--white)', borderRadius: '16px',
    padding: '2.5rem', width: '100%', maxWidth: '420px',
    border: '1px solid var(--gray-200)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
  },
  brand: { display: 'flex', flexDirection: 'column', marginBottom: '1.5rem' },
  brandMain: { fontSize: '1.5rem', fontWeight: 800, color: 'var(--green-dark)' },
  brandSub: { fontSize: '0.65rem', color: 'var(--gray-500)', fontWeight: 600, letterSpacing: '0.05em' },
  title: { fontSize: '1.4rem', fontWeight: 700, marginBottom: '4px' },
  subtitle: { fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.875rem', fontWeight: 500, color: 'var(--gray-700)' },
  input: {
    padding: '10px 12px', border: '1px solid var(--gray-200)',
    borderRadius: '8px', fontSize: '0.9rem',
  },
  error: { color: 'var(--red)', fontSize: '0.85rem', background: 'var(--red-light)', padding: '8px 12px', borderRadius: '8px' },
  btn: {
    padding: '12px', background: 'var(--green-dark)', color: 'var(--white)',
    border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.95rem',
    cursor: 'pointer', marginTop: '4px',
  },
  footer: { marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--gray-500)', textAlign: 'center' },
  link: { color: 'var(--green-dark)', fontWeight: 600 },
}
