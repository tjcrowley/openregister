import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { deviceAuthHook } from '../../middleware/deviceAuthHook.js';
import { logger } from '../../lib/logger.js';

const AdjustSchema = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  quantityDelta: z.number().int(),
  reason: z.string().min(1),
  referenceId: z.string().optional(),
});

const CountSchema = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  countedQuantity: z.number().int().min(0),
  userId: z.string().uuid(),
});

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', deviceAuthHook);

  // GET /inventory
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { merchantId } = request.deviceContext!;
    const query = z.object({
      locationId: z.string().uuid().optional(),
      variantId: z.string().uuid().optional(),
    }).parse(request.query);

    const where: any = { merchantId };
    if (query.locationId) where.locationId = query.locationId;
    if (query.variantId) where.variantId = query.variantId;

    const items = await prisma.inventoryItem.findMany({
      where,
      include: { variant: { include: { product: true } } },
    });

    return reply.code(200).send(items);
  });

  // POST /inventory/adjust
  app.post('/adjust', async (request: FastifyRequest, reply: FastifyReply) => {
    const { merchantId } = request.deviceContext!;
    const body = AdjustSchema.parse(request.body);

    const updated = await prisma.inventoryItem.upsert({
      where: { variantId_locationId: { variantId: body.variantId, locationId: body.locationId } },
      create: {
        merchantId,
        variantId: body.variantId,
        locationId: body.locationId,
        quantityOnHand: Math.max(0, body.quantityDelta),
      },
      update: {
        quantityOnHand: { increment: body.quantityDelta },
      },
    });

    logger.info({ merchantId, variantId: body.variantId, delta: body.quantityDelta, reason: body.reason }, 'Inventory adjusted');
    return reply.code(200).send(updated);
  });

  // POST /inventory/count
  app.post('/count', async (request: FastifyRequest, reply: FastifyReply) => {
    const { merchantId } = request.deviceContext!;
    const body = CountSchema.parse(request.body);

    const updated = await prisma.inventoryItem.upsert({
      where: { variantId_locationId: { variantId: body.variantId, locationId: body.locationId } },
      create: {
        merchantId,
        variantId: body.variantId,
        locationId: body.locationId,
        quantityOnHand: body.countedQuantity,
      },
      update: {
        quantityOnHand: body.countedQuantity,
      },
    });

    logger.info({ merchantId, variantId: body.variantId, counted: body.countedQuantity }, 'Inventory counted');
    return reply.code(200).send(updated);
  });
}
