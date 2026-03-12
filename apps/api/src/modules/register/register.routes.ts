import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { deviceAuthHook } from '../../middleware/deviceAuthHook.js';
import { logger } from '../../lib/logger.js';

const OpenSessionSchema = z.object({
  userId: z.string().uuid(),
  openingCashCents: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

const CloseSessionSchema = z.object({
  countedCashCents: z.number().int().min(0),
  notes: z.string().optional(),
  managerOverrideUserId: z.string().uuid().optional(),
});

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', deviceAuthHook);

  // POST /register/sessions/open
  app.post('/sessions/open', async (request: FastifyRequest, reply: FastifyReply) => {
    const { merchantId, locationId, deviceId } = request.deviceContext!;
    const body = OpenSessionSchema.parse(request.body);

    // Ensure no session is already open for this device
    const existingOpen = await prisma.registerSession.findFirst({
      where: { merchantId, locationId, status: 'OPEN' },
    });
    if (existingOpen) {
      return reply.code(409).send({ code: 'SESSION_ALREADY_OPEN', message: 'A session is already open for this location' });
    }

    const session = await prisma.registerSession.create({
      data: {
        merchantId,
        locationId,
        userId: body.userId,
        openingCashCents: body.openingCashCents,
        notes: body.notes,
        status: 'OPEN',
      },
    });

    logger.info({ sessionId: session.id, merchantId }, 'Register session opened');
    return reply.code(201).send(session);
  });

  // POST /register/sessions/:id/close
  app.post('/sessions/:id/close',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { merchantId } = request.deviceContext!;
      const body = CloseSessionSchema.parse(request.body);
      const session = await prisma.registerSession.findFirst({
        where: { id: request.params.id, merchantId, status: 'OPEN' },
        include: { sales: { where: { status: 'COMPLETED' } } },
      });

      if (!session) {
        return reply.code(404).send({ code: 'NOT_FOUND', message: 'Session not found or not open' });
      }

      // Calculate expected cash: opening + cash sales
      const cashSaleTotal = await prisma.payment.aggregate({
        _sum: { amountCents: true },
        where: {
          sale: { sessionId: session.id },
          method: 'CASH',
          status: 'captured',
        },
      });
      const expectedCashCents = session.openingCashCents + (cashSaleTotal._sum.amountCents ?? 0);
      const varianceCents = body.countedCashCents - expectedCashCents;

      // Variance >$5 requires manager override
      if (Math.abs(varianceCents) > 500 && !body.managerOverrideUserId) {
        return reply.code(422).send({
          code: 'REQUIRES_MANAGER_APPROVAL',
          message: 'Variance exceeds $5.00 — manager approval required',
          details: { varianceCents, expectedCashCents, countedCashCents: body.countedCashCents },
        });
      }

      const closed = await prisma.registerSession.update({
        where: { id: session.id },
        data: {
          status: 'CLOSED',
          countedCashCents: body.countedCashCents,
          closingCashCents: expectedCashCents,
          varianceCents,
          closedAt: new Date(),
          notes: body.notes,
        },
      });

      logger.info({ sessionId: session.id, merchantId, varianceCents }, 'Register session closed');
      return reply.code(200).send(closed);
    }
  );

  // GET /register/sessions/:id
  app.get('/sessions/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { merchantId } = request.deviceContext!;
      const session = await prisma.registerSession.findFirst({
        where: { id: request.params.id, merchantId },
        include: { user: { select: { id: true, name: true, role: true } } },
      });
      if (!session) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Session not found' });
      return reply.code(200).send(session);
    }
  );
}
