import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyDeviceToken } from '../lib/jwt.js';
import { logger } from '../lib/logger.js';

export interface DeviceContext {
  deviceId: string;
  merchantId: string;
  locationId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    deviceContext?: DeviceContext;
  }
}

export async function deviceAuthHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyDeviceToken(token);
    request.deviceContext = {
      deviceId: payload.sub,
      merchantId: payload.merchantId,
      locationId: payload.locationId,
    };
  } catch (err) {
    logger.warn({ err }, 'Device auth failed');
    return reply.code(401).send({ error: 'Invalid or expired device token' });
  }
}
