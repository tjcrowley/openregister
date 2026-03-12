import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAdminToken } from '../lib/jwt.js';
import { logger } from '../lib/logger.js';

export interface AdminUser {
  userId: string;
  email: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    adminUser?: AdminUser;
  }
}

export async function adminAuthHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAdminToken(token);
    request.adminUser = payload;
  } catch (err) {
    logger.warn({ err }, 'Admin auth failed');
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
}
