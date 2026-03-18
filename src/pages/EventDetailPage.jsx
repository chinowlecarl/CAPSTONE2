import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useProfile } from '../hooks/useProfile'
import PageWrapper from '../components/PageWrapper'

export default function EventDetailPage() {
  const { id } = useParams()
  const { profile } = useProfile()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [registration, setRegistration] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [id, profile])

  const fetchData = async () => {
    const { data: ev } = await supabase.from('events').select('*').eq('id', id).single()
    setEvent(ev)

    if (profile) {
      const { data: reg } = await supabase
        .from('registrations')
        .select('*')
        .eq('event_id', id)
        .eq('user_id', profile.id)
        .single()
      setRegistration(reg || null)
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    if (!profile) { navigate('/signin'); return }
    const { data } = await supabase
      .from('registrations')
      .insert({ event_id: id, user_id: profile.id, status: 'confirmed' })
      .select().single()
    setRegistration(data)
  }

  const handleUnregister = async () => {
    await supabase.from('registrations').delete().eq('id', registration.id)
    setRegistration(null)
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const formatTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
  }

  if (loading) return <PageWrapper><Spinner /></PageWrapper>
  if (!event) return <PageWrapper><p style={{ padding: '2rem', color: 'var(--gray-500)' }}>Event not found.</p></PageWrapper>

  return (
    <PageWrapper>
      {/* Hero */}
      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>{event.title}</h1>
        <p style={styles.heroSub}>{event.description?.slice(0, 120)}{event.description?.length > 120 ? '?' : ''}</p>
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
            <div>
              <div style={styles.metaMain}>{event.location}</div>
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}><span style={styles.sectionIcon}>ℹ️</span> About This Event</h2>
        <p style={styles.sectionText}>{event.description}</p>

        {/* Registration CTA */}
        <div style={styles.ctaBox}>
          {registration ? (
            <>
              <div>
                <p style={styles.ctaLabel}>Your Spot is Secured</p>
                <p style={styles.ctaId}>Registration ID: {registration.id}</p>
              </div>
              <div style={styles.ctaActions}>
                <button style={styles.btnUnregister} onClick={handleUnregister}>↩ Unregister</button>
                <button style={styles.btnTicket} onClick={() => navigate(`/ticket/${registration.id}`)}>🎫 View Ticket</button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p style={styles.ctaLabel}>Secure Your Spot</p>
                <p style={styles.ctaId}>Capacity: {event.capacity} seats</p>
              </div>
              <button style={styles.btnRegister} onClick={handleRegister}>+ Register Now</button>
            </>
          )}
        </div>
      </div>
    </PageWrapper>
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
  hero: {
    background: 'var(--green-dark)', borderRadius: '16px',
    padding: '3rem', color: 'var(--white)', marginBottom: '1.5rem',
    borderBottom: '4px solid var(--gold)',
  },
  heroTitle: { fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.15, marginBottom: '0.75rem' },
  heroSub: { fontSize: '1rem', opacity: 0.85, marginBottom: '2rem', maxWidth: '600px' },
  heroMeta: { display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' },
  metaItem: { display: 'flex', alignItems: 'center', gap: '12px' },
  metaIcon: {
    width: '40px', height: '40px', borderRadius: '10px',
    background: 'rgba(255,255,255,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
  },
  metaMain: { fontSize: '0.95rem', fontWeight: 600, color: 'var(--white)' },
  metaSub: { fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', marginTop: '2px' },
  metaDivider: { width: '1px', height: '40px', background: 'rgba(255,255,255,0.2)' },
  section: {
    background: 'var(--white)', borderRadius: '12px',
    padding: '1.75rem', border: '1px solid var(--gray-200)',
  },
  sectionTitle: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' },
  sectionIcon: { fontSize: '1rem' },
  sectionText: { fontSize: '0.9rem', color: 'var(--gray-700)', lineHeight: 1.7, marginBottom: '1.5rem' },
  ctaBox: {
    background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
    borderRadius: '10px', padding: '1rem 1.25rem',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: '1rem',
  },
  ctaLabel: { fontSize: '0.875rem', fontWeight: 600, color: 'var(--gray-900)' },
  ctaId: { fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '2px' },
  ctaActions: { display: 'flex', gap: '8px' },
  btnRegister: {
    padding: '9px 20px', background: 'var(--green-dark)',
    color: 'var(--white)', border: 'none', borderRadius: '8px',
    fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
  },
  btnUnregister: {
    padding: '9px 16px', background: 'var(--white)',
    border: '1px solid #fcd34d', color: '#d97706',
    borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
  },
  btnTicket: {
    padding: '9px 16px', background: 'var(--green-dark)',
    color: 'var(--white)', border: 'none',
    borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
  },
}
