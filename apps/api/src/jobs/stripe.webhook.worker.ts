import { Worker, type Job } from 'bullmq';
import { redis } from '../db/redis.js';
import { prisma } from '../db/client.js';
import { logger } from '../lib/logger.js';
import type Stripe from 'stripe';

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  logger.info({ eventId: event.id, type: event.type }, 'Processing Stripe webhook event');

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent;
      const saleId = intent.metadata?.saleId;
      if (!saleId) break;

      await prisma.payment.updateMany({
        where: { stripePaymentIntentId: intent.id },
        data: { status: 'captured', capturedAt: new Date() },
      });

      await prisma.sale.updateMany({
        where: { id: saleId, status: 'PENDING' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      logger.info({ saleId, intentId: intent.id }, 'Payment succeeded — sale completed');
      break;
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent;
      await prisma.payment.updateMany({
        where: { stripePaymentIntentId: intent.id },
        data: { status: 'failed' },
      });
      logger.warn({ intentId: intent.id }, 'Payment intent failed');
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const intentId = charge.payment_intent as string;
      if (!intentId) break;

      await prisma.payment.updateMany({
        where: { stripePaymentIntentId: intentId },
        data: { status: 'refunded' },
      });
      logger.info({ intentId }, 'Charge refunded');
      break;
    }

    default:
      logger.debug({ type: event.type }, 'Unhandled Stripe event type');
  }
}

export const stripeWebhookWorker = new Worker(
  'stripeWebhook',
  async (job: Job<Stripe.Event>) => {
    await handleStripeEvent(job.data);
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

stripeWebhookWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Stripe webhook job failed');
});
