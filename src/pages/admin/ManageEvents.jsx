import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import AdminLayout from '../../components/AdminLayout'

export default function ManageEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { fetchEvents() }, [])

  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('date', { ascending: false })
    setEvents(data || [])
    setLoading(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this event?')) return
    await supabase.from('events').delete().eq('id', id)
    setEvents(events.filter(e => e.id !== id))
  }

  const formatDate = (d) => {
    const date = new Date(d)
    return { month: date.toLocaleString('en', { month: 'short' }).toUpperCase(), day: date.getDate() }
  }

  const formatTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
  }

  return (
    <AdminLayout>
      <div style={styles.page}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Events Management</h1>
            <p style={styles.sub}>Create, update, and monitor campus activities.</p>
          </div>
          <button style={styles.createBtn} onClick={() => navigate('/manage-events/create')}>
            + Create Event
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner /></div>
        ) : events.length === 0 ? (
          <div style={styles.empty}>
            <p>No events yet.</p>
            <button style={styles.createBtn} onClick={() => navigate('/manage-events/create')}>Create your first event</button>
          </div>
        ) : (
          <div style={styles.grid}>
            {events.map(event => {
              const { month, day } = formatDate(event.date)
              return (
                <div key={event.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div style={styles.dateBox}>
                      <span style={styles.month}>{month}</span>
                      <span style={styles.day}>{day}</span>
                    </div>
                    <div style={styles.cardInfo}>
                      <h3 style={styles.eventTitle}>{event.title}</h3>
                      <span style={{ ...styles.statusBadge, ...(event.status === 'published' ? styles.published : styles.draft) }}>
                        {event.status}
                      </span>
                    </div>
                  </div>

                  <p style={styles.desc}>
                    {event.description?.length > 130
                      ? event.description.slice(0, 130) + '...'
                      : event.description}
                  </p>

                  <div style={styles.metaBox}>
                    <span style={styles.metaItem}>🕐 {formatTime(event.time)}</span>
                    <span style={styles.metaItem}>📍 {event.location}</span>
                  </div>

                  <div style={styles.actions}>
                    <button style={styles.btnEdit}
                      onClick={() => navigate(`/manage-events/edit/${event.id}`)}>
                      ✏️ Edit
                    </button>
                    <button style={styles.btnDelete} onClick={() => handleDelete(event.id)}>
                      🗑 Delete
                    </button>
                    <button style={styles.btnDetails}
                      onClick={() => navigate(`/manage-events/${event.id}`)}>
                      📄 Details
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function Spinner() {
  return (
    <div style={{ width: '32px', height: '32px', border: '3px solid var(--gray-200)', borderTopColor: 'var(--green-dark)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const styles = {
  page: { padding: '2rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' },
  title: { fontSize: '1.75rem', fontWeight: 800 },
  sub: { color: 'var(--gray-500)', fontSize: '0.875rem', marginTop: '4px' },
  createBtn: {
    padding: '10px 20px', background: 'var(--green-dark)',
    color: 'var(--white)', border: 'none', borderRadius: '8px',
    fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '6px',
  },
  grid: { display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' },
  card: {
    background: 'var(--white)', border: '1px solid var(--gray-200)',
    borderRadius: '12px', padding: '1.25rem',
  },
  cardTop: { display: 'flex', gap: '12px', marginBottom: '0.75rem', alignItems: 'flex-start' },
  dateBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
    borderRadius: '8px', padding: '6px 12px', minWidth: '50px',
  },
  month: { fontSize: '0.6rem', fontWeight: 700, color: 'var(--green-dark)', letterSpacing: '0.05em' },
  day: { fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.1 },
  cardInfo: { flex: 1 },
  eventTitle: { fontSize: '0.95rem', fontWeight: 700, marginBottom: '4px' },
  statusBadge: {
    fontSize: '0.72rem', fontWeight: 600,
    padding: '2px 8px', borderRadius: '99px',
    display: 'inline-block',
  },
  published: { background: '#dcfce7', color: '#16a34a' },
  draft: { background: 'var(--gray-100)', color: 'var(--gray-500)' },
  desc: { fontSize: '0.83rem', color: 'var(--gray-500)', lineHeight: 1.5, marginBottom: '0.75rem' },
  metaBox: {
    background: 'var(--gray-50)', border: '1px solid var(--gray-100)',
    borderRadius: '8px', padding: '8px 12px',
    display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '1rem',
  },
  metaItem: { fontSize: '0.8rem', color: 'var(--gray-600)' },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  btnEdit: {
    padding: '6px 14px', background: 'var(--white)',
    border: '1px solid var(--gray-300)', borderRadius: '8px',
    fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500,
  },
  btnDelete: {
    padding: '6px 14px', background: 'var(--white)',
    border: '1px solid #fca5a5', color: 'var(--red)',
    borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500,
  },
  btnDetails: {
    padding: '6px 14px', background: 'var(--white)',
    border: '1px solid var(--green-dark)', color: 'var(--green-dark)',
    borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500,
  },
  empty: { textAlign: 'center', padding: '4rem', color: 'var(--gray-500)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' },
}
