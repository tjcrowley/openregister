import { z } from 'zod';

// ---------------------------------------------------------------------------
// Local event
// ---------------------------------------------------------------------------

export const LocalEventSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  deviceId: z.string().uuid(),
  eventType: z.string(),
  payload: z.unknown(),
  occurredAt: z.string().datetime(),
});

export type LocalEvent = z.infer<typeof LocalEventSchema>;

// ---------------------------------------------------------------------------
// Push / ack
// ---------------------------------------------------------------------------

export const PushPayloadSchema = z.object({
  events: z.array(LocalEventSchema).max(500),
});

export type PushPayload = z.infer<typeof PushPayloadSchema>;

export const AckPayloadSchema = z.object({
  eventIds: z.array(z.string().uuid()).min(1).max(500),
});

export type AckPayload = z.infer<typeof AckPayloadSchema>;

// ---------------------------------------------------------------------------
// Pull / cursor
// ---------------------------------------------------------------------------

export const SyncCursorSchema = z.number().int().nonnegative();

export type SyncCursor = z.infer<typeof SyncCursorSchema>;

export const SyncCursorNameEnum = z.enum([
  'products',
  'inventory',
  'register_sessions',
  'sales',
  'settings',
]);

export type SyncCursorName = z.infer<typeof SyncCursorNameEnum>;

export const PullQuerySchema = z.object({
  cursor: SyncCursorSchema,
  limit: z.number().int().min(1).max(100).default(50),
  cursorName: SyncCursorNameEnum,
});

export type PullQuery = z.infer<typeof PullQuerySchema>;
