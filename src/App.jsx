import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useProfile } from './hooks/useProfile'

import SignIn from './pages/SignIn'
import Register from './pages/Register'
import Home from './pages/Home'
import EventsPage from './pages/EventsPage'
import EventDetailPage from './pages/EventDetailPage'
import TicketPage from './pages/TicketPage'

import AdminRoute from './components/AdminRoute'
import AdminHome from './pages/admin/AdminHome'
import ManageEvents from './pages/admin/ManageEvents'
import CreateEvent from './pages/admin/CreateEvent'
import EventDetails from './pages/admin/EventDetails'
import CheckInDesk from './pages/admin/CheckInDesk'

function PrivateRoute({ children }) {
  const { profile, loading } = useProfile()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#1a3c34', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
  if (!profile) return <Navigate to="/signin" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/register" element={<Register />} />

        {/* Protected user routes */}
        <Route path="/events" element={<PrivateRoute><EventsPage /></PrivateRoute>} />
        <Route path="/events/:id" element={<PrivateRoute><EventDetailPage /></PrivateRoute>} />
        <Route path="/ticket/:id" element={<PrivateRoute><TicketPage /></PrivateRoute>} />

        {/* Admin routes */}
        <Route path="/manage-events" element={<AdminRoute><ManageEvents /></AdminRoute>} />
        <Route path="/manage-events/create" element={<AdminRoute><CreateEvent /></AdminRoute>} />
        <Route path="/manage-events/edit/:id" element={<AdminRoute><CreateEvent /></AdminRoute>} />
        <Route path="/manage-events/:id" element={<AdminRoute><EventDetails /></AdminRoute>} />
        <Route path="/check-in-desk/:id" element={<AdminRoute><CheckInDesk /></AdminRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
