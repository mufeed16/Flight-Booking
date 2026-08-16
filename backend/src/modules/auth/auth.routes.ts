import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from './auth.controller';
import { validateBody } from '../../utils/validate';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// Rate-limit auth endpoints to slow down brute force attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post('/register', authLimiter, validateBody(registerSchema), ctrl.register);
router.post('/login', authLimiter, validateBody(loginSchema), ctrl.login);
router.post('/refresh', authLimiter, validateBody(refreshSchema), ctrl.refresh);
router.post('/logout', validateBody(refreshSchema), ctrl.logout);
router.get('/me', authMiddleware, ctrl.me);

export default router;
