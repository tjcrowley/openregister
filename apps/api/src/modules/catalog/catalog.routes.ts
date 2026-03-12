import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { deviceAuthHook } from '../../middleware/deviceAuthHook.js';
import { logger } from '../../lib/logger.js';

const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  imageUrl: z.string().url().optional(),
  basePrice: z.number().int().min(0),
  taxRuleId: z.string().uuid().optional(),
});

const UpdateProductSchema = CreateProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const CreateVariantSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  price: z.number().int().min(0),
  cost: z.number().int().min(0).optional(),
  barcode: z.string().optional(),
  trackInventory: z.boolean().default(true),
});

const UpdateVariantSchema = CreateVariantSchema.partial();

const PaginationSchema = z.object({
  page: z.string().optional().transform((v) => Math.max(1, parseInt(v ?? '1', 10))),
  pageSize: z.string().optional().transform((v) => Math.min(100, parseInt(v ?? '50', 10))),
  categoryId: z.string().uuid().optional(),
  search: z.string().optional(),
  isActive: z.string().optional().transform((v) => v === 'true' ? true : v === 'false' ? false : undefined),
});

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', deviceAuthHook);

  // GET /catalog/products
  app.get('/products', async (request: FastifyRequest, reply: FastifyReply) => {
    const { merchantId } = request.deviceContext!;
    const q = PaginationSchema.parse(request.query);
    const skip = (q.page - 1) * q.pageSize;

    const where: any = { merchantId };
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.isActive !== undefined) where.isActive = q.isActive;
    if (q.search) where.name = { contains: q.search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { variants: true, category: true, taxRule: true },
        skip,
        take: q.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    return reply.code(200).send({ data, total, page: q.page, pageSize: q.pageSize });
  });

  // GET /catalog/products/:id
  app.get('/products/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { merchantId } = request.deviceContext!;
    const product = await prisma.product.findFirst({
      where: { id: request.params.id, merchantId },
      include: { variants: true, category: true, taxRule: true },
    });
    if (!product) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Product not found' });
    return reply.code(200).send(product);
  });

  // POST /catalog/products
  app.post('/products', async (request: FastifyRequest, reply: FastifyReply) => {
    const { merchantId } = request.deviceContext!;
    const body = CreateProductSchema.parse(request.body);
    const product = await prisma.product.create({
      data: { ...body, merchantId },
      include: { variants: true },
    });
    logger.info({ productId: product.id, merchantId }, 'Product created');
    return reply.code(201).send(product);
  });

  // PATCH /catalog/products/:id
  app.patch('/products/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { merchantId } = request.deviceContext!;
    const body = UpdateProductSchema.parse(request.body);
    const existing = await prisma.product.findFirst({ where: { id: request.params.id, merchantId } });
    if (!existing) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Product not found' });
    const product = await prisma.product.update({ where: { id: request.params.id }, data: body, include: { variants: true } });
    return reply.code(200).send(product);
  });

  // DELETE /catalog/products/:id (soft-delete by setting isActive = false)
  app.delete('/products/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { merchantId } = request.deviceContext!;
    const existing = await prisma.product.findFirst({ where: { id: request.params.id, merchantId } });
    if (!existing) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Product not found' });
    await prisma.product.update({ where: { id: request.params.id }, data: { isActive: false } });
    return reply.code(204).send();
  });

  // GET /catalog/products/:id/variants
  app.get('/products/:id/variants', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { merchantId } = request.deviceContext!;
    const variants = await prisma.productVariant.findMany({
      where: { productId: request.params.id, merchantId },
    });
    return reply.code(200).send(variants);
  });

  // POST /catalog/products/:id/variants
  app.post('/products/:id/variants', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { merchantId } = request.deviceContext!;
    const body = CreateVariantSchema.parse(request.body);
    const product = await prisma.product.findFirst({ where: { id: request.params.id, merchantId } });
    if (!product) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Product not found' });
    const variant = await prisma.productVariant.create({
      data: { ...body, productId: request.params.id, merchantId },
    });
    return reply.code(201).send(variant);
  });

  // PATCH /catalog/products/:productId/variants/:variantId
  app.patch('/products/:productId/variants/:variantId',
    async (request: FastifyRequest<{ Params: { productId: string; variantId: string } }>, reply: FastifyReply) => {
      const { merchantId } = request.deviceContext!;
      const body = UpdateVariantSchema.parse(request.body);
      const variant = await prisma.productVariant.findFirst({
        where: { id: request.params.variantId, productId: request.params.productId, merchantId },
      });
      if (!variant) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Variant not found' });
      const updated = await prisma.productVariant.update({ where: { id: request.params.variantId }, data: body });
      return reply.code(200).send(updated);
    }
  );

  // DELETE /catalog/products/:productId/variants/:variantId
  app.delete('/products/:productId/variants/:variantId',
    async (request: FastifyRequest<{ Params: { productId: string; variantId: string } }>, reply: FastifyReply) => {
      const { merchantId } = request.deviceContext!;
      const variant = await prisma.productVariant.findFirst({
        where: { id: request.params.variantId, productId: request.params.productId, merchantId },
      });
      if (!variant) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Variant not found' });
      await prisma.productVariant.delete({ where: { id: request.params.variantId } });
      return reply.code(204).send();
    }
  );
}
