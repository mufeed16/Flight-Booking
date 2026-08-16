import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorMiddleware } from './middleware/error';
import authRoutes from './modules/auth/auth.routes';
import flightRoutes from './modules/flights/flight.routes';
import bookingRoutes from './modules/bookings/booking.routes';
import adminRoutes from './modules/admin/admin.routes';
import { handleStripeWebhook } from './modules/bookings/stripe.webhook';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(compression());

  // Stripe webhook needs the raw body for signature verification.
  // Mount it before express.json() so the body isn't parsed.
  app.post(
    '/api/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    (req, _res, next) => {
      (req as any).rawBody = req.body;
      next();
    },
    handleStripeWebhook
  );

  app.use(express.json({ limit: '1mb' }));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', apiLimiter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: config.nodeEnv });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/flights', flightRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/admin', adminRoutes);

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: { message: 'Route not found' } });
  });

  app.use(errorMiddleware);

  return app;
}
