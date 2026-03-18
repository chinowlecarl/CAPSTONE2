import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useProfile } from '../hooks/useProfile'
import PageWrapper from '../components/PageWrapper'

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const { profile } = useProfile()
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [profile])

  const fetchData = async () => {
    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .order('date', { ascending: true })

    setEvents(eventsData || [])

    if (profile) {
      const { data: regs } = await supabase
        .from('registrations')
        .select('*')
        .eq('user_id', profile.id)
      setRegistrations(regs || [])
    }

    setLoading(false)
  }

  const isRegistered = (eventId) =>
    registrations.some(r => r.event_id === eventId)

  const getRegistration = (eventId) =>
    registrations.find(r => r.event_id === eventId)

  const handleRegister = async (eventId) => {
    if (!profile) { navigate('/signin'); return }
    const { data } = await supabase.from('registrations')
      .insert({ event_id: eventId, user_id: profile.id, status: 'confirmed' })
      .select().single()
    if (data) setRegistrations([...registrations, data])
  }

  const handleUnregister = async (eventId) => {
    const reg = getRegistration(eventId)
    if (!reg) return
    await supabase.from('registrations').delete().eq('id', reg.id)
    setRegistrations(registrations.filter(r => r.id !== reg.id))
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return { month: d.toLocaleString('en', { month: 'short' }).toUpperCase(), day: d.getDate() }
  }

  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const h12 = hour % 12 || 12
    return `${h12}:${m} ${ampm}`
  }

  if (loading) return (
    <PageWrapper>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <Spinner />
      </div>
    </PageWrapper>
  )

  return (
    <PageWrapper>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {events.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '3rem' }}>No events available.</p>
        )}
        {events.map(event => {
          const { month, day } = formatDate(event.date)
          const registered = isRegistered(event.id)
          return (
            <div key={event.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.dateBox}>
                  <span style={styles.month}>{month}</span>
                  <span style={styles.day}>{day}</span>
                </div>
                <div style={styles.cardInfo}>
                  <h3 style={styles.eventTitle}>{event.title}</h3>
                  <p style={styles.desc}>
                    {event.description?.length > 140
                      ? event.description.slice(0, 140) + '...'
                      : event.description}
                  </p>
                  <div style={styles.metaRow}>
                    <span style={styles.metaBadge}>🕐 {formatTime(event.time)}</span>
                    <span style={styles.metaBadge}>📍 {event.location}</span>
                  </div>
                </div>
              </div>
              <div style={styles.actions}>
                {registered ? (
                  <>
                    <button style={styles.btnTicket}
                      onClick={() => navigate(`/ticket/${getRegistration(event.id)?.id}`)}>
                      🎫 Ticket
                    </button>
                    <button style={styles.btnUnregister} onClick={() => handleUnregister(event.id)}>
                      ↩ Unregister
                    </button>
                  </>
                ) : (
                  <button style={styles.btnRegister} onClick={() => handleRegister(event.id)}>
                    + Register
                  </button>
                )}
                <button style={styles.btnDetails} onClick={() => navigate(`/events/${event.id}`)}>
                  📄 Details
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </PageWrapper>
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
  card: {
    background: 'var(--white)', border: '1px solid var(--gray-200)',
    borderRadius: '12px', padding: '1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  cardHeader: { display: 'flex', gap: '1rem', marginBottom: '1rem' },
  dateBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', background: 'var(--gray-50)',
    border: '1px solid var(--gray-200)', borderRadius: '8px',
    padding: '8px 14px', minWidth: '56px',
  },
  month: { fontSize: '0.65rem', fontWeight: 700, color: 'var(--green-dark)', letterSpacing: '0.05em' },
  day: { fontSize: '1.5rem', fontWeight: 800, color: 'var(--gray-900)', lineHeight: 1 },
  cardInfo: { flex: 1 },
  eventTitle: { fontSize: '1rem', fontWeight: 700, marginBottom: '0.4rem' },
  desc: { fontSize: '0.85rem', color: 'var(--gray-500)', lineHeight: 1.5, marginBottom: '0.75rem' },
  metaRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  metaBadge: {
    background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
    padding: '4px 10px', borderRadius: '99px', fontSize: '0.8rem', color: 'var(--gray-700)',
  },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  btnRegister: {
    padding: '7px 16px', background: 'var(--white)',
    border: '1px solid var(--gray-300)', borderRadius: '99px',
    fontSize: '0.825rem', fontWeight: 500, cursor: 'pointer',
  },
  btnTicket: {
    padding: '7px 16px', background: 'var(--white)',
    border: '1px solid var(--gray-300)', borderRadius: '99px',
    fontSize: '0.825rem', fontWeight: 500, cursor: 'pointer',
  },
  btnUnregister: {
    padding: '7px 16px', background: 'var(--white)',
    border: '1px solid #fcd34d', color: '#d97706',
    borderRadius: '99px', fontSize: '0.825rem', fontWeight: 500, cursor: 'pointer',
  },
  btnDetails: {
    padding: '7px 16px', background: 'var(--white)',
    border: '1px solid var(--green-dark)', color: 'var(--green-dark)',
    borderRadius: '99px', fontSize: '0.825rem', fontWeight: 500, cursor: 'pointer',
  },
}
