import { NavLink } from 'react-router-dom'

export default function HeaderNavLink({ to, children }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        fontSize: '0.9rem',
        fontWeight: 500,
        color: isActive ? 'var(--green-dark)' : 'var(--gray-700)',
        borderBottom: isActive ? '2px solid var(--green-dark)' : '2px solid transparent',
        paddingBottom: '2px',
        transition: 'all 0.2s',
      })}
    >
      {children}
    </NavLink>
  )
}
