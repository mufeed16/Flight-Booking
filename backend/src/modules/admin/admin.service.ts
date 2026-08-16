import { pool } from '../../db/pool';

export interface FlightInput {
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

export async function createFlight(input: FlightInput) {
  const res = await pool.query(
    `INSERT INTO flights
      (flight_number, airline, origin, destination, departure_date, departure_time, arrival_time, fare, seats_total, seats_available)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
     RETURNING *`,
    [
      input.flightNumber,
      input.airline,
      input.origin.toUpperCase(),
      input.destination.toUpperCase(),
      input.departureDate,
      input.departureTime,
      input.arrivalTime,
      input.fare,
      input.seatsTotal,
    ]
  );
  return res.rows[0];
}

export async function updateFlight(id: number, input: Partial<FlightInput>) {
  const fields: string[] = [];
  const values: any[] = [];
  const map: Record<string, string> = {
    flightNumber: 'flight_number',
    airline: 'airline',
    origin: 'origin',
    destination: 'destination',
    departureDate: 'departure_date',
    departureTime: 'departure_time',
    arrivalTime: 'arrival_time',
    fare: 'fare',
    seatsTotal: 'seats_total',
  };
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    const col = map[k];
    if (!col) continue;
    values.push(k === 'origin' || k === 'destination' ? String(v).toUpperCase() : v);
    fields.push(`${col} = $${values.length}`);
  }
  if (!fields.length) {
    const res = await pool.query('SELECT * FROM flights WHERE id = $1', [id]);
    return res.rows[0];
  }
  values.push(id);
  const res = await pool.query(
    `UPDATE flights SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );
  return res.rows[0];
}

export async function deleteFlight(id: number) {
  // Refuse to delete a flight with confirmed bookings — keep history intact.
  const ref = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM bookings WHERE flight_id = $1 AND status IN ('pending','confirmed')`,
    [id]
  );
  if (Number(ref.rows[0].count) > 0) {
    return { deleted: false, reason: 'Flight has active bookings' };
  }
  await pool.query('DELETE FROM flights WHERE id = $1', [id]);
  return { deleted: true };
}

export async function getDashboardStats() {
  const todayRes = await pool.query<{ count: string; revenue: string }>(
    `SELECT COUNT(*)::int AS count,
            COALESCE(SUM(total_amount),0)::float AS revenue
       FROM bookings
      WHERE status = 'confirmed'
        AND created_at >= date_trunc('day', NOW())`,
  );
  const totalRes = await pool.query<{ count: string; revenue: string }>(
    `SELECT COUNT(*)::int AS count,
            COALESCE(SUM(total_amount),0)::float AS revenue
       FROM bookings WHERE status = 'confirmed'`,
  );
  const cancelledRes = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM bookings WHERE status = 'cancelled'`,
  );
  const totalBookings = Number(totalRes.rows[0].count) + Number(cancelledRes.rows[0].count);
  const cancellationRate = totalBookings > 0
    ? Number(cancelledRes.rows[0].count) / totalBookings
    : 0;

  return {
    bookingsToday: Number(todayRes.rows[0].count),
    revenueToday: Number(todayRes.rows[0].revenue),
    totalBookings: Number(totalRes.rows[0].count),
    totalRevenue: Number(totalRes.rows[0].revenue),
    cancellationRate,
  };
}
