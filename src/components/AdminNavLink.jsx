import { NavLink } from 'react-router-dom'

export default function AdminNavLink({ to, icon, children, home }) {
  if (home) {
    return (
      <NavLink
        to="/manage-events"
        end
        style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 1.25rem',
          color: 'var(--white)',
          background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
          fontSize: '0.875rem', fontWeight: 500,
          borderLeft: isActive ? '3px solid var(--gold-light)' : '3px solid transparent',
          transition: 'all 0.15s',
        })}
      >
        <span>{icon}</span> {children}
      </NavLink>
    )
  }

  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 1.25rem',
        color: 'var(--white)',
        background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
        fontSize: '0.875rem', fontWeight: 500,
        borderLeft: isActive ? '3px solid var(--gold-light)' : '3px solid transparent',
        transition: 'all 0.15s',
      })}
    >
      <span>{icon}</span> {children}
    </NavLink>
  )
}
