import { buildEnvelope, type EventEnvelope } from "./envelope.js";

// ---------------------------------------------------------------------------
// Event type constants
// ---------------------------------------------------------------------------

export const INVENTORY_ADJUSTED = "inventory.adjusted" as const;
export const INVENTORY_COUNTED = "inventory.counted" as const;
export const INVENTORY_TRANSFERRED = "inventory.transferred" as const;
export const INVENTORY_RESERVED = "inventory.reserved" as const;
export const INVENTORY_RELEASED = "inventory.released" as const;

// ---------------------------------------------------------------------------
// Payload interfaces
// ---------------------------------------------------------------------------

/**
 * Emitted when stock is added or removed outside of a sale (receiving a PO,
 * writing off damaged goods, manual correction, etc.).
 */
export interface InventoryAdjustedPayload {
  variantId: string;
  locationId: string;
  /** Positive = stock received, negative = stock removed */
  quantityDelta: number;
  /** Human-readable reason code or free-text description */
  reason: string;
  /** Optional PO, transfer, or adjustment document id */
  referenceId?: string;
}

/**
 * Emitted when a physical stock count is recorded. Carries both the counted
 * value and the system's prior known quantity so downstream projections can
 * compute the implied shrinkage/surplus without querying current state.
 */
export interface InventoryCountedPayload {
  variantId: string;
  locationId: string;
  countedQuantity: number;
  previousQuantity: number;
  /** User who performed the count */
  userId: string;
}

/**
 * Emitted when stock moves between two locations (e.g. warehouse → floor,
 * store-to-store transfer).
 */
export interface InventoryTransferredPayload {
  variantId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  /** User who initiated the transfer */
  userId: string;
}

/**
 * Emitted when stock is soft-reserved for an in-progress sale to prevent
 * overselling before the transaction finalises.
 */
export interface InventoryReservedPayload {
  variantId: string;
  locationId: string;
  quantity: number;
  /** The sale that holds this reservation */
  saleId: string;
}

/**
 * Emitted when a reservation is released — either because the sale completed
 * and stock was formally decremented, or because the sale was abandoned.
 */
export interface InventoryReleasedPayload {
  variantId: string;
  locationId: string;
  quantity: number;
  /** The sale whose reservation is being released */
  saleId: string;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Creates an inventory.adjusted envelope for a manual stock adjustment.
 */
export function inventoryAdjusted(
  merchantId: string,
  deviceId: string,
  payload: InventoryAdjustedPayload
): EventEnvelope<InventoryAdjustedPayload> {
  return buildEnvelope(INVENTORY_ADJUSTED, merchantId, deviceId, payload);
}

/**
 * Creates an inventory.counted envelope for a physical stock count.
 */
export function inventoryCounted(
  merchantId: string,
  deviceId: string,
  payload: InventoryCountedPayload
): EventEnvelope<InventoryCountedPayload> {
  return buildEnvelope(INVENTORY_COUNTED, merchantId, deviceId, payload);
}

/**
 * Creates an inventory.transferred envelope for a stock transfer between locations.
 */
export function inventoryTransferred(
  merchantId: string,
  deviceId: string,
  payload: InventoryTransferredPayload
): EventEnvelope<InventoryTransferredPayload> {
  return buildEnvelope(INVENTORY_TRANSFERRED, merchantId, deviceId, payload);
}

/**
 * Creates an inventory.reserved envelope when stock is soft-reserved for a sale.
 */
export function inventoryReserved(
  merchantId: string,
  deviceId: string,
  payload: InventoryReservedPayload
): EventEnvelope<InventoryReservedPayload> {
  return buildEnvelope(INVENTORY_RESERVED, merchantId, deviceId, payload);
}

/**
 * Creates an inventory.released envelope when a soft-reservation is lifted.
 */
export function inventoryReleased(
  merchantId: string,
  deviceId: string,
  payload: InventoryReleasedPayload
): EventEnvelope<InventoryReleasedPayload> {
  return buildEnvelope(INVENTORY_RELEASED, merchantId, deviceId, payload);
}
