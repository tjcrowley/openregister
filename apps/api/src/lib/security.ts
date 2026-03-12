import type { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { redis } from '../db/redis.js';

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: false, // Configured separately for admin frontend
  });

  await app.register(rateLimit, {
    global: false, // Apply per-route
    redis,
    keyGenerator(request) {
      // Use device ID from JWT if available, otherwise IP
      const deviceId = (request as unknown as { deviceId?: string }).deviceId;
      return deviceId ?? request.ip;
    },
  });
}
