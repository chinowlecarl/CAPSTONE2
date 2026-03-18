import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useProfile } from '../hooks/useProfile'

export default function Header() {
  const { profile } = useProfile()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/signin')
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'AC'

  return (
    <header style={styles.header}>
      <Link to="/events" style={styles.brand}>
        <span style={styles.brandMain}>EventHub</span>
        <span style={styles.brandSub}>FEU ROOSEVELT</span>
      </Link>
      <nav style={styles.nav}>
        <Link to="/events" style={styles.navLink}>Events</Link>
        {profile?.role === 'admin' && (
          <Link to="/manage-events" style={styles.navLink}>Admin</Link>
        )}
        <div style={{ position: 'relative' }} ref={ref}>
          <button style={styles.avatar} onClick={() => setOpen(!open)}>
            {initials}
          </button>
          {open && (
            <div style={styles.dropdown}>
              <div style={styles.dropItem}>Profile <span style={styles.badge}>New</span></div>
              <div style={styles.dropItem}>Settings</div>
              <div style={{ ...styles.dropItem, ...styles.dropLogout }} onClick={handleLogout}>Logout</div>
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}

const styles = {
  header: {
    background: 'var(--white)',
    borderBottom: '1px solid var(--gray-200)',
    padding: '0 2rem',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: { display: 'flex', flexDirection: 'column', lineHeight: 1.1 },
  brandMain: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--gray-900)' },
  brandSub: { fontSize: '0.6rem', fontWeight: 600, color: 'var(--gray-500)', letterSpacing: '0.05em' },
  nav: { display: 'flex', alignItems: 'center', gap: '1.5rem' },
  navLink: { fontSize: '0.9rem', fontWeight: 500, color: 'var(--gray-700)', transition: 'color 0.2s' },
  avatar: {
    width: '36px', height: '36px', borderRadius: '50%',
    background: 'var(--green-dark)', color: 'var(--white)',
    fontWeight: 700, fontSize: '0.8rem', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  dropdown: {
    position: 'absolute', right: 0, top: '44px',
    background: 'var(--white)', border: '1px solid var(--gray-200)',
    borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    minWidth: '160px', overflow: 'hidden', zIndex: 200,
  },
  dropItem: {
    padding: '10px 16px', fontSize: '0.875rem', cursor: 'pointer',
    color: 'var(--gray-700)', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', transition: 'background 0.15s',
  },
  badge: {
    background: '#dcfce7', color: '#16a34a',
    fontSize: '0.65rem', padding: '2px 6px', borderRadius: '99px', fontWeight: 600,
  },
  dropLogout: { color: 'var(--gray-500)' },
}
