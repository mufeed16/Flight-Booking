import { Request, Response } from 'express';
import * as adminService from './admin.service';
import * as bookingService from '../bookings/booking.service';
import { ok } from '../../utils/response';
import { HttpError } from '../../utils/errors';

export async function createFlight(req: Request, res: Response) {
  const flight = await adminService.createFlight((req as any).validatedBody);
  return ok(res, flight);
}

export async function updateFlight(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) throw new HttpError(400, 'Invalid flight id', 'VALIDATION_ERROR');
  const flight = await adminService.updateFlight(id, (req as any).validatedBody);
  if (!flight) throw new HttpError(404, 'Flight not found', 'NOT_FOUND');
  return ok(res, flight);
}

export async function deleteFlight(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) throw new HttpError(400, 'Invalid flight id', 'VALIDATION_ERROR');
  const result = await adminService.deleteFlight(id);
  if (!result.deleted) {
    throw new HttpError(409, result.reason || 'Cannot delete flight', 'CONFLICT');
  }
  return ok(res, { deleted: true });
}

export async function dashboard(_req: Request, res: Response) {
  const stats = await adminService.getDashboardStats();
  return ok(res, stats);
}

export async function listAllBookings(req: Request, res: Response) {
  const q = (req as any).validatedQuery;
  const page = Number(q.page) || 1;
  const limit = Math.min(Number(q.limit) || 20, 100);
  const result = await bookingService.listAllBookings(
    { status: q.status, route: q.route, date: q.date },
    page,
    limit
  );
  return ok(res, result.items, {
    page,
    limit,
    total: result.total,
    totalPages: Math.ceil(result.total / limit),
  });
}
