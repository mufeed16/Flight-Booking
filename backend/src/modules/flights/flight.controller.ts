import { Request, Response } from 'express';
import * as flightService from './flight.service';
import { ok, fail } from '../../utils/response';
import { HttpError } from '../../utils/errors';

export async function search(req: Request, res: Response) {
  const q = (req as any).validatedQuery;
  const page = Number(q.page) || 1;
  const limit = Math.min(Number(q.limit) || 10, 50);
  const result = await flightService.searchFlights({
    origin: q.origin,
    destination: q.destination,
    date: q.date,
    passengers: q.passengers ? Number(q.passengers) : undefined,
    page,
    limit,
  });
  return ok(res, result.items, {
    page,
    limit,
    total: result.total,
    totalPages: Math.ceil(result.total / limit),
  });
}

export async function getOne(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) throw new HttpError(400, 'Invalid flight id', 'VALIDATION_ERROR');
  const flight = await flightService.getFlightById(id);
  if (!flight) throw new HttpError(404, 'Flight not found', 'NOT_FOUND');
  return ok(res, flight);
}
