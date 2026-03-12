import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { adminAuthHook } from '../../middleware/adminAuthHook.js';
import { logger } from '../../lib/logger.js';

const ProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  imageUrl: z.string().url().optional(),
  basePrice: z.number().int().min(0),
  taxRuleId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

const MerchantSettingsSchema = z.object({
  timezone: z.string().optional(),
  currency: z.string().length(3).optional(),
  stripePublishableKey: z.string().optional(),
  stripeSecretKey: z.string().optional(),
});

export async function adminRouter(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', adminAuthHook);

  // GET /admin/products
  app.get('/products', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      merchantId: z.string().uuid(),
      page: z.string().optional().transform((v) => parseInt(v ?? '1', 10)),
      pageSize: z.string().optional().transform((v) => Math.min(100, parseInt(v ?? '50', 10))),
    }).parse(request.query);

    const skip = (query.page - 1) * query.pageSize;
    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where: { merchantId: query.merchantId },
        include: { variants: true, category: true },
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where: { merchantId: query.merchantId } }),
    ]);

    return reply.code(200).send({ data, total, page: query.page, pageSize: query.pageSize });
  });

  // POST /admin/products
  app.post('/products', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({ merchantId: z.string().uuid() }).parse(request.query);
    const body = ProductSchema.parse(request.body);
    const product = await prisma.product.create({
      data: { ...body, merchantId: query.merchantId },
    });
    return reply.code(201).send(product);
  });

  // PATCH /admin/products/:id
  app.patch('/products/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const body = ProductSchema.partial().parse(request.body);
      const product = await prisma.product.update({ where: { id: request.params.id }, data: body });
      return reply.code(200).send(product);
    }
  );

  // DELETE /admin/products/:id
  app.delete('/products/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await prisma.product.update({ where: { id: request.params.id }, data: { isActive: false } });
      return reply.code(204).send();
    }
  );

  // GET /admin/reports/daily
  app.get('/reports/daily', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      merchantId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).parse(request.query);

    const date = query.date ? new Date(query.date) : new Date();
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const [salesAgg, transactionCount] = await Promise.all([
      prisma.sale.aggregate({
        _sum: { totalCents: true, taxCents: true },
        where: {
          merchantId: query.merchantId,
          status: 'COMPLETED',
          completedAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      prisma.sale.count({
        where: {
          merchantId: query.merchantId,
          status: 'COMPLETED',
          completedAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
    ]);

    return reply.code(200).send({
      date: startOfDay.toISOString().slice(0, 10),
      totalCents: salesAgg._sum.totalCents ?? 0,
      taxCents: salesAgg._sum.taxCents ?? 0,
      transactionCount,
    });
  });

  // GET /admin/merchants/:id/settings
  app.get('/merchants/:id/settings',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const merchant = await prisma.merchant.findUnique({
        where: { id: request.params.id },
        select: { id: true, name: true, timezone: true, currency: true, stripePublishableKey: true, createdAt: true, updatedAt: true },
      });
      if (!merchant) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Merchant not found' });
      return reply.code(200).send(merchant);
    }
  );

  // PATCH /admin/merchants/:id/settings
  app.patch('/merchants/:id/settings',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const body = MerchantSettingsSchema.parse(request.body);
      const merchant = await prisma.merchant.update({
        where: { id: request.params.id },
        data: body,
        select: { id: true, name: true, timezone: true, currency: true, stripePublishableKey: true, updatedAt: true },
      });
      return reply.code(200).send(merchant);
    }
  );
}
