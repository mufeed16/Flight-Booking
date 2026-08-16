import Stripe from 'stripe';
import { pool, pool as db } from '../../db/pool';
import { config } from '../../config';
import { HttpError } from '../../utils/errors';
import * as flightService from '../flights/flight.service';

const stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2024-06-20' as any });

export interface PassengerInput {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  email: string;
  contactNumber: string;
}

export interface BookingRow {
  id: number;
  user_id: number;
  flight_id: number;
  passengers: number;
  total_amount: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'failed';
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingDTO {
  id: number;
  flightId: number;
  passengers: number;
  totalAmount: number;
  status: BookingRow['status'];
  createdAt: string;
  flight?: any;
  passengerDetails?: PassengerInput[];
}

function toDTO(row: BookingRow, flight?: any, passengerDetails?: PassengerInput[]): BookingDTO {
  return {
    id: row.id,
    flightId: row.flight_id,
    passengers: row.passengers,
    totalAmount: Number(row.total_amount),
    status: row.status,
    createdAt: row.created_at,
    flight,
    passengerDetails,
  };
}

// Create a pending booking. Atomically reserves seats so concurrent attempts
// on the last seat can't both succeed.
export async function createPendingBooking(
  userId: number,
  flightId: number,
  passengers: PassengerInput[]
): Promise<{ booking: BookingDTO; clientSecret: string }> {
  if (passengers.length === 0) {
    throw new HttpError(400, 'At least one passenger is required', 'VALIDATION_ERROR');
  }

  const flight = await flightService.getFlightById(flightId);
  if (!flight) throw new HttpError(404, 'Flight not found', 'NOT_FOUND');

  const reserved = await flightService.tryReserveSeats(flightId, passengers.length);
  if (!reserved) {
    throw new HttpError(409, 'Not enough seats available', 'SOLD_OUT');
  }

  const total = Number(flight.fare) * passengers.length;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const bookingRes = await client.query<BookingRow>(
      `INSERT INTO bookings (user_id, flight_id, passengers, total_amount, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [userId, flightId, passengers.length, total]
    );
    const booking = bookingRes.rows[0];

    for (const p of passengers) {
      await client.query(
        `INSERT INTO passengers
          (booking_id, full_name, date_of_birth, nationality, passport_number, email, contact_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [booking.id, p.fullName, p.dateOfBirth, p.nationality, p.passportNumber, p.email, p.contactNumber]
      );
    }

    // Create the Stripe PaymentIntent up front so the client can confirm it.
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: 'inr',
      automatic_payment_methods: { enabled: true },
      metadata: { bookingId: String(booking.id), userId: String(userId) },
    });

    await client.query(
      'UPDATE bookings SET stripe_payment_intent_id = $1 WHERE id = $2',
      [intent.id, booking.id]
    );

    await client.query('COMMIT');

    return {
      booking: toDTO({ ...booking, stripe_payment_intent_id: intent.id }, flight, passengers),
      clientSecret: intent.client_secret || '',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    // If anything failed after we reserved seats, give them back.
    await flightService.releaseSeats(flightId, passengers.length);
    throw err;
  } finally {
    client.release();
  }
}

// Confirm a booking after a successful payment. Idempotent — repeated webhook
// deliveries won't double-confirm or double-decrement.
export async function confirmBookingByPaymentIntent(paymentIntentId: string): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query<BookingRow>(
      'SELECT * FROM bookings WHERE stripe_payment_intent_id = $1 FOR UPDATE',
      [paymentIntentId]
    );
    const booking = res.rows[0];
    if (!booking) {
      await client.query('ROLLBACK');
      return;
    }
    if (booking.status === 'confirmed') {
      await client.query('COMMIT');
      return;
    }
    await client.query(
      `UPDATE bookings SET status = 'confirmed', updated_at = NOW() WHERE id = $1`,
      [booking.id]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Mark a booking as failed (e.g. payment failed) and release the held seats.
export async function failBookingByPaymentIntent(paymentIntentId: string): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query<BookingRow>(
      'SELECT * FROM bookings WHERE stripe_payment_intent_id = $1 FOR UPDATE',
      [paymentIntentId]
    );
    const booking = res.rows[0];
    if (!booking) {
      await client.query('ROLLBACK');
      return;
    }
    if (booking.status === 'confirmed' || booking.status === 'cancelled') {
      await client.query('COMMIT');
      return;
    }
    await client.query(
      `UPDATE bookings SET status = 'failed', updated_at = NOW() WHERE id = $1`,
      [booking.id]
    );
    await flightService.releaseSeats(booking.flight_id, booking.passengers);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getBookingForUser(userId: number, bookingId: number): Promise<BookingDTO | null> {
  const res = await pool.query<BookingRow>('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  const booking = res.rows[0];
  if (!booking) return null;
  if (booking.user_id !== userId) {
    // Don't leak existence — return null and let the controller decide.
    return null;
  }
  const flight = await flightService.getFlightById(booking.flight_id);
  const passengers = await pool.query<any>(
    `SELECT full_name AS "fullName", date_of_birth AS "dateOfBirth",
            nationality, passport_number AS "passportNumber",
            email, contact_number AS "contactNumber"
       FROM passengers WHERE booking_id = $1`,
    [booking.id]
  );
  return toDTO(booking, flight, passengers.rows);
}

export async function listBookingsForUser(
  userId: number,
  page: number,
  limit: number
): Promise<{ items: BookingDTO[]; total: number }> {
  const offset = (page - 1) * limit;
  const countRes = await pool.query<{ total: number }>(
    'SELECT COUNT(*)::int AS total FROM bookings WHERE user_id = $1',
    [userId]
  );
  const total = countRes.rows[0].total;

  const res = await pool.query<BookingRow>(
    `SELECT * FROM bookings WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const items: BookingDTO[] = [];
  for (const b of res.rows) {
    const flight = await flightService.getFlightById(b.flight_id);
    items.push(toDTO(b, flight));
  }
  return { items, total };
}

export async function listAllBookings(
  filters: { status?: string; route?: string; date?: string },
  page: number,
  limit: number
): Promise<{ items: BookingDTO[]; total: number }> {
  const where: string[] = [];
  const values: any[] = [];
  if (filters.status) {
    values.push(filters.status);
    where.push(`b.status = $${values.length}`);
  }
  if (filters.date) {
    values.push(filters.date);
    where.push(`f.departure_date = $${values.length}`);
  }
  if (filters.route) {
    const [origin, destination] = filters.route.split('-');
    if (origin && destination) {
      values.push(origin.toUpperCase());
      values.push(destination.toUpperCase());
      where.push(`f.origin = $${values.length - 1} AND f.destination = $${values.length}`);
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const countRes = await pool.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM bookings b
     JOIN flights f ON f.id = b.flight_id ${whereSql}`,
    values
  );
  const total = countRes.rows[0].total;

  values.push(limit);
  values.push(offset);
  const res = await pool.query<any>(
    `SELECT b.*, f.flight_number, f.airline, f.origin, f.destination,
            f.departure_date, f.departure_time, f.arrival_time
       FROM bookings b
       JOIN flights f ON f.id = b.flight_id
       ${whereSql}
       ORDER BY b.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  const items: BookingDTO[] = res.rows.map((r: any) => ({
    id: r.id,
    flightId: r.flight_id,
    passengers: r.passengers,
    totalAmount: Number(r.total_amount),
    status: r.status,
    createdAt: r.created_at,
    flight: {
      id: r.flight_id,
      flightNumber: r.flight_number,
      airline: r.airline,
      origin: r.origin,
      destination: r.destination,
      departureDate: r.departure_date,
      departureTime: r.departure_time,
      arrivalTime: r.arrival_time,
    },
  }));
  return { items, total };
}

export async function cancelBooking(
  bookingId: number,
  userId: number,
  isAdmin: boolean
): Promise<BookingDTO> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query<BookingRow>(
      'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
      [bookingId]
    );
    const booking = res.rows[0];
    if (!booking) {
      await client.query('ROLLBACK');
      throw new HttpError(404, 'Booking not found', 'NOT_FOUND');
    }
    if (!isAdmin && booking.user_id !== userId) {
      await client.query('ROLLBACK');
      throw new HttpError(404, 'Booking not found', 'NOT_FOUND');
    }
    if (booking.status === 'cancelled') {
      await client.query('ROLLBACK');
      throw new HttpError(400, 'Booking already cancelled', 'ALREADY_CANCELLED');
    }
    if (booking.status !== 'confirmed') {
      await client.query('ROLLBACK');
      throw new HttpError(400, 'Only confirmed bookings can be cancelled', 'INVALID_STATE');
    }

    // Policy window check (admins bypass).
    if (!isAdmin) {
      const flightRes = await client.query<any>(
        'SELECT departure_date, departure_time FROM flights WHERE id = $1',
        [booking.flight_id]
      );
      const flight = flightRes.rows[0];
      const departure = new Date(`${flight.departure_date}T${flight.departure_time}:00Z`);
      const hoursUntil = (departure.getTime() - Date.now()) / (1000 * 3600);
      if (hoursUntil < config.cancellationCutoffHours) {
        await client.query('ROLLBACK');
        throw new HttpError(
          400,
          `Cancellation not allowed within ${config.cancellationCutoffHours} hours of departure`,
          'CUTOFF_PASSED'
        );
      }
    }

    // Issue Stripe refund if we have a payment intent.
    let refundId: string | null = null;
    if (booking.stripe_payment_intent_id) {
      const refund = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
      });
      refundId = refund.id;
    }

    await client.query(
      `UPDATE bookings
          SET status = 'cancelled', stripe_refund_id = $1, updated_at = NOW()
        WHERE id = $2`,
      [refundId, booking.id]
    );

    await flightService.releaseSeats(booking.flight_id, booking.passengers);

    await client.query('COMMIT');

    const updated = await pool.query<BookingRow>('SELECT * FROM bookings WHERE id = $1', [booking.id]);
    const flight = await flightService.getFlightById(booking.flight_id);
    return toDTO(updated.rows[0], flight);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
