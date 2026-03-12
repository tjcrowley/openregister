import { randomUUID } from 'crypto';
import type {
  Device,
  InventoryItem,
  Location,
  Merchant,
  Payment,
  Product,
  ProductVariant,
  RegisterSession,
  Sale,
  SaleLine,
  User,
} from '@openregister/types';
import {
  PaymentMethod,
  RegisterSessionStatus,
  SaleStatus,
  UserRole,
} from '@openregister/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();

/** Naive bcrypt-shaped placeholder for the PIN "1234". Real tests that need
 *  genuine bcrypt should swap this out via the `overrides` argument. */
const DEFAULT_PIN_HASH =
  '$2b$10$placeholder.hash.for.pin.1234.xxxxxxxxxxxxxxxxxxxxxxxxxxxx';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createMerchant(overrides?: Partial<Merchant>): Merchant {
  return {
    id: randomUUID(),
    name: 'Test Merchant',
    timezone: 'America/New_York',
    currency: 'USD',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function createLocation(overrides?: Partial<Location>): Location {
  return {
    id: randomUUID(),
    merchantId: randomUUID(),
    name: 'Main Store',
    address: '123 Main St, Springfield, IL 62701',
    timezone: 'America/Chicago',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function createDevice(overrides?: Partial<Device>): Device {
  return {
    id: randomUUID(),
    merchantId: randomUUID(),
    locationId: randomUUID(),
    name: 'Register 1',
    createdAt: NOW,
    ...overrides,
  };
}

export function createUser(overrides?: Partial<User>): User {
  return {
    id: randomUUID(),
    merchantId: randomUUID(),
    name: 'Test Cashier',
    pinHash: DEFAULT_PIN_HASH,
    role: UserRole.CASHIER,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function createProduct(overrides?: Partial<Product>): Product {
  return {
    id: randomUUID(),
    merchantId: randomUUID(),
    name: 'Test Product',
    description: 'A product used in tests',
    basePrice: 1000,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function createProductVariant(overrides?: Partial<ProductVariant>): ProductVariant {
  return {
    id: randomUUID(),
    productId: randomUUID(),
    merchantId: randomUUID(),
    sku: `SKU-${Math.floor(Math.random() * 100_000).toString().padStart(6, '0')}`,
    name: 'Default',
    price: 1000,
    trackInventory: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function createInventoryItem(overrides?: Partial<InventoryItem>): InventoryItem {
  return {
    id: randomUUID(),
    merchantId: randomUUID(),
    variantId: randomUUID(),
    locationId: randomUUID(),
    quantityOnHand: 100,
    updatedAt: NOW,
    ...overrides,
  };
}

export function createSale(overrides?: Partial<Sale>): Sale {
  return {
    id: randomUUID(),
    merchantId: randomUUID(),
    locationId: randomUUID(),
    registerId: randomUUID(),
    sessionId: randomUUID(),
    saleNumber: `SALE-${Date.now()}`,
    status: SaleStatus.COMPLETED,
    subtotalCents: 1000,
    taxCents: 88,
    discountCents: 0,
    totalCents: 1088,
    createdAt: NOW,
    completedAt: NOW,
    ...overrides,
  };
}

export function createSaleLine(overrides?: Partial<SaleLine>): SaleLine {
  return {
    id: randomUUID(),
    saleId: randomUUID(),
    variantId: randomUUID(),
    qty: 1,
    unitCents: 1000,
    taxCents: 88,
    discountCents: 0,
    lineTotalCents: 1088,
    ...overrides,
  };
}

export function createPayment(overrides?: Partial<Payment>): Payment {
  return {
    id: randomUUID(),
    saleId: randomUUID(),
    merchantId: randomUUID(),
    method: PaymentMethod.CASH,
    amountCents: 1088,
    status: 'succeeded',
    createdAt: NOW,
    ...overrides,
  };
}

export function createRegisterSession(overrides?: Partial<RegisterSession>): RegisterSession {
  return {
    id: randomUUID(),
    merchantId: randomUUID(),
    locationId: randomUUID(),
    userId: randomUUID(),
    status: RegisterSessionStatus.OPEN,
    openingCashCents: 10000,
    openedAt: NOW,
    ...overrides,
  };
}
