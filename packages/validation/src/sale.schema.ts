import { z } from 'zod';

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export const CartLineSchema = z.object({
  variantId: z.string().uuid(),
  qty: z.number().int().positive(),
  unitCents: z.number().int().nonnegative(),
  taxBps: z.number().int().nonnegative().default(0),
  discountCents: z.number().int().nonnegative().default(0),
});

export type CartLine = z.infer<typeof CartLineSchema>;

export const CartSchema = z.object({
  lines: z.array(CartLineSchema).min(1),
  sessionId: z.string().uuid(),
  locationId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export type Cart = z.infer<typeof CartSchema>;

// ---------------------------------------------------------------------------
// Complete sale
// ---------------------------------------------------------------------------

export const PaymentMethodEnum = z.enum([
  'CASH',
  'CARD_PRESENT',
  'CARD_NOT_PRESENT',
  'CRYPTO',
  'GIFT_CARD',
]);

export type PaymentMethodEnum = z.infer<typeof PaymentMethodEnum>;

export const CompleteSaleSchema = CartSchema.extend({
  paymentMethod: PaymentMethodEnum,
  cashTenderedCents: z.number().int().optional(),
  stripePaymentIntentId: z.string().optional(),
});

export type CompleteSale = z.infer<typeof CompleteSaleSchema>;

// ---------------------------------------------------------------------------
// Void sale
// ---------------------------------------------------------------------------

export const VoidSaleSchema = z.object({
  saleId: z.string().uuid(),
  reason: z.string().min(3).max(500),
  managerId: z.string().uuid(),
  overrideToken: z.string(),
});

export type VoidSale = z.infer<typeof VoidSaleSchema>;

// ---------------------------------------------------------------------------
// Refund
// ---------------------------------------------------------------------------

export const RefundLineSchema = z.object({
  variantId: z.string().uuid(),
  qty: z.number().int().positive(),
});

export type RefundLine = z.infer<typeof RefundLineSchema>;

export const InitiateRefundSchema = z.object({
  saleId: z.string().uuid(),
  lines: z.array(RefundLineSchema).min(1),
  reason: z.string().min(3).max(500),
});

export type InitiateRefund = z.infer<typeof InitiateRefundSchema>;
