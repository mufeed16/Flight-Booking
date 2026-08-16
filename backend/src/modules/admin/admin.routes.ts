import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from './admin.controller';
import { validateBody, validateQuery } from '../../utils/validate';
import { authMiddleware, requireRole } from '../../middleware/auth';

const router = Router();

const flightSchema = z.object({
  flightNumber: z.string().min(1),
  airline: z.string().min(1),
  origin: z.string().length(3),
  destination: z.string().length(3),
  departureDate: z.string().min(1),
  departureTime: z.string().min(1),
  arrivalTime: z.string().min(1),
  fare: z.number().positive(),
  seatsTotal: z.number().int().positive(),
});

const flightUpdateSchema = flightSchema.partial();

const listBookingsSchema = z.object({
  status: z.string().optional(),
  route: z.string().optional(),
  date: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

router.use(authMiddleware, requireRole('admin'));

router.post('/flights', validateBody(flightSchema), ctrl.createFlight);
router.put('/flights/:id', validateBody(flightUpdateSchema), ctrl.updateFlight);
router.delete('/flights/:id', ctrl.deleteFlight);
router.get('/dashboard', ctrl.dashboard);
router.get('/bookings', validateQuery(listBookingsSchema), ctrl.listAllBookings);

export default router;
