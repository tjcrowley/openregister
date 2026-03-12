import { getDb } from '../db/client';

const API_BASE = process.env.API_URL ?? 'http://localhost:3000';

export interface ReceiptData {
  saleId: string;
  saleNumber: string;
  completedAt: number;
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  lines: Array<{
    name: string;
    qty: number;
    unitCents: number;
    lineTotalCents: number;
  }>;
  payments: Array<{
    method: string;
    amountCents: number;
  }>;
}

export async function generateReceipt(saleId: string): Promise<ReceiptData> {
  const db = getDb();

  const saleResult = await db.execute('SELECT * FROM sales WHERE id = ?', [saleId]);
  const sale = saleResult.rows?.[0] as any;
  if (!sale) throw new Error(`Sale ${saleId} not found`);

  const linesResult = await db.execute(
    'SELECT sl.*, pv.name as variant_name, p.name as product_name FROM sale_lines sl JOIN product_variants pv ON pv.id = sl.variant_id JOIN products p ON p.id = pv.product_id WHERE sl.sale_id = ?',
    [saleId]
  );

  const paymentsResult = await db.execute(
    'SELECT method, amount_cents FROM payments WHERE sale_id = ?',
    [saleId]
  );

  return {
    saleId: sale.id,
    saleNumber: sale.sale_number,
    completedAt: sale.completed_at,
    totalCents: sale.total_cents,
    subtotalCents: sale.subtotal_cents,
    taxCents: sale.tax_cents,
    discountCents: sale.discount_cents,
    lines: ((linesResult.rows ?? []) as any[]).map((l) => ({
      name: `${l.product_name} - ${l.variant_name}`,
      qty: l.qty,
      unitCents: l.unit_cents,
      lineTotalCents: l.line_total_cents,
    })),
    payments: ((paymentsResult.rows ?? []) as any[]).map((p) => ({
      method: p.method,
      amountCents: p.amount_cents,
    })),
  };
}

export async function emailReceipt(saleId: string, email: string, deviceToken: string): Promise<void> {
  const response = await fetch(`${API_BASE}/receipts/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deviceToken}`,
    },
    body: JSON.stringify({ saleId, email }),
  });
  if (!response.ok) throw new Error('Failed to send email receipt');
}

export async function printReceipt(saleId: string): Promise<void> {
  // Delegate to hardware registry's receipt printer driver
  const { hardwareRegistry } = await import('../hardware/HardwareRegistry');
  const printer = hardwareRegistry.get('receipt-printer');
  if (!printer) {
    console.warn('[ReceiptService] No receipt printer registered');
    return;
  }
  const receipt = await generateReceipt(saleId);
  await (printer as any).print(receipt);
}
