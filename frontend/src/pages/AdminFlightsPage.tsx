import { useEffect, useState } from 'react';
import { api, Flight, ApiResponse } from '../api';

interface FlightForm {
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  fare: number;
  seatsTotal: number;
}

const emptyForm: FlightForm = {
  flightNumber: '',
  airline: '',
  origin: '',
  destination: '',
  departureDate: '',
  departureTime: '',
  arrivalTime: '',
  fare: 0,
  seatsTotal: 0,
};

export default function AdminFlightsPage() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [form, setForm] = useState<FlightForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function load() {
    api.get<ApiResponse<Flight[]>>('/flights?limit=50')
      .then((res) => setFlights(res.data))
      .catch((err) => setError(err.message));
  }

  useEffect(() => { load(); }, []);

  function update<K extends keyof FlightForm>(key: K, value: FlightForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      if (editingId) {
        await api.put(`/admin/flights/${editingId}`, form);
        setSuccess('Flight updated');
      } else {
        await api.post('/admin/flights', form);
        setSuccess('Flight created');
      }
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEdit(f: Flight) {
    setEditingId(f.id);
    setForm({
      flightNumber: f.flightNumber,
      airline: f.airline,
      origin: f.origin,
      destination: f.destination,
      departureDate: f.departureDate,
      departureTime: f.departureTime,
      arrivalTime: f.arrivalTime,
      fare: f.fare,
      seatsTotal: f.seatsAvailable, // best-effort; backend stores seats_total separately
    });
  }

  async function remove(id: number) {
    if (!confirm('Delete this flight?')) return;
    try {
      await api.del(`/admin/flights/${id}`);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <>
      <h2>Manage Flights</h2>
      <div className="card">
        <h3>{editingId ? 'Edit flight' : 'Add new flight'}</h3>
        <form onSubmit={submit}>
          <div className="row">
            <div>
              <label>Flight number</label>
              <input className="input" value={form.flightNumber} onChange={(e) => update('flightNumber', e.target.value)} required />
            </div>
            <div>
              <label>Airline</label>
              <input className="input" value={form.airline} onChange={(e) => update('airline', e.target.value)} required />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Origin</label>
              <input className="input" value={form.origin} onChange={(e) => update('origin', e.target.value.toUpperCase())} required />
            </div>
            <div>
              <label>Destination</label>
              <input className="input" value={form.destination} onChange={(e) => update('destination', e.target.value.toUpperCase())} required />
            </div>
          </div>
          <div className="row-3">
            <div>
              <label>Departure date</label>
              <input className="input" type="date" value={form.departureDate} onChange={(e) => update('departureDate', e.target.value)} required />
            </div>
            <div>
              <label>Departure time</label>
              <input className="input" type="time" value={form.departureTime} onChange={(e) => update('departureTime', e.target.value)} required />
            </div>
            <div>
              <label>Arrival time</label>
              <input className="input" type="time" value={form.arrivalTime} onChange={(e) => update('arrivalTime', e.target.value)} required />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Fare (₹)</label>
              <input className="input" type="number" min={1} value={form.fare} onChange={(e) => update('fare', Number(e.target.value))} required />
            </div>
            <div>
              <label>Total seats</label>
              <input className="input" type="number" min={1} value={form.seatsTotal} onChange={(e) => update('seatsTotal', Number(e.target.value))} required />
            </div>
          </div>
          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}
          <button className="btn" style={{ marginTop: 12 }}>
            {editingId ? 'Update flight' : 'Create flight'}
          </button>
          {editingId && (
            <button type="button" className="btn btn-secondary" style={{ marginTop: 12, marginLeft: 8 }}
              onClick={() => { setEditingId(null); setForm(emptyForm); }}>
              Cancel
            </button>
          )}
        </form>
      </div>

      <div className="card">
        <h3>All flights</h3>
        <table>
          <thead>
            <tr>
              <th>Flight</th><th>Route</th><th>Date</th><th>Fare</th><th>Seats</th><th></th>
            </tr>
          </thead>
          <tbody>
            {flights.map((f) => (
              <tr key={f.id}>
                <td>{f.airline} {f.flightNumber}</td>
                <td>{f.origin} → {f.destination}</td>
                <td>{f.departureDate}</td>
                <td>₹{f.fare.toLocaleString('en-IN')}</td>
                <td>{f.seatsAvailable}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => startEdit(f)}>Edit</button>
                  {' '}
                  <button className="btn btn-danger" onClick={() => remove(f.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
