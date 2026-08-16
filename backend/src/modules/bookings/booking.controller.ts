import { Request, Response } from 'express';
import * as bookingService from './booking.service';
import { ok, fail } from '../../utils/response';
import { HttpError } from '../../utils/errors';

export async function create(req: Request, res: Response) {
  const userId = req.user!.id;
  const { flightId, passengers } = (req as any).validatedBody;
  const result = await bookingService.createPendingBooking(userId, flightId, passengers);
  return ok(res, result);
}

export async function listMine(req: Request, res: Response) {
  const userId = req.user!.id;
  const page = Number((req as any).validatedQuery.page) || 1;
  const limit = Math.min(Number((req as any).validatedQuery.limit) || 10, 50);
  const result = await bookingService.listBookingsForUser(userId, page, limit);
  return ok(res, result.items, {
    page,
    limit,
    total: result.total,
    totalPages: Math.ceil(result.total / limit),
  });
}

export async function getOne(req: Request, res: Response) {
  const userId = req.user!.id;
  const id = Number(req.params.id);
  if (!id) throw new HttpError(400, 'Invalid booking id', 'VALIDATION_ERROR');
  const booking = await bookingService.getBookingForUser(userId, id);
  if (!booking) throw new HttpError(404, 'Booking not found', 'NOT_FOUND');
  return ok(res, booking);
}

export async function cancel(req: Request, res: Response) {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === 'admin';
  const id = Number(req.params.id);
  if (!id) throw new HttpError(400, 'Invalid booking id', 'VALIDATION_ERROR');
  const booking = await bookingService.cancelBooking(id, userId, isAdmin);
  return ok(res, booking);
}

// Demo helper: simulates a successful Stripe webhook delivery for the booking.
// In production, the webhook is the source of truth — this endpoint exists so
// the demo frontend can complete a booking without a real Stripe round-trip.
// It only works for bookings owned by the caller and only when status is 'pending'.
export async function simulatePayment(req: Request, res: Response) {
  const userId = req.user!.id;
  const id = Number(req.params.id);
  if (!id) throw new HttpError(400, 'Invalid booking id', 'VALIDATION_ERROR');
  const { paymentIntentId, status } = (req as any).validatedBody;
  const booking = await bookingService.simulatePaymentForBooking(userId, id, paymentIntentId, status);
  return ok(res, booking);
}
