import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SearchPage from './pages/SearchPage';
import BookingPage from './pages/BookingPage';
import MyBookingsPage from './pages/MyBookingsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminFlightsPage from './pages/AdminFlightsPage';
import AdminBookingsPage from './pages/AdminBookingsPage';

function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <nav className="nav">
      <Link to="/search" style={{ fontWeight: 600 }}>✈ FlightBook</Link>
      {user && <Link to="/search">Search</Link>}
      {user && <Link to="/bookings">My Bookings</Link>}
      {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
      <div className="spacer" />
      {user ? (
        <>
          <span style={{ fontSize: 14 }}>{user.email} ({user.role})</span>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 12px' }}
            onClick={async () => { await logout(); navigate('/login'); }}
          >
            Logout
          </button>
        </>
      ) : (
        <>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </>
      )}
    </nav>
  );
}

function Protected({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/search" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Nav />
      <div className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/search" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/search" element={<Protected><SearchPage /></Protected>} />
          <Route path="/book/:flightId" element={<Protected><BookingPage /></Protected>} />
          <Route path="/bookings" element={<Protected><MyBookingsPage /></Protected>} />
          <Route path="/admin" element={<Protected adminOnly><AdminDashboardPage /></Protected>} />
          <Route path="/admin/flights" element={<Protected adminOnly><AdminFlightsPage /></Protected>} />
          <Route path="/admin/bookings" element={<Protected adminOnly><AdminBookingsPage /></Protected>} />
          <Route path="*" element={<Navigate to="/search" replace />} />
        </Routes>
      </div>
    </>
  );
}
