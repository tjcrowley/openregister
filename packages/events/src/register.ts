import { buildEnvelope, type EventEnvelope } from "./envelope.js";

// ---------------------------------------------------------------------------
// Event type constants
// ---------------------------------------------------------------------------

export const REGISTER_SESSION_OPENED = "register.session.opened" as const;
export const REGISTER_SESSION_CLOSED = "register.session.closed" as const;
export const CASH_DROP_RECORDED = "register.cash_drop.recorded" as const;
export const MANAGER_OVERRIDE_APPROVED =
  "register.manager_override.approved" as const;
export const SALE_COMPLETED = "sale.completed" as const;
export const SALE_VOIDED = "sale.voided" as const;
export const REFUND_ISSUED = "sale.refund.issued" as const;
export const PAYMENT_CAPTURED = "payment.captured" as const;
export const PAYMENT_FAILED = "payment.failed" as const;
export const PRODUCT_CREATED = "catalog.product.created" as const;
export const PRODUCT_UPDATED = "catalog.product.updated" as const;
export const PRODUCT_ARCHIVED = "catalog.product.archived" as const;
export const VARIANT_CREATED = "catalog.variant.created" as const;
export const VARIANT_UPDATED = "catalog.variant.updated" as const;
export const TAX_RULE_CREATED = "tax.rule.created" as const;
export const TAX_RULE_UPDATED = "tax.rule.updated" as const;
export const MERCHANT_SETTINGS_UPDATED =
  "merchant.settings.updated" as const;

// ---------------------------------------------------------------------------
// Payload interfaces — Register session
// ---------------------------------------------------------------------------

/**
 * Emitted when a cashier opens a register session and declares opening float.
 */
export interface RegisterSessionOpenedPayload {
  sessionId: string;
  locationId: string;
  userId: string;
  /** Cash in the drawer at session open, in the smallest currency unit (cents) */
  openingCashCents: number;
}

/**
 * Emitted when a cashier closes a session. Carries both the counted cash and
 * the system's expected cash so variance can be recorded without further queries.
 */
export interface RegisterSessionClosedPayload {
  sessionId: string;
  locationId: string;
  userId: string;
  /** Physical cash counted at close, in cents */
  countedCashCents: number;
  /** System-calculated expected cash at close, in cents */
  expectedCashCents: number;
  /** countedCashCents - expectedCashCents; negative = short, positive = over */
  varianceCents: number;
}

/**
 * Emitted when excess cash is removed from the drawer mid-session (e.g. to
 * reduce exposure). Does not close the session.
 */
export interface CashDropRecordedPayload {
  sessionId: string;
  /** Amount dropped, in cents (always positive) */
  amountCents: number;
  userId: string;
  notes?: string;
}

/**
 * Emitted when a manager approves a privileged action that requires
 * elevated permissions (e.g. price override, discount approval, void).
 */
export interface ManagerOverrideApprovedPayload {
  sessionId: string;
  /** Manager who approved the action */
  managerId: string;
  /** Identifies which privileged action was approved */
  action: string;
  /** User whose action was overridden / approved, if applicable */
  targetUserId?: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Payload interfaces — Sales
// ---------------------------------------------------------------------------

/**
 * Emitted when a sale transaction is fully tendered and closed.
 * All monetary values are in the smallest currency unit (cents).
 */
export interface SaleCompletedPayload {
  saleId: string;
  /** Human-readable receipt / order number */
  saleNumber: string;
  sessionId: string;
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  /** Primary payment method used, e.g. "cash", "card", "split" */
  paymentMethod: string;
}

/**
 * Emitted when a completed or in-progress sale is voided in full.
 */
export interface SaleVoidedPayload {
  saleId: string;
  saleNumber: string;
  reason: string;
  userId: string;
}

/**
 * Emitted when a refund is issued against a previously completed sale.
 * Supports partial (line-level) refunds via the lines array.
 */
export interface RefundIssuedPayload {
  refundId: string;
  saleId: string;
  /** Total refund amount in cents */
  amountCents: number;
  lines: Array<{
    variantId: string;
    /** Quantity being refunded */
    qty: number;
    /** Amount refunded for this line, in cents */
    amountCents: number;
  }>;
  reason: string;
}

// ---------------------------------------------------------------------------
// Payload interfaces — Payments
// ---------------------------------------------------------------------------

/**
 * Emitted when a payment is successfully captured by the payment processor.
 */
export interface PaymentCapturedPayload {
  paymentId: string;
  saleId: string;
  /** Payment method: "cash" | "card" | "gift_card" | "store_credit" | etc. */
  method: string;
  /** Amount captured, in cents */
  amountCents: number;
}

/**
 * Emitted when a payment attempt is declined or fails due to a processor error.
 */
export interface PaymentFailedPayload {
  saleId: string;
  method: string;
  /** Processor-issued error code for programmatic handling */
  errorCode: string;
  /** Human-readable error message for logging / display */
  errorMessage: string;
}

// ---------------------------------------------------------------------------
// Payload interfaces — Catalog: Products
// ---------------------------------------------------------------------------

/**
 * Emitted when a new product (parent) is created in the catalog.
 * basePrice is stored in the smallest currency unit (cents).
 */
export interface ProductCreatedPayload {
  productId: string;
  name: string;
  /** Base price in cents before variant-level overrides */
  basePrice: number;
  categoryId?: string;
}

/**
 * Emitted when one or more product fields are updated.
 * The changes map contains only the fields that changed (patch semantics).
 */
export interface ProductUpdatedPayload {
  productId: string;
  changes: Record<string, unknown>;
}

/**
 * Emitted when a product is soft-deleted / hidden from the catalog.
 */
export interface ProductArchivedPayload {
  productId: string;
}

// ---------------------------------------------------------------------------
// Payload interfaces — Catalog: Variants
// ---------------------------------------------------------------------------

/**
 * Emitted when a new variant (child of a product) is created.
 * price is in the smallest currency unit (cents).
 */
export interface VariantCreatedPayload {
  variantId: string;
  productId: string;
  sku: string;
  /** Variant-level sell price in cents */
  price: number;
}

/**
 * Emitted when one or more variant fields are updated (patch semantics).
 */
export interface VariantUpdatedPayload {
  variantId: string;
  changes: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Payload interfaces — Tax
// ---------------------------------------------------------------------------

/**
 * Emitted when a new tax rule is created.
 * rateBps is the tax rate in basis points (1 bps = 0.01%), e.g. 1000 = 10%.
 */
export interface TaxRuleCreatedPayload {
  taxRuleId: string;
  name: string;
  /** Tax rate expressed in basis points to avoid floating-point rounding */
  rateBps: number;
}

/**
 * Emitted when a tax rule's fields are updated (patch semantics).
 */
export interface TaxRuleUpdatedPayload {
  taxRuleId: string;
  changes: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Payload interfaces — Merchant settings
// ---------------------------------------------------------------------------

/**
 * Emitted when any merchant-level settings are changed (patch semantics).
 */
export interface MerchantSettingsUpdatedPayload {
  changes: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Factory functions — Register session
// ---------------------------------------------------------------------------

export function registerSessionOpened(
  merchantId: string,
  deviceId: string,
  payload: RegisterSessionOpenedPayload
): EventEnvelope<RegisterSessionOpenedPayload> {
  return buildEnvelope(
    REGISTER_SESSION_OPENED,
    merchantId,
    deviceId,
    payload
  );
}

export function registerSessionClosed(
  merchantId: string,
  deviceId: string,
  payload: RegisterSessionClosedPayload
): EventEnvelope<RegisterSessionClosedPayload> {
  return buildEnvelope(
    REGISTER_SESSION_CLOSED,
    merchantId,
    deviceId,
    payload
  );
}

export function cashDropRecorded(
  merchantId: string,
  deviceId: string,
  payload: CashDropRecordedPayload
): EventEnvelope<CashDropRecordedPayload> {
  return buildEnvelope(CASH_DROP_RECORDED, merchantId, deviceId, payload);
}

export function managerOverrideApproved(
  merchantId: string,
  deviceId: string,
  payload: ManagerOverrideApprovedPayload
): EventEnvelope<ManagerOverrideApprovedPayload> {
  return buildEnvelope(
    MANAGER_OVERRIDE_APPROVED,
    merchantId,
    deviceId,
    payload
  );
}

// ---------------------------------------------------------------------------
// Factory functions — Sales
// ---------------------------------------------------------------------------

export function saleCompleted(
  merchantId: string,
  deviceId: string,
  payload: SaleCompletedPayload
): EventEnvelope<SaleCompletedPayload> {
  return buildEnvelope(SALE_COMPLETED, merchantId, deviceId, payload);
}

export function saleVoided(
  merchantId: string,
  deviceId: string,
  payload: SaleVoidedPayload
): EventEnvelope<SaleVoidedPayload> {
  return buildEnvelope(SALE_VOIDED, merchantId, deviceId, payload);
}

export function refundIssued(
  merchantId: string,
  deviceId: string,
  payload: RefundIssuedPayload
): EventEnvelope<RefundIssuedPayload> {
  return buildEnvelope(REFUND_ISSUED, merchantId, deviceId, payload);
}

// ---------------------------------------------------------------------------
// Factory functions — Payments
// ---------------------------------------------------------------------------

export function paymentCaptured(
  merchantId: string,
  deviceId: string,
  payload: PaymentCapturedPayload
): EventEnvelope<PaymentCapturedPayload> {
  return buildEnvelope(PAYMENT_CAPTURED, merchantId, deviceId, payload);
}

export function paymentFailed(
  merchantId: string,
  deviceId: string,
  payload: PaymentFailedPayload
): EventEnvelope<PaymentFailedPayload> {
  return buildEnvelope(PAYMENT_FAILED, merchantId, deviceId, payload);
}

// ---------------------------------------------------------------------------
// Factory functions — Catalog: Products
// ---------------------------------------------------------------------------

export function productCreated(
  merchantId: string,
  deviceId: string,
  payload: ProductCreatedPayload
): EventEnvelope<ProductCreatedPayload> {
  return buildEnvelope(PRODUCT_CREATED, merchantId, deviceId, payload);
}

export function productUpdated(
  merchantId: string,
  deviceId: string,
  payload: ProductUpdatedPayload
): EventEnvelope<ProductUpdatedPayload> {
  return buildEnvelope(PRODUCT_UPDATED, merchantId, deviceId, payload);
}

export function productArchived(
  merchantId: string,
  deviceId: string,
  payload: ProductArchivedPayload
): EventEnvelope<ProductArchivedPayload> {
  return buildEnvelope(PRODUCT_ARCHIVED, merchantId, deviceId, payload);
}

// ---------------------------------------------------------------------------
// Factory functions — Catalog: Variants
// ---------------------------------------------------------------------------

export function variantCreated(
  merchantId: string,
  deviceId: string,
  payload: VariantCreatedPayload
): EventEnvelope<VariantCreatedPayload> {
  return buildEnvelope(VARIANT_CREATED, merchantId, deviceId, payload);
}

export function variantUpdated(
  merchantId: string,
  deviceId: string,
  payload: VariantUpdatedPayload
): EventEnvelope<VariantUpdatedPayload> {
  return buildEnvelope(VARIANT_UPDATED, merchantId, deviceId, payload);
}

// ---------------------------------------------------------------------------
// Factory functions — Tax
// ---------------------------------------------------------------------------

export function taxRuleCreated(
  merchantId: string,
  deviceId: string,
  payload: TaxRuleCreatedPayload
): EventEnvelope<TaxRuleCreatedPayload> {
  return buildEnvelope(TAX_RULE_CREATED, merchantId, deviceId, payload);
}

export function taxRuleUpdated(
  merchantId: string,
  deviceId: string,
  payload: TaxRuleUpdatedPayload
): EventEnvelope<TaxRuleUpdatedPayload> {
  return buildEnvelope(TAX_RULE_UPDATED, merchantId, deviceId, payload);
}

// ---------------------------------------------------------------------------
// Factory functions — Merchant settings
// ---------------------------------------------------------------------------

export function merchantSettingsUpdated(
  merchantId: string,
  deviceId: string,
  payload: MerchantSettingsUpdatedPayload
): EventEnvelope<MerchantSettingsUpdatedPayload> {
  return buildEnvelope(
    MERCHANT_SETTINGS_UPDATED,
    merchantId,
    deviceId,
    payload
  );
}
