import { useEffect, useState } from 'react';
import { api, Booking, ApiResponse } from '../api';

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    api.get<ApiResponse<Booking[]>>(`/admin/bookings?${params.toString()}`)
      .then((res) => setBookings(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [status]);

  return (
    <>
      <h2>All Bookings</h2>
      <div className="card">
        <label>Filter by status</label>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 240 }}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      {loading ? <div className="card">Loading…</div> : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Flight</th><th>Route</th><th>Pax</th><th>Amount</th><th>Status</th><th>Created</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>#{b.id}</td>
                  <td>{b.flight ? `${b.flight.airline} ${b.flight.flightNumber}` : `#${b.flightId}`}</td>
                  <td>{b.flight ? `${b.flight.origin} → ${b.flight.destination}` : '—'}</td>
                  <td>{b.passengers}</td>
                  <td>₹{b.totalAmount.toLocaleString('en-IN')}</td>
                  <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                  <td>{new Date(b.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
