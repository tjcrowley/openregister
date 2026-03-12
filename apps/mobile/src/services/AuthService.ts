import { getDb } from '../db/client';
import { UserRole } from '@openregister/types';

export interface LocalUser {
  id: string;
  merchantId: string;
  name: string;
  email?: string;
  pinHash: string;
  role: UserRole;
  isActive: boolean;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.CASHIER]: 1,
  [UserRole.SUPERVISOR]: 2,
  [UserRole.MANAGER]: 3,
  [UserRole.OWNER]: 4,
};

function hashPin(pin: string): string {
  // Simple deterministic hash for local PIN verification
  // In production use bcrypt-ts
  let hash = 0;
  const salted = `openregister-pin:${pin}`;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export async function verifyPin(userId: string, pin: string): Promise<LocalUser | null> {
  const db = getDb();
  const result = await db.execute(
    'SELECT * FROM users WHERE id = ? AND is_active = 1',
    [userId]
  );
  const row = result.rows?.[0] as any;
  if (!row) return null;

  const computed = hashPin(pin);
  if (computed !== row.pin_hash) return null;

  return {
    id: row.id,
    merchantId: row.merchant_id,
    name: row.name,
    email: row.email ?? undefined,
    pinHash: row.pin_hash,
    role: row.role as UserRole,
    isActive: row.is_active === 1,
  };
}

export async function verifyManagerPin(pin: string, merchantId: string): Promise<LocalUser | null> {
  const db = getDb();
  const result = await db.execute(
    "SELECT * FROM users WHERE merchant_id = ? AND is_active = 1 AND role IN ('MANAGER', 'OWNER', 'SUPERVISOR')",
    [merchantId]
  );
  const rows = (result.rows ?? []) as any[];

  const computed = hashPin(pin);
  const matched = rows.find((r: any) => r.pin_hash === computed);
  if (!matched) return null;

  return {
    id: matched.id,
    merchantId: matched.merchant_id,
    name: matched.name,
    email: matched.email ?? undefined,
    pinHash: matched.pin_hash,
    role: matched.role as UserRole,
    isActive: matched.is_active === 1,
  };
}

export async function getCurrentUser(userId: string): Promise<LocalUser | null> {
  const db = getDb();
  const result = await db.execute('SELECT * FROM users WHERE id = ? AND is_active = 1', [userId]);
  const row = result.rows?.[0] as any;
  if (!row) return null;
  return {
    id: row.id,
    merchantId: row.merchant_id,
    name: row.name,
    email: row.email ?? undefined,
    pinHash: row.pin_hash,
    role: row.role as UserRole,
    isActive: row.is_active === 1,
  };
}

export function hasRole(user: LocalUser, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[minRole];
}
