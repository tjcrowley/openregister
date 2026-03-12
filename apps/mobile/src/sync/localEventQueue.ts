import { getDb } from '../db/client';
import type { LocalEvent } from '@openregister/types';

const PURGE_BATCH = 500;

export const localEventQueue = {
  async enqueue(event: LocalEvent): Promise<void> {
    const db = getDb();
    await db.execute(
      `INSERT OR IGNORE INTO event_log (id, merchant_id, device_id, event_type, payload, occurred_at, is_acknowledged)
       VALUES (?, ?, ?, ?, ?, unixepoch(), 0)`,
      [
        event.id,
        event.merchantId,
        event.deviceId,
        event.eventType,
        JSON.stringify(event.payload),
      ]
    );
  },

  async getPendingEvents(limit = 100): Promise<LocalEvent[]> {
    const db = getDb();
    const result = await db.execute(
      'SELECT * FROM event_log WHERE is_acknowledged = 0 ORDER BY occurred_at ASC LIMIT ?',
      [limit]
    );
    return ((result.rows ?? []) as any[]).map((row) => ({
      id: row.id,
      merchantId: row.merchant_id,
      deviceId: row.device_id,
      eventType: row.event_type,
      payload: JSON.parse(row.payload),
      occurredAt: new Date(row.occurred_at * 1000).toISOString(),
      syncedAt: row.synced_at ? new Date(row.synced_at * 1000).toISOString() : undefined,
    }));
  },

  async markAcknowledged(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = getDb();
    // SQLite doesn't support IN with parameterized array natively in all drivers;
    // batch in groups of 100
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const placeholders = batch.map(() => '?').join(',');
      await db.execute(
        `UPDATE event_log SET is_acknowledged = 1, synced_at = unixepoch() WHERE id IN (${placeholders})`,
        batch
      );
    }
  },

  async purgeOldEvents(days: number): Promise<void> {
    const db = getDb();
    const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
    await db.execute(
      'DELETE FROM event_log WHERE is_acknowledged = 1 AND occurred_at < ?',
      [cutoff]
    );
  },
};
