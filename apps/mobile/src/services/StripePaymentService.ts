import { confirmPayment, createPaymentMethod } from '@stripe/stripe-react-native';

interface CreateIntentResult {
  clientSecret: string;
  paymentIntentId: string;
}

interface PaymentResult {
  success: boolean;
  error?: string;
  paymentIntentId?: string;
}

const API_BASE = process.env.API_URL ?? 'http://localhost:3000';

export async function createPaymentIntent(
  amountCents: number,
  currency: string,
  saleId: string,
  deviceToken: string
): Promise<CreateIntentResult> {
  const response = await fetch(`${API_BASE}/payments/intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deviceToken}`,
    },
    body: JSON.stringify({ saleId, amountCents, currency }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message ?? 'Failed to create payment intent');
  }

  return response.json();
}

export async function collectPayment(clientSecret: string): Promise<PaymentResult> {
  const { error, paymentIntent } = await confirmPayment(clientSecret, {
    paymentMethodType: 'Card',
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    paymentIntentId: paymentIntent?.id,
  };
}

export async function processPayment(
  paymentIntentId: string,
  saleId: string,
  deviceToken: string
): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/payments/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deviceToken}`,
    },
    body: JSON.stringify({ paymentIntentId, saleId }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message ?? 'Failed to process payment');
  }

  return response.json();
}
