import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { deviceAuthHook } from '../../middleware/deviceAuthHook.js';
import { getStripeForMerchant } from '../../lib/stripe.js';
import { logger } from '../../lib/logger.js';
import { config } from '../../config.js';
import { stripeWebhookQueue } from '../../jobs/queue.js';
import Stripe from 'stripe';

const IntentSchema = z.object({
  saleId: z.string().uuid(),
  amountCents: z.number().int().min(1),
  currency: z.string().length(3).toLowerCase(),
});

const ProcessSchema = z.object({
  paymentIntentId: z.string().min(1),
  saleId: z.string().uuid(),
});

const CryptoInvoiceSchema = z.object({
  saleId: z.string().uuid(),
  amountCents: z.number().int().min(1),
  currency: z.enum(['ETH', 'BTC', 'USDC']),
});

export async function paymentsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /payments/intent
   * Create a Stripe PaymentIntent for card-present terminal payment.
   */
  app.post('/intent', { preHandler: deviceAuthHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { merchantId } = request.deviceContext!;
    const body = IntentSchema.parse(request.body);

    const stripe = await getStripeForMerchant(merchantId);
    const intent = await stripe.paymentIntents.create({
      amount: body.amountCents,
      currency: body.currency,
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      metadata: { saleId: body.saleId, merchantId },
    });

    logger.info({ merchantId, saleId: body.saleId, intentId: intent.id }, 'Payment intent created');
    return reply.code(200).send({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    });
  });

  /**
   * POST /payments/process
   * Mark a PaymentIntent as processed after terminal capture.
   */
  app.post('/process', { preHandler: deviceAuthHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { merchantId } = request.deviceContext!;
    const body = ProcessSchema.parse(request.body);

    const stripe = await getStripeForMerchant(merchantId);
    const intent = await stripe.paymentIntents.retrieve(body.paymentIntentId);

    if (intent.status === 'succeeded') {
      // Record the payment
      await prisma.payment.create({
        data: {
          saleId: body.saleId,
          merchantId,
          method: 'CARD_PRESENT',
          amountCents: intent.amount,
          stripePaymentIntentId: intent.id,
          status: 'captured',
          capturedAt: new Date(),
        },
      });

      // Mark sale as completed
      const sale = await prisma.sale.update({
        where: { id: body.saleId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      return reply.code(200).send({ status: intent.status, sale });
    }

    return reply.code(200).send({ status: intent.status });
  });

  /**
   * POST /payments/webhook
   * Receive Stripe webhook events and enqueue for processing.
   */
  app.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!config.STRIPE_WEBHOOK_SECRET) {
      return reply.code(400).send({ error: 'Webhook secret not configured' });
    }

    const sig = request.headers['stripe-signature'] as string;
    if (!sig) {
      return reply.code(400).send({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;
    try {
      // request.rawBody is available when Content-Type is application/json
      const rawBody = (request as any).rawBody ?? JSON.stringify(request.body);
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-06-20' });
      event = stripe.webhooks.constructEvent(rawBody, sig, config.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.warn({ err }, 'Stripe webhook signature verification failed');
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    await stripeWebhookQueue.add('stripe-event', event, {
      jobId: event.id,
      removeOnComplete: true,
    });

    return reply.code(200).send({ received: true });
  });

  /**
   * POST /payments/crypto/invoice
   * Create a crypto payment invoice.
   */
  app.post('/crypto/invoice', { preHandler: deviceAuthHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { merchantId } = request.deviceContext!;
    const body = CryptoInvoiceSchema.parse(request.body);

    // Generate a deposit address (placeholder — real impl calls crypto gateway)
    const address = `0x${Buffer.from(Math.random().toString()).toString('hex').slice(0, 40)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    const invoice = await prisma.cryptoInvoice.create({
      data: {
        saleId: body.saleId,
        merchantId,
        address,
        amountCrypto: '0', // set by crypto gateway
        currency: body.currency,
        amountCents: body.amountCents,
        status: 'PENDING',
        expiresAt,
      },
    });

    return reply.code(201).send({ invoice });
  });
}
