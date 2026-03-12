import Stripe from 'stripe';
import { prisma } from '../db/client.js';
import { logger } from './logger.js';

const stripeClients = new Map<string, Stripe>();

export async function getStripeForMerchant(merchantId: string): Promise<Stripe> {
  if (stripeClients.has(merchantId)) {
    return stripeClients.get(merchantId)!;
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { stripeSecretKey: true },
  });

  if (!merchant?.stripeSecretKey) {
    throw new Error(`No Stripe credentials configured for merchant ${merchantId}`);
  }

  const client = new Stripe(merchant.stripeSecretKey, {
    apiVersion: '2024-06-20',
    typescript: true,
  });

  stripeClients.set(merchantId, client);
  logger.debug({ merchantId }, 'Created Stripe client for merchant');
  return client;
}

export function clearStripeClientCache(merchantId?: string): void {
  if (merchantId) {
    stripeClients.delete(merchantId);
  } else {
    stripeClients.clear();
  }
}
