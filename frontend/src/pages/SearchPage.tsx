import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Flight, ApiResponse } from '../api';

export default function SearchPage() {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [results, setResults] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (origin) params.set('origin', origin);
      if (destination) params.set('destination', destination);
      if (date) params.set('date', date);
      params.set('passengers', String(passengers));
      const res = await api.get<ApiResponse<Flight[]>>(`/flights?${params.toString()}`);
      setResults(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>Search Flights</h2>
        <form onSubmit={onSearch}>
          <div className="row-3">
            <div>
              <label>Origin (city code)</label>
              <input className="input" placeholder="e.g. DEL" value={origin} onChange={(e) => setOrigin(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label>Destination (city code)</label>
              <input className="input" placeholder="e.g. BOM" value={destination} onChange={(e) => setDestination(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label>Departure date</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label>Passengers</label>
            <input className="input" type="number" min={1} max={9} value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} style={{ maxWidth: 120 }} />
          </div>
          <button className="btn" style={{ marginTop: 16 }} disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>
        {error && <div className="error">{error}</div>}
      </div>

      {searched && !loading && results.length === 0 && (
        <div className="card">No flights found.</div>
      )}

      {results.map((f) => (
        <div className="card" key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{f.airline} · {f.flightNumber}</div>
            <div style={{ color: '#475569', marginTop: 4 }}>
              {f.origin} → {f.destination} &nbsp;·&nbsp; {f.departureDate} &nbsp;·&nbsp; {f.departureTime} – {f.arrivalTime}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              {f.seatsAvailable} seats available
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>₹{f.fare.toLocaleString('en-IN')}</div>
            <button
              className="btn"
              style={{ marginTop: 8 }}
              disabled={f.seatsAvailable < passengers}
              onClick={() => navigate(`/book/${f.id}?passengers=${passengers}`)}
            >
              {f.seatsAvailable < passengers ? 'Not enough seats' : 'Book'}
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
