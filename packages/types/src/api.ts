import type { CryptoInvoice, Sale } from './entities.js';

// ---------------------------------------------------------------------------
// Device authentication
// ---------------------------------------------------------------------------

/** Request body for POST /auth/device */
export interface DeviceAuthRequest {
  deviceId: string;
  merchantId: string;
  locationId: string;
  deviceSecret: string;
}

/** Response body for POST /auth/device */
export interface DeviceAuthResponse {
  token: string;
  /** ISO-8601 UTC expiry timestamp */
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Stripe payment intents
// ---------------------------------------------------------------------------

/** Request body for POST /payments/intent */
export interface CreatePaymentIntentRequest {
  saleId: string;
  /** Amount to charge in cents */
  amountCents: number;
  /** ISO-4217 currency code, e.g. 'usd' */
  currency: string;
}

/** Response body for POST /payments/intent */
export interface CreatePaymentIntentResponse {
  /** Stripe client secret used to confirm the payment on the terminal/client */
  clientSecret: string;
  paymentIntentId: string;
}

/** Request body for POST /payments/process */
export interface ProcessPaymentRequest {
  paymentIntentId: string;
  saleId: string;
}

/** Response body for POST /payments/process */
export interface ProcessPaymentResponse {
  /** Stripe PaymentIntent status string */
  status: string;
  /** Updated sale record if payment completed and sale was finalised */
  sale?: Sale;
}

// ---------------------------------------------------------------------------
// Crypto invoices
// ---------------------------------------------------------------------------

/** Request body for POST /crypto/invoices */
export interface CryptoInvoiceRequest {
  saleId: string;
  /** Amount to collect in cents */
  amountCents: number;
  currency: 'ETH' | 'BTC' | 'USDC';
}

/** Response body for POST /crypto/invoices */
export interface CryptoInvoiceResponse {
  invoice: CryptoInvoice;
}

/** Response body for GET /crypto/invoices/:id/status */
export interface CryptoInvoiceStatusResponse {
  invoice: CryptoInvoice;
  /** Remaining amount still owed, in cents. Present when invoice is PARTIAL. */
  remainingCents?: number;
}

// ---------------------------------------------------------------------------
// Shared utility types
// ---------------------------------------------------------------------------

/** Generic wrapper for paginated list endpoints */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Standard error shape returned by all API endpoints on failure.
 * `code` is a machine-readable constant (e.g. 'PAYMENT_FAILED'),
 * `message` is human-readable, and `details` carries optional structured data.
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
