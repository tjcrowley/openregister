import { getDb } from '../db/client';
import type { ServerEvent } from '@openregister/types';

/**
 * Apply a server-side event to the local SQLite database idempotently.
 * Checks if the eventId has already been applied before making changes.
 */
export async function applyServerEvent(event: ServerEvent): Promise<void> {
  const db = getDb();

  // Idempotency check
  const existing = await db.execute(
    'SELECT id FROM event_log WHERE id = ? AND is_acknowledged = 1',
    [event.eventId]
  );
  if ((existing.rows?.length ?? 0) > 0) return; // already applied

  const payload = event.payload as any;

  switch (event.eventType) {
    case 'catalog.product.created':
    case 'catalog.product.updated': {
      const p = payload;
      await db.execute(
        `INSERT INTO products (id, merchant_id, name, description, category_id, base_price, tax_rule_id, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, unixepoch())
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           category_id = excluded.category_id,
           base_price = excluded.base_price,
           tax_rule_id = excluded.tax_rule_id,
           updated_at = unixepoch()`,
        [p.productId, p.merchantId ?? '', p.name ?? '', p.description ?? null, p.categoryId ?? null, p.basePrice ?? 0, p.taxRuleId ?? null]
      );
      break;
    }

    case 'catalog.product.archived': {
      await db.execute(
        'UPDATE products SET is_active = 0, updated_at = unixepoch() WHERE id = ?',
        [payload.productId]
      );
      break;
    }

    case 'catalog.variant.created':
    case 'catalog.variant.updated': {
      const v = payload;
      await db.execute(
        `INSERT INTO product_variants (id, product_id, merchant_id, sku, name, price, track_inventory, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, unixepoch())
         ON CONFLICT(id) DO UPDATE SET
           sku = excluded.sku,
           name = excluded.name,
           price = excluded.price,
           updated_at = unixepoch()`,
        [v.variantId, v.productId ?? '', v.merchantId ?? '', v.sku ?? '', v.name ?? v.sku ?? '', v.price ?? 0]
      );
      break;
    }

    case 'inventory.adjusted': {
      const inv = payload;
      await db.execute(
        `INSERT INTO inventory_items (id, merchant_id, variant_id, location_id, quantity_on_hand, updated_at)
         VALUES (?, '', ?, ?, MAX(0, ?), unixepoch())
         ON CONFLICT(variant_id, location_id) DO UPDATE SET
           quantity_on_hand = MAX(0, quantity_on_hand + ?),
           updated_at = unixepoch()`,
        [
          `inv-${inv.variantId}-${inv.locationId}`,
          inv.variantId,
          inv.locationId,
          inv.quantityDelta,
          inv.quantityDelta,
        ]
      );
      break;
    }

    case 'inventory.counted': {
      const inv = payload;
      await db.execute(
        `INSERT INTO inventory_items (id, merchant_id, variant_id, location_id, quantity_on_hand, updated_at)
         VALUES (?, '', ?, ?, ?, unixepoch())
         ON CONFLICT(variant_id, location_id) DO UPDATE SET
           quantity_on_hand = ?,
           updated_at = unixepoch()`,
        [
          `inv-${inv.variantId}-${inv.locationId}`,
          inv.variantId,
          inv.locationId,
          inv.countedQuantity,
          inv.countedQuantity,
        ]
      );
      break;
    }

    case 'merchant.settings.updated': {
      const changes = payload.changes as Record<string, unknown>;
      for (const [key, value] of Object.entries(changes)) {
        await db.execute(
          'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()',
          [key, JSON.stringify(value)]
        );
      }
      break;
    }

    default:
      // Unknown event type — skip silently
      break;
  }

  // Mark as applied in local event_log
  await db.execute(
    `INSERT OR IGNORE INTO event_log (id, merchant_id, device_id, event_type, payload, occurred_at, is_acknowledged)
     VALUES (?, '', 'server', ?, ?, unixepoch(), 1)`,
    [event.eventId, event.eventType, JSON.stringify(event.payload)]
  );
}
