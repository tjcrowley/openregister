import { getDb, withTransaction } from '../db/client';
import { localEventQueue } from '../sync/localEventQueue';
import { buildEnvelope, REFUND_ISSUED } from '@openregister/events';

export interface RefundLine {
  variantId: string;
  qty: number;
  amountCents: number;
}

export interface RefundResult {
  refundId: string;
  saleId: string;
  totalAmountCents: number;
}

export class RefundValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RefundValidationError';
  }
}

export async function initiateRefund(
  saleId: string,
  lines: RefundLine[],
  reason: string,
  context: { merchantId: string; deviceId: string; userId: string }
): Promise<RefundResult> {
  const db = getDb();

  const saleResult = await db.execute(
    "SELECT * FROM sales WHERE id = ? AND merchant_id = ? AND status = 'COMPLETED'",
    [saleId, context.merchantId]
  );
  const sale = saleResult.rows?.[0] as any;
  if (!sale) throw new RefundValidationError('Sale not found or not eligible for refund');

  // Validate line quantities
  for (const line of lines) {
    const lineResult = await db.execute(
      'SELECT qty FROM sale_lines WHERE sale_id = ? AND variant_id = ?',
      [saleId, line.variantId]
    );
    const saleLine = lineResult.rows?.[0] as any;
    if (!saleLine) throw new RefundValidationError(`Variant ${line.variantId} not found in sale`);
    if (line.qty > saleLine.qty) throw new RefundValidationError(`Cannot refund more than purchased qty for variant ${line.variantId}`);
  }

  const totalAmountCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
  const refundId = `refund-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return withTransaction(async (txDb) => {
    await txDb.execute(
      "UPDATE sales SET status = 'REFUNDED' WHERE id = ?",
      [saleId]
    );

    // Restore inventory
    for (const line of lines) {
      await txDb.execute(
        'UPDATE inventory_items SET quantity_on_hand = quantity_on_hand + ?, updated_at = unixepoch() WHERE variant_id = ?',
        [line.qty, line.variantId]
      );
    }

    const envelope = buildEnvelope(
      REFUND_ISSUED,
      context.merchantId,
      context.deviceId,
      {
        refundId,
        saleId,
        amountCents: totalAmountCents,
        lines: lines.map((l) => ({ variantId: l.variantId, qty: l.qty, amountCents: l.amountCents })),
        reason,
      }
    );
    await localEventQueue.enqueue(envelope as any);

    return { refundId, saleId, totalAmountCents };
  });
}
