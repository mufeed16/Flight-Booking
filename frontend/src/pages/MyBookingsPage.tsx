import { useEffect, useState } from 'react';
import { api, Booking, ApiResponse } from '../api';

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api.get<ApiResponse<Booking[]>>('/bookings')
      .then((res) => setBookings(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function cancel(id: number) {
    if (!confirm('Cancel this booking? Refund will be issued.')) return;
    try {
      await api.post(`/bookings/${id}/cancel`);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) return <div className="card">Loading…</div>;
  if (error) return <div className="card error">{error}</div>;
  if (bookings.length === 0) return <div className="card">No bookings yet.</div>;

  return (
    <>
      <h2>My Bookings</h2>
      {bookings.map((b) => (
        <div className="card" key={b.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600 }}>
                {b.flight ? `${b.flight.airline} · ${b.flight.flightNumber}` : `Flight #${b.flightId}`}
              </div>
              {b.flight && (
                <div style={{ color: '#475569', fontSize: 14 }}>
                  {b.flight.origin} → {b.flight.destination} · {b.flight.departureDate} · {b.flight.departureTime}
                </div>
              )}
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                {b.passengers} passenger(s) · Booked {new Date(b.createdAt).toLocaleString()}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`badge badge-${b.status}`}>{b.status.toUpperCase()}</span>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
                ₹{b.totalAmount.toLocaleString('en-IN')}
              </div>
              {b.status === 'confirmed' && (
                <button className="btn btn-danger" style={{ marginTop: 8 }} onClick={() => cancel(b.id)}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
