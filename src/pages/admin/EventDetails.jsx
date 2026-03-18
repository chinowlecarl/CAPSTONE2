import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import AdminLayout from '../../components/AdminLayout'

export default function EventDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [id])

  const fetchData = async () => {
    const { data: ev } = await supabase.from('events').select('*').eq('id', id).single()
    setEvent(ev)
    const { data: regs } = await supabase
      .from('registrations')
      .select('*, profiles(*)')
      .eq('event_id', id)
    setRegistrations(regs || [])
    setLoading(false)
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const formatTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
  }

  if (loading) return <AdminLayout><Spinner /></AdminLayout>
  if (!event) return <AdminLayout><p style={{ padding: '2rem' }}>Event not found.</p></AdminLayout>

  return (
    <AdminLayout>
      <div style={styles.page}>
        {/* Hero */}
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>{event.title}</h1>
          <p style={styles.heroSub}>{event.description?.slice(0, 100)}{event.description?.length > 100 ? '?' : ''}</p>
          <div style={styles.heroMeta}>
            <div style={styles.metaItem}>
              <span style={styles.metaIcon}>📅</span>
              <div>
                <div style={styles.metaMain}>{formatDate(event.date)}</div>
                <div style={styles.metaSub}>{formatTime(event.time)}</div>
              </div>
            </div>
            <div style={styles.metaDivider} />
            <div style={styles.metaItem}>
              <span style={{ ...styles.metaIcon, background: 'rgba(212,160,23,0.2)' }}>📍</span>
              <div style={styles.metaMain}>{event.location}</div>
            </div>
          </div>
        </div>

        {/* About */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}><span>ℹ️</span> About This Event</h2>
          <p style={styles.desc}>{event.description}</p>

          {/* Check-In CTA */}
          <div style={styles.ctaBox}>
            <div>
              <p style={styles.ctaLabel}>Manage Event Access</p>
              <p style={styles.ctaSub}>Ready to open the doors? Launch the scanner to start checking in guests.</p>
            </div>
            <button style={styles.launchBtn}
              onClick={() => navigate(`/check-in-desk/${event.id}`)}>
              👥 Launch Check-In Desk
            </button>
          </div>
        </div>

        {/* Registrations Table */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <span>🎫</span> Registered Attendees
            <span style={styles.countBadge}>{registrations.length}</span>
          </h2>
          {registrations.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>No registrations yet.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Name', 'Email', 'Status', 'Registration ID'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registrations.map(r => (
                    <tr key={r.id} style={styles.tr}>
                      <td style={styles.td}>{r.profiles?.full_name || '—'}</td>
                      <td style={styles.td}>{r.profiles?.email || '—'}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.statusBadge, ...(r.checked_in ? styles.checkedIn : styles.confirmed) }}>
                          {r.checked_in ? '✓ Checked In' : 'Confirmed'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, ...styles.idCell }}>{r.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--gray-200)', borderTopColor: 'var(--green-dark)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

const styles = {
  page: { padding: '2rem' },
  hero: {
    background: 'var(--green-dark)', borderRadius: '16px',
    padding: '2.5rem', color: 'var(--white)',
    marginBottom: '1.5rem', borderBottom: '4px solid var(--gold)',
  },
  heroTitle: { fontSize: '2rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '0.5rem' },
  heroSub: { fontSize: '0.95rem', opacity: 0.8, marginBottom: '1.5rem', maxWidth: '600px' },
  heroMeta: { display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' },
  metaItem: { display: 'flex', alignItems: 'center', gap: '12px' },
  metaIcon: {
    width: '38px', height: '38px', borderRadius: '9px',
    background: 'rgba(255,255,255,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
  },
  metaMain: { fontSize: '0.9rem', fontWeight: 600, color: 'var(--white)' },
  metaSub: { fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginTop: '1px' },
  metaDivider: { width: '1px', height: '38px', background: 'rgba(255,255,255,0.2)' },
  section: {
    background: 'var(--white)', border: '1px solid var(--gray-200)',
    borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem',
  },
  sectionTitle: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '1rem', fontWeight: 700, marginBottom: '1rem',
  },
  countBadge: {
    background: 'var(--gray-100)', color: 'var(--gray-600)',
    fontSize: '0.75rem', fontWeight: 600,
    padding: '2px 8px', borderRadius: '99px',
  },
  desc: { fontSize: '0.875rem', color: 'var(--gray-700)', lineHeight: 1.7, marginBottom: '1.5rem' },
  ctaBox: {
    background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
    borderRadius: '10px', padding: '1rem 1.25rem',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: '1rem',
  },
  ctaLabel: { fontSize: '0.875rem', fontWeight: 600 },
  ctaSub: { fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '2px' },
  launchBtn: {
    padding: '10px 20px', background: 'var(--green-dark)',
    color: 'var(--white)', border: 'none', borderRadius: '8px',
    fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '6px',
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', fontSize: '0.75rem', fontWeight: 700,
    color: 'var(--gray-500)', padding: '8px 12px',
    borderBottom: '1px solid var(--gray-200)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  tr: { borderBottom: '1px solid var(--gray-100)' },
  td: { padding: '10px 12px', fontSize: '0.85rem', color: 'var(--gray-700)' },
  idCell: { fontSize: '0.72rem', color: 'var(--gray-400)', fontFamily: 'monospace' },
  statusBadge: { padding: '3px 8px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600 },
  confirmed: { background: '#dbeafe', color: '#2563eb' },
  checkedIn: { background: '#dcfce7', color: '#16a34a' },
}
