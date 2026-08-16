import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, Flight, Passenger, ApiResponse } from '../api';

interface PendingBooking {
  bookingId: number;
  clientSecret: string;
  totalAmount: number;
  paymentIntentId: string;
}

export default function BookingPage() {
  const { flightId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const passengerCount = Number(searchParams.get('passengers') || 1);

  const [flight, setFlight] = useState<Flight | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>(
    Array.from({ length: passengerCount }, () => emptyPassenger())
  );
  const [pending, setPending] = useState<PendingBooking | null>(null);
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState('12/30');
  const [cardCvc, setCardCvc] = useState('123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!flightId) return;
    api.get<ApiResponse<Flight>>(`/flights/${flightId}`)
      .then((res) => setFlight(res.data))
      .catch((err) => setError(err.message));
  }, [flightId]);

  function updatePassenger(idx: number, field: keyof Passenger, value: string) {
    setPassengers((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  async function startBooking(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<ApiResponse<PendingBooking>>('/bookings', {
        flightId: Number(flightId),
        passengers,
      });
      setPending(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      // In a real app, we'd use Stripe Elements + stripe.confirmCardPayment(clientSecret, {payment_method: {...}})
      // For this demo, we simulate the webhook by directly calling a confirm endpoint via the backend.
      // The backend's webhook handler is the source of truth; here we just wait for it.
      // Since we can't trigger a real Stripe webhook in this demo, we expose a confirm helper:
      await api.post(`/bookings/${pending.bookingId}/simulate-payment`, {
        paymentIntentId: pending.paymentIntentId,
        status: 'succeeded',
      });
      setSuccess('Payment successful! Redirecting…');
      setTimeout(() => navigate('/bookings'), 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!flight) return <div className="card">Loading flight…</div>;

  return (
    <>
      <div className="card">
        <h2>Book Flight</h2>
        <div style={{ marginBottom: 12 }}>
          <strong>{flight.airline} · {flight.flightNumber}</strong> — {flight.origin} → {flight.destination}
          <br />
          {flight.departureDate} · {flight.departureTime} – {flight.arrivalTime}
          <br />
          <span style={{ fontSize: 18, fontWeight: 700 }}>₹{flight.fare.toLocaleString('en-IN')}</span> per passenger
        </div>
      </div>

      {!pending && (
        <div className="card">
          <h3>Passenger details ({passengerCount})</h3>
          <form onSubmit={startBooking}>
            {passengers.map((p, idx) => (
              <div key={idx} style={{ borderTop: idx > 0 ? '1px solid #e2e8f0' : 'none', paddingTop: idx > 0 ? 12 : 0, marginTop: idx > 0 ? 12 : 0 }}>
                <strong>Passenger {idx + 1}</strong>
                <div className="row">
                  <div>
                    <label>Full name</label>
                    <input className="input" value={p.fullName} onChange={(e) => updatePassenger(idx, 'fullName', e.target.value)} required />
                  </div>
                  <div>
                    <label>Date of birth</label>
                    <input className="input" type="date" value={p.dateOfBirth} onChange={(e) => updatePassenger(idx, 'dateOfBirth', e.target.value)} required />
                  </div>
                </div>
                <div className="row">
                  <div>
                    <label>Nationality</label>
                    <input className="input" value={p.nationality} onChange={(e) => updatePassenger(idx, 'nationality', e.target.value)} required />
                  </div>
                  <div>
                    <label>Passport number</label>
                    <input className="input" value={p.passportNumber} onChange={(e) => updatePassenger(idx, 'passportNumber', e.target.value)} required />
                  </div>
                </div>
                <div className="row">
                  <div>
                    <label>Email</label>
                    <input className="input" type="email" value={p.email} onChange={(e) => updatePassenger(idx, 'email', e.target.value)} required />
                  </div>
                  <div>
                    <label>Contact number</label>
                    <input className="input" value={p.contactNumber} onChange={(e) => updatePassenger(idx, 'contactNumber', e.target.value)} required />
                  </div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, fontSize: 18, fontWeight: 700 }}>
              Total: ₹{(flight.fare * passengerCount).toLocaleString('en-IN')}
            </div>
            {error && <div className="error">{error}</div>}
            <button className="btn" style={{ marginTop: 12 }} disabled={loading}>
              {loading ? 'Reserving seats…' : 'Continue to payment'}
            </button>
          </form>
        </div>
      )}

      {pending && (
        <div className="card">
          <h3>Payment</h3>
          <p>Total: <strong>₹{pending.totalAmount.toLocaleString('en-IN')}</strong></p>
          <p style={{ fontSize: 13, color: '#64748b' }}>
            Seats are reserved. Complete payment to confirm your booking.
          </p>
          <form onSubmit={confirmPayment}>
            <label>Card number</label>
            <input className="input" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
            <div className="row">
              <div>
                <label>Expiry</label>
                <input className="input" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} />
              </div>
              <div>
                <label>CVC</label>
                <input className="input" value={cardCvc} onChange={(e) => setCardCvc(e.target.value)} />
              </div>
            </div>
            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}
            <button className="btn" style={{ marginTop: 12 }} disabled={loading}>
              {loading ? 'Processing…' : `Pay ₹${pending.totalAmount.toLocaleString('en-IN')}`}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function emptyPassenger(): Passenger {
  return {
    fullName: '',
    dateOfBirth: '',
    nationality: '',
    passportNumber: '',
    email: '',
    contactNumber: '',
  };
}
