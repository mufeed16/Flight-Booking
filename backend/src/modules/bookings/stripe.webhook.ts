import { Request, Response } from 'express';
import Stripe from 'stripe';
import { config } from '../../config';
import * as bookingService from './booking.service';

const stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2024-06-20' as any });

// Stripe webhook. Must be mounted with raw body parsing — see app.ts.
export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).send('Missing stripe-signature');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      (req as any).rawBody,
      sig as string,
      config.stripe.webhookSecret
    );
  } catch (err: any) {
    console.error('Stripe signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await bookingService.confirmBookingByPaymentIntent(intent.id);
        break;
      }
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await bookingService.failBookingByPaymentIntent(intent.id);
        break;
      }
      default:
        // Ignore other event types.
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    // Return 500 so Stripe retries.
    return res.status(500).send('Internal error');
  }

  return res.json({ received: true });
}
