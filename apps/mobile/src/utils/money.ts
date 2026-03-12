export interface CartLine {
  id: string;
  variantId: string;
  name: string;
  unitCents: number;
  qty: number;
  taxBps: number;
  discountCents: number;
}

export interface CartTotals {
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
}

/** Compute tax for a single line. taxBps: e.g. 1000 = 10% */
export function computeLineTax(unitCents: number, qty: number, taxBps: number): number {
  return Math.round((unitCents * qty * taxBps) / 10000);
}

/** Compute line total: (unitCents * qty) + taxCents - discountCents */
export function computeLineTotal(line: CartLine): number {
  const taxCents = computeLineTax(line.unitCents, line.qty, line.taxBps);
  return line.unitCents * line.qty + taxCents - line.discountCents;
}

/** Derive all cart totals from lines. Never stored — always recomputed. */
export function computeCartTotals(lines: CartLine[]): CartTotals {
  let subtotalCents = 0;
  let taxCents = 0;
  let discountCents = 0;

  for (const line of lines) {
    subtotalCents += line.unitCents * line.qty;
    taxCents += computeLineTax(line.unitCents, line.qty, line.taxBps);
    discountCents += line.discountCents;
  }

  const totalCents = subtotalCents + taxCents - discountCents;
  return { subtotalCents, taxCents, discountCents, totalCents };
}

/** Format cents to display string. E.g. 1050 → "$10.50" */
export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Parse a user-entered string like "10.50" or "1050" to integer cents. */
export function parseToCents(str: string): number {
  const cleaned = str.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/** Generate a human-readable sale number: e.g. "S-20260311-001" */
export function generateSaleNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `S-${date}-${seq}`;
}
