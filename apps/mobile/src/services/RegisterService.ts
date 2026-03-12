import { getDb, withTransaction } from '../db/client';

export class RequiresManagerApproval extends Error {
  varianceCents: number;
  expectedCashCents: number;
  countedCashCents: number;

  constructor(varianceCents: number, expectedCashCents: number, countedCashCents: number) {
    super('Variance exceeds $5.00 — manager approval required');
    this.name = 'RequiresManagerApproval';
    this.varianceCents = varianceCents;
    this.expectedCashCents = expectedCashCents;
    this.countedCashCents = countedCashCents;
  }
}

export interface Session {
  id: string;
  merchantId: string;
  locationId: string;
  userId: string;
  status: string;
  openingCashCents: number;
  closingCashCents?: number;
  countedCashCents?: number;
  varianceCents?: number;
  openedAt: number;
  closedAt?: number;
}

export async function openSession(
  userId: string,
  openingCash: number,
  context: { merchantId: string; locationId: string }
): Promise<Session> {
  const db = getDb();

  const existing = await db.execute(
    "SELECT * FROM register_sessions WHERE merchant_id = ? AND location_id = ? AND status = 'OPEN' LIMIT 1",
    [context.merchantId, context.locationId]
  );
  if ((existing.rows?.length ?? 0) > 0) {
    throw new Error('A session is already open for this location');
  }

  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.execute(
    "INSERT INTO register_sessions (id, merchant_id, location_id, user_id, opening_cash_cents, status) VALUES (?, ?, ?, ?, ?, 'OPEN')",
    [sessionId, context.merchantId, context.locationId, userId, openingCash]
  );

  return {
    id: sessionId,
    merchantId: context.merchantId,
    locationId: context.locationId,
    userId,
    status: 'OPEN',
    openingCashCents: openingCash,
    openedAt: Math.floor(Date.now() / 1000),
  };
}

export async function closeSession(
  sessionId: string,
  countedCash: number,
  context: { merchantId: string }
): Promise<Session> {
  const db = getDb();

  const sessionResult = await db.execute(
    "SELECT * FROM register_sessions WHERE id = ? AND merchant_id = ? AND status = 'OPEN'",
    [sessionId, context.merchantId]
  );
  const session = sessionResult.rows?.[0] as any;
  if (!session) throw new Error('Session not found or not open');

  // Calculate expected cash from opening float + cash payments
  const cashResult = await db.execute(
    "SELECT COALESCE(SUM(amount_cents), 0) as total FROM payments WHERE sale_id IN (SELECT id FROM sales WHERE session_id = ?) AND method = 'CASH' AND status = 'captured'",
    [sessionId]
  );
  const cashSales = (cashResult.rows?.[0] as any)?.total ?? 0;
  const expectedCashCents = session.opening_cash_cents + cashSales;
  const varianceCents = countedCash - expectedCashCents;

  if (Math.abs(varianceCents) > 500) {
    throw new RequiresManagerApproval(varianceCents, expectedCashCents, countedCash);
  }

  return withTransaction(async (txDb) => {
    await txDb.execute(
      "UPDATE register_sessions SET status = 'CLOSED', counted_cash_cents = ?, closing_cash_cents = ?, variance_cents = ?, closed_at = unixepoch() WHERE id = ?",
      [countedCash, expectedCashCents, varianceCents, sessionId]
    );
    return {
      id: sessionId,
      merchantId: context.merchantId,
      locationId: session.location_id,
      userId: session.user_id,
      status: 'CLOSED',
      openingCashCents: session.opening_cash_cents,
      closingCashCents: expectedCashCents,
      countedCashCents: countedCash,
      varianceCents,
      openedAt: session.opened_at,
      closedAt: Math.floor(Date.now() / 1000),
    };
  });
}

export async function getCurrentSession(merchantId: string, locationId: string): Promise<Session | null> {
  const db = getDb();
  const result = await db.execute(
    "SELECT * FROM register_sessions WHERE merchant_id = ? AND location_id = ? AND status = 'OPEN' LIMIT 1",
    [merchantId, locationId]
  );
  const row = result.rows?.[0] as any;
  if (!row) return null;
  return {
    id: row.id,
    merchantId: row.merchant_id,
    locationId: row.location_id,
    userId: row.user_id,
    status: row.status,
    openingCashCents: row.opening_cash_cents,
    closingCashCents: row.closing_cash_cents ?? undefined,
    countedCashCents: row.counted_cash_cents ?? undefined,
    varianceCents: row.variance_cents ?? undefined,
    openedAt: row.opened_at,
    closedAt: row.closed_at ?? undefined,
  };
}
