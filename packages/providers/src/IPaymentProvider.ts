export interface PaymentIntentResult {
  intentId: string;
  clientSecret?: string;
  status: 'requires_payment_method' | 'requires_capture' | 'succeeded' | 'failed';
}

export interface CaptureResult {
  status: 'succeeded' | 'failed';
  chargeId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface RefundResult {
  refundId: string;
  status: 'succeeded' | 'failed';
  amountCents: number;
}

export interface IPaymentProvider {
  readonly providerId: string;
  createPaymentIntent(saleId: string, amountCents: number, currency: string): Promise<PaymentIntentResult>;
  capturePayment(intentId: string): Promise<CaptureResult>;
  cancelPayment(intentId: string): Promise<void>;
  createRefund(chargeId: string, amountCents: number, reason: string): Promise<RefundResult>;
}
