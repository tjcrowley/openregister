import { getDb, withTransaction } from '../db/client';
import { generateSaleNumber, computeCartTotals, computeLineTax, computeLineTotal, type CartLine } from '../utils/money';
import { localEventQueue } from '../sync/localEventQueue';
import { buildEnvelope } from '@openregister/events';
import { SALE_COMPLETED, SALE_VOIDED } from '@openregister/events';

interface PaymentData {
  method: string;
  amountCents: number;
  stripePaymentIntentId?: string;
  cryptoInvoiceId?: string;
}

interface CompleteSaleResult {
  saleId: string;
  saleNumber: string;
  totalCents: number;
}

export class CartValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CartValidationError';
  }
}

export async function addLine(
  variantId: string,
  qty: number,
  merchantId: string,
  locationId: string
): Promise<CartLine> {
  const db = getDb();
  const result = await db.execute(
    'SELECT pv.*, p.name as product_name, tr.rate_bps FROM product_variants pv JOIN products p ON p.id = pv.product_id LEFT JOIN tax_rules tr ON tr.id = p.tax_rule_id WHERE pv.id = ? AND pv.merchant_id = ?',
    [variantId, merchantId]
  );
  const row = result.rows?.[0] as any;
  if (!row) throw new CartValidationError(`Variant ${variantId} not found`);

  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    variantId,
    name: `${row.product_name} - ${row.name}`,
    unitCents: row.price,
    qty,
    taxBps: row.rate_bps ?? 0,
    discountCents: 0,
  };
}

export async function validateForCompletion(lines: CartLine[]): Promise<void> {
  if (lines.length === 0) throw new CartValidationError('Cart is empty');
  for (const line of lines) {
    if (line.qty <= 0) throw new CartValidationError(`Invalid qty for ${line.name}`);
    if (line.unitCents < 0) throw new CartValidationError(`Invalid price for ${line.name}`);
  }
}

export async function completeSale(
  lines: CartLine[],
  paymentData: PaymentData,
  context: {
    merchantId: string;
    locationId: string;
    registerId: string;
    sessionId: string;
    deviceId: string;
    userId: string;
  }
): Promise<CompleteSaleResult> {
  await validateForCompletion(lines);
  const totals = computeCartTotals(lines);
  const saleId = `sale-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const saleNumber = generateSaleNumber();

  return withTransaction(async (db) => {
    // Insert sale
    await db.execute(
      `INSERT INTO sales (id, merchant_id, location_id, register_id, session_id, sale_number, status, subtotal_cents, tax_cents, discount_cents, total_cents, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, unixepoch())`,
      [
        saleId,
        context.merchantId,
        context.locationId,
        context.registerId,
        context.sessionId,
        saleNumber,
        totals.subtotalCents,
        totals.taxCents,
        totals.discountCents,
        totals.totalCents,
      ]
    );

    // Insert sale lines
    for (const line of lines) {
      const taxCents = computeLineTax(line.unitCents, line.qty, line.taxBps);
      const lineTotal = computeLineTotal(line);
      const lineId = `sl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await db.execute(
        'INSERT INTO sale_lines (id, sale_id, variant_id, qty, unit_cents, tax_cents, discount_cents, line_total_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [lineId, saleId, line.variantId, line.qty, line.unitCents, taxCents, line.discountCents, lineTotal]
      );

      // Deduct inventory for tracked variants
      await db.execute(
        "UPDATE inventory_items SET quantity_on_hand = MAX(0, quantity_on_hand - ?), updated_at = unixepoch() WHERE variant_id = ? AND location_id = ?",
        [line.qty, line.variantId, context.locationId]
      );
    }

    // Record payment
    const paymentId = `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await db.execute(
      'INSERT INTO payments (id, sale_id, merchant_id, method, amount_cents, stripe_payment_intent_id, status, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())',
      [paymentId, saleId, context.merchantId, paymentData.method, paymentData.amountCents, paymentData.stripePaymentIntentId ?? null, 'captured']
    );

    // Enqueue sync event
    const envelope = buildEnvelope(
      SALE_COMPLETED,
      context.merchantId,
      context.deviceId,
      {
        saleId,
        saleNumber,
        sessionId: context.sessionId,
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        discountCents: totals.discountCents,
        totalCents: totals.totalCents,
        paymentMethod: paymentData.method,
      }
    );
    await localEventQueue.enqueue(envelope as any);

    return { saleId, saleNumber, totalCents: totals.totalCents };
  });
}

export async function voidSale(
  saleId: string,
  reason: string,
  context: { merchantId: string; deviceId: string; userId: string }
): Promise<void> {
  const db = getDb();
  const result = await db.execute("SELECT * FROM sales WHERE id = ? AND merchant_id = ? AND status != 'VOIDED'", [saleId, context.merchantId]);
  const sale = result.rows?.[0] as any;
  if (!sale) throw new CartValidationError('Sale not found or already voided');

  await withTransaction(async (txDb) => {
    await txDb.execute(
      "UPDATE sales SET status = 'VOIDED', voided_at = unixepoch() WHERE id = ?",
      [saleId]
    );

    // Restore inventory
    const linesResult = await txDb.execute('SELECT * FROM sale_lines WHERE sale_id = ?', [saleId]);
    const lines = (linesResult.rows ?? []) as any[];
    for (const line of lines) {
      await txDb.execute(
        'UPDATE inventory_items SET quantity_on_hand = quantity_on_hand + ?, updated_at = unixepoch() WHERE variant_id = ?',
        [line.qty, line.variant_id]
      );
    }

    const envelope = buildEnvelope(
      SALE_VOIDED,
      context.merchantId,
      context.deviceId,
      { saleId, saleNumber: sale.sale_number, reason, userId: context.userId }
    );
    await localEventQueue.enqueue(envelope as any);
  });
}
