import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiResponse } from '../api';

interface DashboardStats {
  bookingsToday: number;
  revenueToday: number;
  totalBookings: number;
  totalRevenue: number;
  cancellationRate: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<ApiResponse<DashboardStats>>('/admin/dashboard')
      .then((res) => setStats(res.data))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="card error">{error}</div>;
  if (!stats) return <div className="card">Loading…</div>;

  return (
    <>
      <h2>Admin Dashboard</h2>
      <div className="row">
        <div className="card">
          <div style={{ color: '#64748b', fontSize: 13 }}>Bookings today</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.bookingsToday}</div>
        </div>
        <div className="card">
          <div style={{ color: '#64748b', fontSize: 13 }}>Revenue today</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>₹{stats.revenueToday.toLocaleString('en-IN')}</div>
        </div>
      </div>
      <div className="row">
        <div className="card">
          <div style={{ color: '#64748b', fontSize: 13 }}>Total bookings</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.totalBookings}</div>
        </div>
        <div className="card">
          <div style={{ color: '#64748b', fontSize: 13 }}>Total revenue</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>₹{stats.totalRevenue.toLocaleString('en-IN')}</div>
        </div>
      </div>
      <div className="card">
        <div style={{ color: '#64748b', fontSize: 13 }}>Cancellation rate</div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{(stats.cancellationRate * 100).toFixed(1)}%</div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link to="/admin/flights" className="btn">Manage Flights</Link>
        <Link to="/admin/bookings" className="btn btn-secondary">All Bookings</Link>
      </div>
    </>
  );
}
