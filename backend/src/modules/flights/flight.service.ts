import { pool } from '../../db/pool';

export interface Flight {
  id: number;
  flight_number: string;
  airline: string;
  origin: string;
  destination: string;
  departure_date: string;
  departure_time: string;
  arrival_time: string;
  fare: number;
  seats_total: number;
  seats_available: number;
}

export interface FlightSearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  passengers?: number;
  page: number;
  limit: number;
}

// Lean shape returned to clients — drops internal columns.
export interface FlightDTO {
  id: number;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  fare: number;
  seatsAvailable: number;
}

function toDTO(f: Flight): FlightDTO {
  return {
    id: f.id,
    flightNumber: f.flight_number,
    airline: f.airline,
    origin: f.origin,
    destination: f.destination,
    departureDate: f.departure_date,
    departureTime: f.departure_time,
    arrivalTime: f.arrival_time,
    fare: Number(f.fare),
    seatsAvailable: f.seats_available,
  };
}

export async function searchFlights(params: FlightSearchParams): Promise<{ items: FlightDTO[]; total: number }> {
  const where: string[] = [];
  const values: any[] = [];

  if (params.origin) {
    values.push(params.origin.toUpperCase());
    where.push(`origin = $${values.length}`);
  }
  if (params.destination) {
    values.push(params.destination.toUpperCase());
    where.push(`destination = $${values.length}`);
  }
  if (params.date) {
    values.push(params.date);
    where.push(`departure_date = $${values.length}`);
  }
  if (params.passengers) {
    values.push(params.passengers);
    where.push(`seats_available >= $${values.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (params.page - 1) * params.limit;

  const countSql = `SELECT COUNT(*)::int AS total FROM flights ${whereSql}`;
  const countRes = await pool.query<{ total: number }>(countSql, values);
  const total = countRes.rows[0].total;

  values.push(params.limit);
  values.push(offset);
  const sql = `
    SELECT id, flight_number, airline, origin, destination, departure_date,
           departure_time, arrival_time, fare, seats_total, seats_available
    FROM flights
    ${whereSql}
    ORDER BY departure_date ASC, departure_time ASC
    LIMIT $${values.length - 1} OFFSET $${values.length}
  `;
  const res = await pool.query<Flight>(sql, values);
  return { items: res.rows.map(toDTO), total };
}

export async function getFlightById(id: number): Promise<Flight | null> {
  const res = await pool.query<Flight>(
    `SELECT id, flight_number, airline, origin, destination, departure_date,
            departure_time, arrival_time, fare, seats_total, seats_available
     FROM flights WHERE id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

// Atomic seat decrement. Returns true if seats were reserved, false if sold out.
// Uses a conditional UPDATE so concurrent attempts on the last seat can't both win.
export async function tryReserveSeats(flightId: number, count: number): Promise<boolean> {
  const res = await pool.query(
    `UPDATE flights
        SET seats_available = seats_available - $1
      WHERE id = $2 AND seats_available >= $1`,
    [count, flightId]
  );
  return (res.rowCount || 0) > 0;
}

export async function releaseSeats(flightId: number, count: number) {
  await pool.query(
    `UPDATE flights
        SET seats_available = seats_available + $1
      WHERE id = $2`,
    [count, flightId]
  );
}
