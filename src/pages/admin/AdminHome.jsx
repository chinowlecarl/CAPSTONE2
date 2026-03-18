import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import AdminLayout from '../../components/AdminLayout'

export default function AdminHome() {
  const [stats, setStats] = useState({ events: 0, registrations: 0, users: 0 })
  const navigate = useNavigate()

  useEffect(() => {
    const fetchStats = async () => {
      const [{ count: evCount }, { count: regCount }, { count: userCount }] = await Promise.all([
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase.from('registrations').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
      ])
      setStats({ events: evCount || 0, registrations: regCount || 0, users: userCount || 0 })
    }
    fetchStats()
  }, [])

  const cards = [
    { label: 'Total Events', value: stats.events, icon: '📅', color: '#dcfce7', accent: '#16a34a' },
    { label: 'Registrations', value: stats.registrations, icon: '🎫', color: '#dbeafe', accent: '#2563eb' },
    { label: 'Users', value: stats.users, icon: '👥', color: '#fef9c3', accent: '#d97706' },
  ]

  return (
    <AdminLayout>
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.sub}>Overview of your EventHub portal</p>
        </div>
        <div style={styles.statsGrid}>
          {cards.map(c => (
            <div key={c.label} style={{ ...styles.statCard, background: c.color }}>
              <span style={styles.statIcon}>{c.icon}</span>
              <p style={{ ...styles.statValue, color: c.accent }}>{c.value}</p>
              <p style={styles.statLabel}>{c.label}</p>
            </div>
          ))}
        </div>
        <div style={styles.quickActions}>
          <h2 style={styles.sectionTitle}>Quick Actions</h2>
          <div style={styles.actionRow}>
            <button style={styles.actionBtn} onClick={() => navigate('/manage-events/create')}>
              + Create Event
            </button>
            <button style={{ ...styles.actionBtn, ...styles.actionBtnOutline }}
              onClick={() => navigate('/manage-events')}>
              Manage Events
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

const styles = {
  page: { padding: '2rem' },
  header: { marginBottom: '2rem' },
  title: { fontSize: '1.75rem', fontWeight: 800 },
  sub: { color: 'var(--gray-500)', fontSize: '0.9rem', marginTop: '4px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' },
  statCard: { borderRadius: '12px', padding: '1.25rem', textAlign: 'center' },
  statIcon: { fontSize: '1.75rem', display: 'block', marginBottom: '0.5rem' },
  statValue: { fontSize: '2rem', fontWeight: 800, lineHeight: 1 },
  statLabel: { fontSize: '0.8rem', color: 'var(--gray-600)', marginTop: '4px', fontWeight: 500 },
  quickActions: { background: 'var(--white)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--gray-200)' },
  sectionTitle: { fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' },
  actionRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  actionBtn: {
    padding: '10px 20px', background: 'var(--green-dark)',
    color: 'var(--white)', border: 'none', borderRadius: '8px',
    fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
  },
  actionBtnOutline: {
    background: 'var(--white)',
    border: '1px solid var(--green-dark)',
    color: 'var(--green-dark)',
  },
}
