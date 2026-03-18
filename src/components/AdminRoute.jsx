import { Navigate } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'

export default function AdminRoute({ children }) {
  const { profile, loading } = useProfile()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--gray-200)', borderTopColor: 'var(--green-dark)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!profile || profile.role !== 'admin') return <Navigate to="/events" replace />
  return children
}
