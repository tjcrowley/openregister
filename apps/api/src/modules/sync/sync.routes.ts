import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { deviceAuthHook } from '../../middleware/deviceAuthHook.js';
import { logger } from '../../lib/logger.js';
import type { PushPayload, AckPayload } from '@openregister/types';

const PushSchema = z.object({
  events: z.array(
    z.object({
      id: z.string().uuid(),
      merchantId: z.string().uuid(),
      deviceId: z.string().uuid(),
      eventType: z.string().min(1),
      payload: z.unknown(),
      occurredAt: z.string().datetime(),
    })
  ),
});

const PullQuerySchema = z.object({
  cursor: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 0)),
  domain: z.string().optional(),
  limit: z.string().optional().transform((v) => Math.min(parseInt(v ?? '100', 10), 500)),
});

const AckSchema = z.object({
  eventIds: z.array(z.string().uuid()).min(1),
});

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', deviceAuthHook);

  /**
   * GET /sync/status
   * Returns current cursor positions for all sync domains and server time.
   */
  app.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { merchantId, deviceId } = request.deviceContext!;

    // Return per-domain cursors from the event_log table
    const maxCursors = await prisma.$queryRaw<Array<{ eventType: string; cursor: bigint }>>`
      SELECT event_type as "eventType", MAX(id) as cursor
      FROM event_log
      WHERE merchant_id = ${merchantId}::uuid
      GROUP BY event_type
    `;

    const cursors = {
      products: 0,
      inventory: 0,
      register_sessions: 0,
      sales: 0,
      settings: 0,
    };

    for (const row of maxCursors) {
      const n = Number(row.cursor);
      if (row.eventType.startsWith('catalog.')) cursors.products = Math.max(cursors.products, n);
      else if (row.eventType.startsWith('inventory.')) cursors.inventory = Math.max(cursors.inventory, n);
      else if (row.eventType.startsWith('register.session')) cursors.register_sessions = Math.max(cursors.register_sessions, n);
      else if (row.eventType.startsWith('sale.')) cursors.sales = Math.max(cursors.sales, n);
      else if (row.eventType.startsWith('merchant.settings')) cursors.settings = Math.max(cursors.settings, n);
    }

    return reply.code(200).send({ cursors, serverTime: new Date().toISOString() });
  });

  /**
   * POST /sync/push
   * Accept a batch of local events from the device.
   */
  app.post('/push', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = PushSchema.parse(request.body);
    const { merchantId, deviceId } = request.deviceContext!;

    const accepted: string[] = [];
    const rejected: Array<{ id: string; reason: string }> = [];

    for (const event of body.events) {
      if (event.merchantId !== merchantId) {
        rejected.push({ id: event.id, reason: 'merchantId mismatch' });
        continue;
      }
      try {
        await prisma.eventLog.upsert({
          where: { eventId: event.id },
          create: {
            eventId: event.id,
            merchantId: event.merchantId,
            deviceId: event.deviceId,
            eventType: event.eventType,
            payload: event.payload as any,
            occurredAt: new Date(event.occurredAt),
          },
          update: {}, // idempotent: no-op if already exists
        });
        accepted.push(event.id);
      } catch (err) {
        logger.warn({ err, eventId: event.id }, 'Failed to persist event');
        rejected.push({ id: event.id, reason: 'internal error' });
      }
    }

    return reply.code(200).send({ accepted: accepted.length, rejected });
  });

  /**
   * GET /sync/pull
   * Return server events after the given cursor for a specific domain.
   */
  app.get('/pull', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = PullQuerySchema.parse(request.query);
    const { merchantId } = request.deviceContext!;

    const events = await prisma.$queryRaw<Array<{
      id: bigint;
      event_id: string;
      event_type: string;
      payload: unknown;
      occurred_at: Date;
    }>>`
      SELECT id, event_id, event_type, payload, occurred_at
      FROM event_log
      WHERE merchant_id = ${merchantId}::uuid
        AND id > ${query.cursor}
      ORDER BY id ASC
      LIMIT ${query.limit + 1}
    `;

    const hasMore = events.length > query.limit;
    const page = events.slice(0, query.limit);
    const nextCursor = page.length > 0 ? Number(page[page.length - 1].id) : query.cursor;

    return reply.code(200).send({
      events: page.map((e) => ({
        id: Number(e.id),
        eventId: e.event_id,
        eventType: e.event_type,
        payload: e.payload,
        occurredAt: e.occurred_at.toISOString(),
        cursor: Number(e.id),
      })),
      nextCursor,
      hasMore,
    });
  });

  /**
   * POST /sync/ack
   * Acknowledge events that the device has successfully applied.
   */
  app.post('/ack', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = AckSchema.parse(request.body);
    // In this architecture ack is a no-op server-side (server already has the events).
    // If we add a delivery-tracking table, we'd mark them here.
    logger.debug({ count: body.eventIds.length }, 'Sync ack received');
    return reply.code(200).send({ acknowledged: body.eventIds.length });
  });
}
