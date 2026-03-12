export enum UserRole {
  CASHIER = 'CASHIER',
  SUPERVISOR = 'SUPERVISOR',
  MANAGER = 'MANAGER',
  OWNER = 'OWNER',
}

export enum SaleStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  VOIDED = 'VOIDED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD_PRESENT = 'CARD_PRESENT',
  CARD_NOT_PRESENT = 'CARD_NOT_PRESENT',
  CRYPTO = 'CRYPTO',
  GIFT_CARD = 'GIFT_CARD',
}

export enum CryptoInvoiceStatus {
  GENERATING = 'GENERATING',
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  CONFIRMED = 'CONFIRMED',
  EXPIRED = 'EXPIRED',
  ERROR = 'ERROR',
}

export enum RegisterSessionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export interface Merchant {
  id: string;
  name: string;
  stripeAccountId?: string;
  stripePublishableKey?: string;
  timezone: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  merchantId: string;
  name: string;
  address?: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  merchantId: string;
  locationId: string;
  name: string;
  lastSeenAt?: string;
  createdAt: string;
}

export interface User {
  id: string;
  merchantId: string;
  name: string;
  email?: string;
  pinHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaxRule {
  id: string;
  merchantId: string;
  name: string;
  /** Rate in basis points (e.g. 875 = 8.75%) */
  rateBps: number;
  isDefault: boolean;
  appliesTo: string[];
  createdAt: string;
}

export interface Product {
  id: string;
  merchantId: string;
  name: string;
  description?: string;
  categoryId?: string;
  imageUrl?: string;
  /** Price in cents */
  basePrice: number;
  taxRuleId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  merchantId: string;
  sku: string;
  name: string;
  /** Price in cents */
  price: number;
  /** Cost in cents */
  cost?: number;
  barcode?: string;
  trackInventory: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  merchantId: string;
  variantId: string;
  locationId: string;
  quantityOnHand: number;
  reorderPoint?: number;
  updatedAt: string;
}

export interface RegisterSession {
  id: string;
  merchantId: string;
  locationId: string;
  userId: string;
  status: RegisterSessionStatus;
  /** Opening float in cents */
  openingCashCents: number;
  /** Closing cash in cents (system-calculated) */
  closingCashCents?: number;
  /** Physically counted cash in cents */
  countedCashCents?: number;
  /** Variance in cents (counted - expected) */
  varianceCents?: number;
  openedAt: string;
  closedAt?: string;
  notes?: string;
}

export interface Sale {
  id: string;
  merchantId: string;
  locationId: string;
  registerId: string;
  sessionId: string;
  saleNumber: string;
  status: SaleStatus;
  /** Subtotal before tax and discounts, in cents */
  subtotalCents: number;
  /** Total tax in cents */
  taxCents: number;
  /** Total discount in cents */
  discountCents: number;
  /** Final total in cents */
  totalCents: number;
  customerId?: string;
  notes?: string;
  completedAt?: string;
  voidedAt?: string;
  createdAt: string;
}

export interface SaleLine {
  id: string;
  saleId: string;
  variantId: string;
  qty: number;
  /** Unit price in cents */
  unitCents: number;
  /** Tax for this line in cents */
  taxCents: number;
  /** Discount for this line in cents */
  discountCents: number;
  /** Line total (qty * unitCents + taxCents - discountCents) in cents */
  lineTotalCents: number;
}

export interface Payment {
  id: string;
  saleId: string;
  merchantId: string;
  method: PaymentMethod;
  /** Amount in cents */
  amountCents: number;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  status: string;
  capturedAt?: string;
  createdAt: string;
}

export interface CryptoInvoice {
  id: string;
  saleId: string;
  merchantId: string;
  /** On-chain deposit address */
  address: string;
  /** Amount expected in crypto (string to preserve precision) */
  amountCrypto: string;
  /** Crypto currency ticker, e.g. 'ETH', 'BTC', 'USDC' */
  currency: string;
  /** Fiat equivalent at time of invoice creation, in cents */
  amountCents: number;
  status: CryptoInvoiceStatus;
  /** Amount received on-chain (string to preserve precision) */
  paidAmountCrypto?: string;
  /** Transaction hash of the confirming on-chain tx */
  txHash?: string;
  confirmedAt?: string;
  expiresAt: string;
  createdAt: string;
}

export interface Category {
  id: string;
  merchantId: string;
  name: string;
  /** Hex color string, e.g. '#FF5733' */
  color?: string;
  sortOrder: number;
}
