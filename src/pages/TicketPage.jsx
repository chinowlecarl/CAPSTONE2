import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import PageWrapper from '../components/PageWrapper'
import QRCode from 'qrcode'

export default function TicketPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const canvasRef = useRef()

  useEffect(() => { fetchTicket() }, [id])

  const fetchTicket = async () => {
    const { data: reg } = await supabase
      .from('registrations')
      .select('*, events(*), profiles(*)')
      .eq('id', id)
      .single()
    setData(reg)
    setLoading(false)
  }

  useEffect(() => {
    if (data && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, data.id, {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      })
    }
  }, [data])

  const formatDate = (d) => {
    if (!d) return ''
    const date = new Date(d)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const formatTime = (t) => {
    if (!t) return ''
    return t.slice(0, 5)
  }

  if (loading) return <PageWrapper><Spinner /></PageWrapper>
  if (!data) return <PageWrapper><p style={{ padding: '2rem' }}>Ticket not found.</p></PageWrapper>

  const event = data.events
  const profile = data.profiles

  return (
    <PageWrapper>
      <div style={styles.wrapper}>
        <div style={styles.ticket}>
          {/* Ticket top */}
          <div style={styles.ticketTop}>
            <p style={styles.eventTitle}>{event?.title?.toUpperCase()}</p>
            <p style={styles.location}>{event?.location}</p>
            <div style={styles.dateBadge}>
              <span style={styles.dateChip}>📅 {formatDate(event?.date)}</span>
              <span style={styles.timeChip}>🕐 {formatTime(event?.time)}</span>
            </div>
          </div>

          {/* Ticket bottom */}
          <div style={styles.ticketBottom}>
            <p style={styles.attendeeName}>{profile?.full_name}</p>
            <p style={styles.attendeeEmail}>{profile?.email}</p>

            <div style={styles.qrWrap}>
              <canvas ref={canvasRef} style={styles.qrCanvas} />
            </div>

            <div style={styles.scanNote}>
              <span style={styles.scanIcon}>⊞</span>
              <span style={styles.scanText}>Scan at the entrance</span>
            </div>

            <p style={styles.ticketId}>{data.id}</p>
          </div>
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
  wrapper: { display: 'flex', justifyContent: 'center', padding: '2rem 0' },
  ticket: {
    width: '100%', maxWidth: '340px',
    background: 'var(--white)',
    border: '1px solid var(--gray-200)',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
  ticketTop: {
    background: 'var(--green-dark)',
    padding: '1.75rem 1.5rem',
    textAlign: 'center',
    color: 'var(--white)',
  },
  eventTitle: {
    fontSize: '1rem', fontWeight: 800,
    letterSpacing: '0.03em', lineHeight: 1.3, marginBottom: '0.5rem',
  },
  location: { fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.75rem' },
  dateBadge: { display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' },
  dateChip: {
    background: 'rgba(255,255,255,0.15)',
    padding: '4px 10px', borderRadius: '99px',
    fontSize: '0.78rem', fontWeight: 500,
  },
  timeChip: {
    background: 'var(--gold)', color: 'var(--white)',
    padding: '4px 10px', borderRadius: '99px',
    fontSize: '0.78rem', fontWeight: 600,
  },
  ticketBottom: {
    padding: '1.5rem',
    textAlign: 'center',
    borderTop: '2px dashed var(--gray-200)',
  },
  attendeeName: { fontSize: '1rem', fontWeight: 700, marginBottom: '2px' },
  attendeeEmail: { fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '1.25rem' },
  qrWrap: { display: 'flex', justifyContent: 'center', marginBottom: '1rem' },
  qrCanvas: { borderRadius: '8px' },
  scanNote: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '6px', background: 'var(--gray-50)',
    border: '1px solid var(--gray-200)',
    padding: '8px 16px', borderRadius: '8px',
    marginBottom: '1rem',
  },
  scanIcon: { fontSize: '0.9rem', color: 'var(--gray-500)' },
  scanText: { fontSize: '0.825rem', color: 'var(--gray-600)', fontWeight: 500 },
  ticketId: { fontSize: '0.7rem', color: 'var(--gray-400)', wordBreak: 'break-all' },
}
