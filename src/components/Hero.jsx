export default function Hero({ title, subtitle, date, time, location }) {
  return (
    <div style={styles.hero}>
      <h1 style={styles.title}>{title}</h1>
      {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
      <div style={styles.meta}>
        {(date || time) && (
          <div style={styles.metaItem}>
            <span style={styles.icon}>📅</span>
            <span>{date}</span>
            {time && <><span style={{ margin: '0 4px' }}>•</span><span style={{ ...styles.icon, background: '#d97706' }}>⏰</span><span>{time}</span></>}
          </div>
        )}
        {location && (
          <div style={styles.metaItem}>
            <span style={{ ...styles.icon, background: '#d97706' }}>📍</span>
            <span>{location}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  hero: {
    background: 'var(--green-dark)',
    borderRadius: '16px',
    padding: '3rem',
    color: 'var(--white)',
    marginBottom: '2rem',
  },
  title: { fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.15, marginBottom: '0.75rem' },
  subtitle: { fontSize: '1rem', opacity: 0.85, marginBottom: '1.5rem', maxWidth: '600px' },
  meta: { display: 'flex', gap: '2rem', flexWrap: 'wrap' },
  metaItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' },
  icon: {
    background: 'var(--green-mid)',
    padding: '4px 6px',
    borderRadius: '6px',
    fontSize: '0.75rem',
  },
}
