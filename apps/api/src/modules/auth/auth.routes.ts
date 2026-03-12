import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { signDeviceToken, signAdminToken } from '../../lib/jwt.js';
import { logger } from '../../lib/logger.js';
import { createHmac, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const DeviceAuthSchema = z.object({
  deviceId: z.string().uuid(),
  merchantId: z.string().uuid(),
  locationId: z.string().uuid(),
  deviceSecret: z.string().min(16),
});

const AdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const PinLoginSchema = z.object({
  merchantId: z.string().uuid(),
  pin: z.string().min(4).max(8),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashPin(pin: string): string {
  return createHmac('sha256', 'openregister-pin-salt').update(pin).digest('hex');
}

function verifyPin(pin: string, hash: string): boolean {
  const computed = Buffer.from(hashPin(pin), 'hex');
  const stored = Buffer.from(hash, 'hex');
  if (computed.length !== stored.length) return false;
  return timingSafeEqual(computed, stored);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /auth/device
   * Authenticates a POS terminal using its device secret.
   * Returns a signed RS256 JWT valid for 24 hours.
   */
  app.post(
    '/device',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = DeviceAuthSchema.parse(request.body);

      const device = await prisma.device.findFirst({
        where: {
          id: body.deviceId,
          merchantId: body.merchantId,
          locationId: body.locationId,
        },
        select: { id: true, deviceSecret: true, merchantId: true, locationId: true },
      });

      if (!device) {
        return reply.code(401).send({ error: 'Device not found' });
      }

      // Constant-time comparison of device secret
      const providedBuf = Buffer.from(body.deviceSecret);
      const storedBuf = Buffer.from(device.deviceSecret);
      const isValid =
        providedBuf.length === storedBuf.length && timingSafeEqual(providedBuf, storedBuf);

      if (!isValid) {
        logger.warn({ deviceId: body.deviceId }, 'Device authentication failed: bad secret');
        return reply.code(401).send({ error: 'Invalid device secret' });
      }

      // Update lastSeenAt
      await prisma.device.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      });

      const token = await signDeviceToken({
        deviceId: device.id,
        merchantId: device.merchantId,
        locationId: device.locationId,
      });

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      logger.info({ deviceId: device.id, merchantId: device.merchantId }, 'Device authenticated');

      return reply.code(200).send({ token, expiresAt });
    }
  );

  /**
   * POST /auth/pin
   * Authenticates a cashier/manager by PIN for session operations.
   * Returns user info (no JWT — PIN auth is per-action, not session-based).
   */
  app.post(
    '/pin',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = PinLoginSchema.parse(request.body);

      const users = await prisma.user.findMany({
        where: {
          merchantId: body.merchantId,
          isActive: true,
        },
        select: { id: true, name: true, role: true, pinHash: true, merchantId: true },
      });

      // Find the user whose PIN matches — we check all active users because
      // PINs are scoped per merchant (not globally unique)
      const matchedUser = users.find((u) => verifyPin(body.pin, u.pinHash));

      if (!matchedUser) {
        return reply.code(401).send({ error: 'Invalid PIN' });
      }

      return reply.code(200).send({
        userId: matchedUser.id,
        name: matchedUser.name,
        role: matchedUser.role,
        merchantId: matchedUser.merchantId,
      });
    }
  );

  /**
   * POST /auth/admin/login
   * Admin portal login. Returns a signed HMAC-SHA256 JWT.
   * In production this should be backed by a proper user store with bcrypt.
   */
  app.post(
    '/admin/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = AdminLoginSchema.parse(request.body);

      // For now admin users are backed by the User table with OWNER role.
      // In a full implementation this would be a separate admin_users table.
      const user = await prisma.user.findFirst({
        where: {
          email: body.email,
          role: 'OWNER',
          isActive: true,
        },
        select: { id: true, email: true, role: true, pinHash: true },
      });

      if (!user || !user.email) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // Validate password stored as pin-style hash
      if (!verifyPin(body.password, user.pinHash)) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const token = signAdminToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      logger.info({ userId: user.id, email: user.email }, 'Admin login successful');

      return reply.code(200).send({ token });
    }
  );
}
