import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useProfile } from '../hooks/useProfile'
import AdminNavLink from './AdminNavLink'

export default function AdminLayout({ children }) {
  const { profile } = useProfile()
  const navigate = useNavigate()

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'AC'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/signin')
  }

  return (
    <div style={styles.layout}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div>
          <div style={styles.brandWrap}>
            <span style={styles.brandMain}>EventHub</span>
            <span style={styles.brandRole}>Admin Portal</span>
          </div>
          <nav style={styles.nav}>
            <AdminNavLink to="/manage-events" icon="🏠" exact={false} home>Home</AdminNavLink>
            <AdminNavLink to="/manage-events" icon="📅">Manage Events</AdminNavLink>
          </nav>
        </div>
        <div style={styles.userSection}>
          <div style={styles.userRow}>
            <div style={styles.avatar}>{initials}</div>
            <div>
              <p style={styles.userName}>{profile?.full_name || 'Admin User'}</p>
              <p style={styles.userRole}>Admin</p>
            </div>
          </div>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            <span>↩</span> Logout
          </button>
        </div>
      </aside>
      {/* Main content */}
      <main style={styles.main}>{children}</main>
    </div>
  )
}

const styles = {
  layout: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: '220px', minWidth: '220px',
    background: 'var(--green-dark)',
    color: 'var(--white)',
    display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '1.5rem 0',
    position: 'sticky', top: 0, height: '100vh',
  },
  brandWrap: { padding: '0 1.25rem 1.5rem' },
  brandMain: { display: 'block', fontSize: '1.3rem', fontWeight: 800, color: 'var(--white)' },
  brandRole: { display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginTop: '2px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '2px' },
  userSection: { padding: '0 1.25rem' },
  userRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    marginBottom: '0.75rem',
  },
  avatar: {
    width: '36px', height: '36px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: '0.8rem', color: 'var(--white)',
  },
  userName: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--white)' },
  userRole: { fontSize: '0.72rem', color: 'var(--gold-light)' },
  logoutBtn: {
    width: '100%', padding: '10px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px', color: 'var(--white)',
    fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px',
    justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s',
  },
  main: { flex: 1, background: 'var(--gray-50)', overflowY: 'auto' },
}
