import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from './flight.controller';
import { validateQuery } from '../../utils/validate';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

const searchSchema = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  date: z.string().optional(),
  passengers: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

router.get('/', authMiddleware, validateQuery(searchSchema), ctrl.search);
router.get('/:id', authMiddleware, ctrl.getOne);

export default router;
