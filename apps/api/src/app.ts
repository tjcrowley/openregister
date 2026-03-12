import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './errors/error.handler.js';
import { deviceAuthHook } from './middleware/deviceAuthHook.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { syncRoutes } from './modules/sync/sync.routes.js';
import { catalogRoutes } from './modules/catalog/catalog.routes.js';
import { inventoryRoutes } from './modules/inventory/inventory.routes.js';
import { paymentsRoutes } from './modules/payments/payments.routes.js';
import { registerRoutes } from './modules/register/register.routes.js';
import { adminRouter } from './modules/admin/admin.router.js';
import { prisma } from './db/client.js';

export async function buildApp() {
  const app = Fastify({
    logger: logger as any,
    requestIdHeader: 'x-request-id',
    trustProxy: true,
  });

  // Security plugins
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    redis: undefined, // will use in-memory; swap for Redis in prod
  });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  // RLS hook — set merchant context for every authenticated device request
  app.addHook('onRequest', async (request) => {
    if (request.deviceContext?.merchantId) {
      await prisma.$executeRaw`SELECT set_config('app.current_merchant_id', ${request.deviceContext.merchantId}, true)`;
    }
  });

  // Routes
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(syncRoutes, { prefix: '/sync' });
  await app.register(catalogRoutes, { prefix: '/catalog' });
  await app.register(inventoryRoutes, { prefix: '/inventory' });
  await app.register(paymentsRoutes, { prefix: '/payments' });
  await app.register(registerRoutes, { prefix: '/register' });
  await app.register(adminRouter, { prefix: '/admin' });

  // Error handler
  app.setErrorHandler(errorHandler);

  return app;
}
