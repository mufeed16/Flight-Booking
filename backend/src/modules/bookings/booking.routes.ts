import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from './booking.controller';
import { validateBody, validateQuery } from '../../utils/validate';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

const passengerSchema = z.object({
  fullName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  nationality: z.string().min(1),
  passportNumber: z.string().min(1),
  email: z.string().email(),
  contactNumber: z.string().min(1),
});

const createSchema = z.object({
  flightId: z.number().int().positive(),
  passengers: z.array(passengerSchema).min(1).max(9),
});

const listSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

router.post('/', authMiddleware, validateBody(createSchema), ctrl.create);
router.get('/', authMiddleware, validateQuery(listSchema), ctrl.listMine);
router.get('/:id', authMiddleware, ctrl.getOne);
router.post('/:id/cancel', authMiddleware, ctrl.cancel);

export default router;
