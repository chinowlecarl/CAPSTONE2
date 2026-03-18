import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import AdminLayout from '../../components/AdminLayout'
import jsQR from 'jsqr'

export default function CheckInDesk() {
  const { id } = useParams()
  const [event, setEvent] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null) // { success, name, message }
  const [recentCheckins, setRecentCheckins] = useState([])
  const videoRef = useRef()
  const canvasRef = useRef()
  const streamRef = useRef()
  const rafRef = useRef()

  useEffect(() => {
    supabase.from('events').select('*').eq('id', id).single()
      .then(({ data }) => setEvent(data))
    fetchCheckins()
  }, [id])

  const fetchCheckins = async () => {
    const { data } = await supabase
      .from('registrations')
      .select('*, profiles(*)')
      .eq('event_id', id)
      .eq('checked_in', true)
      .order('checked_in_at', { ascending: false })
      .limit(10)
    setRecentCheckins(data || [])
  }

  const startScanner = async () => {
    setResult(null)
    setScanning(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      videoRef.current.play()
      rafRef.current = requestAnimationFrame(scanFrame)
    } catch (err) {
      setResult({ success: false, message: 'Camera access denied.' })
      setScanning(false)
    }
  }

  const stopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setScanning(false)
  }

  const scanFrame = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame)
      return
    }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height)
    if (code) {
      stopScanner()
      processCheckIn(code.data)
    } else {
      rafRef.current = requestAnimationFrame(scanFrame)
    }
  }

  const processCheckIn = async (registrationId) => {
    const { data: reg, error } = await supabase
      .from('registrations')
      .select('*, profiles(*)')
      .eq('id', registrationId)
      .eq('event_id', id)
      .single()

    if (error || !reg) {
      setResult({ success: false, message: 'Invalid or unrecognized ticket.' })
      return
    }
    if (reg.checked_in) {
      setResult({ success: false, name: reg.profiles?.full_name, message: 'Already checked in.' })
      return
    }

    await supabase.from('registrations')
      .update({ checked_in: true, checked_in_at: new Date().toISOString() })
      .eq('id', registrationId)

    setResult({ success: true, name: reg.profiles?.full_name, message: 'Check-in successful!' })
    fetchCheckins()
  }

  const handleManualCheckIn = async (regId) => {
    processCheckIn(regId.trim())
  }

  return (
    <AdminLayout>
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.title}>Check-In Desk</h1>
          <p style={styles.sub}>{event?.title || 'Loading event...'}</p>
        </div>

        <div style={styles.grid}>
          {/* Scanner Panel */}
          <div style={styles.scannerCard}>
            <div style={styles.scannerBox}>
              {scanning ? (
                <>
                  <video ref={videoRef} style={styles.video} muted playsInline />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <div style={styles.scanLine} />
                </>
              ) : (
                <div style={styles.scanPlaceholder}>
                  <span style={styles.scanIcon}>⊞</span>
                  <p style={styles.scanHint}>Camera inactive</p>
                </div>
              )}
            </div>

            <div style={styles.scanActions}>
              {!scanning ? (
                <button style={styles.startBtn} onClick={startScanner}>
                  📷 Start Scanner
                </button>
              ) : (
                <button style={styles.stopBtn} onClick={stopScanner}>
                  ⏹ Stop Scanner
                </button>
              )}
            </div>

            {/* Result */}
            {result && (
              <div style={{ ...styles.resultBox, ...(result.success ? styles.resultSuccess : styles.resultError) }}>
                <span style={styles.resultIcon}>{result.success ? '✓' : '✗'}</span>
                <div>
                  {result.name && <p style={styles.resultName}>{result.name}</p>}
                  <p style={styles.resultMsg}>{result.message}</p>
                </div>
              </div>
            )}

            {/* Manual Entry */}
            <ManualEntry onSubmit={handleManualCheckIn} />
          </div>

          {/* Recent Check-ins */}
          <div style={styles.recentCard}>
            <h2 style={styles.recentTitle}>
              Recent Check-ins
              <span style={styles.countBadge}>{recentCheckins.length}</span>
            </h2>
            {recentCheckins.length === 0 ? (
              <p style={styles.emptyText}>No check-ins yet.</p>
            ) : (
              <div style={styles.list}>
                {recentCheckins.map(r => (
                  <div key={r.id} style={styles.listItem}>
                    <div style={styles.listAvatar}>
                      {r.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p style={styles.listName}>{r.profiles?.full_name}</p>
                      <p style={styles.listEmail}>{r.profiles?.email}</p>
                    </div>
                    <span style={styles.checkedBadge}>✓</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

function ManualEntry({ onSubmit }) {
  const [val, setVal] = useState('')
  return (
    <div style={styles.manualWrap}>
      <p style={styles.manualLabel}>Manual Entry</p>
      <div style={styles.manualRow}>
        <input style={styles.manualInput} value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="Paste Registration ID..." />
        <button style={styles.manualBtn} onClick={() => { onSubmit(val); setVal('') }}>
          Go
        </button>
      </div>
    </div>
  )
}

const styles = {
  page: { padding: '2rem' },
  header: { marginBottom: '1.5rem' },
  title: { fontSize: '1.75rem', fontWeight: 800 },
  sub: { fontSize: '0.875rem', color: 'var(--gray-500)', marginTop: '4px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' },
  scannerCard: {
    background: 'var(--white)', border: '1px solid var(--gray-200)',
    borderRadius: '14px', padding: '1.5rem',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  scannerBox: {
    background: '#000', borderRadius: '12px',
    aspectRatio: '4/3', position: 'relative',
    overflow: 'hidden', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  scanLine: {
    position: 'absolute', left: '10%', right: '10%', height: '2px',
    background: 'var(--gold)',
    animation: 'scanLine 2s linear infinite',
    boxShadow: '0 0 8px var(--gold)',
  },
  scanPlaceholder: { textAlign: 'center' },
  scanIcon: { fontSize: '3rem', display: 'block', color: 'var(--gray-600)', marginBottom: '8px' },
  scanHint: { color: 'var(--gray-500)', fontSize: '0.85rem' },
  scanActions: { display: 'flex', gap: '10px' },
  startBtn: {
    flex: 1, padding: '11px', background: 'var(--green-dark)',
    color: 'var(--white)', border: 'none', borderRadius: '8px',
    fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
  },
  stopBtn: {
    flex: 1, padding: '11px', background: 'var(--red)',
    color: 'var(--white)', border: 'none', borderRadius: '8px',
    fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
  },
  resultBox: {
    borderRadius: '10px', padding: '12px 16px',
    display: 'flex', alignItems: 'center', gap: '12px',
    border: '1px solid transparent',
  },
  resultSuccess: { background: '#dcfce7', borderColor: '#86efac' },
  resultError: { background: '#fee2e2', borderColor: '#fca5a5' },
  resultIcon: { fontSize: '1.25rem', fontWeight: 700 },
  resultName: { fontWeight: 700, fontSize: '0.9rem' },
  resultMsg: { fontSize: '0.82rem', color: 'var(--gray-600)', marginTop: '2px' },
  manualWrap: { borderTop: '1px solid var(--gray-100)', paddingTop: '1rem' },
  manualLabel: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '6px' },
  manualRow: { display: 'flex', gap: '8px' },
  manualInput: {
    flex: 1, padding: '8px 12px', border: '1px solid var(--gray-200)',
    borderRadius: '8px', fontSize: '0.8rem',
  },
  manualBtn: {
    padding: '8px 16px', background: 'var(--green-dark)',
    color: 'var(--white)', border: 'none', borderRadius: '8px',
    fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
  },
  recentCard: {
    background: 'var(--white)', border: '1px solid var(--gray-200)',
    borderRadius: '14px', padding: '1.5rem',
  },
  recentTitle: {
    fontSize: '1rem', fontWeight: 700, marginBottom: '1rem',
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  countBadge: {
    background: 'var(--gray-100)', color: 'var(--gray-600)',
    fontSize: '0.75rem', fontWeight: 600,
    padding: '2px 8px', borderRadius: '99px',
  },
  emptyText: { color: 'var(--gray-400)', fontSize: '0.875rem' },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  listItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 0', borderBottom: '1px solid var(--gray-100)',
  },
  listAvatar: {
    width: '34px', height: '34px', borderRadius: '50%',
    background: 'var(--green-dark)', color: 'var(--white)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
  },
  listName: { fontSize: '0.875rem', fontWeight: 600 },
  listEmail: { fontSize: '0.75rem', color: 'var(--gray-400)' },
  checkedBadge: {
    marginLeft: 'auto', background: '#dcfce7', color: '#16a34a',
    width: '24px', height: '24px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
  },
}
