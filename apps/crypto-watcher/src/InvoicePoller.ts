import type { IChainWatcher, TransactionCallback } from './IChainWatcher.js';

const API_BASE = process.env.API_URL ?? 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const POLL_INTERVAL_MS = 30_000;
const MIN_CONFIRMATIONS = 1;

interface PendingInvoice {
  id: string;
  saleId: string;
  merchantId: string;
  address: string;
  amountCrypto: string;
  currency: string;
  amountCents: number;
  status: string;
  expiresAt: string;
}

export class InvoicePoller {
  private watcher: IChainWatcher;
  private watchedAddresses = new Set<string>();
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  constructor(watcher: IChainWatcher) {
    this.watcher = watcher;
  }

  start(): void {
    this.pollHandle = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    // run immediately
    this.poll().catch(console.error);
  }

  stop(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  private async poll(): Promise<void> {
    try {
      const invoices = await this.fetchPendingInvoices();
      for (const invoice of invoices) {
        if (!this.watchedAddresses.has(invoice.address)) {
          this.watchedAddresses.add(invoice.address);
          this.watcher.watchAddress(invoice.address, this.makeCallback(invoice));
        }
        // Expire overdue invoices
        if (new Date(invoice.expiresAt) < new Date()) {
          await this.updateInvoiceStatus(invoice.id, 'EXPIRED');
          this.watcher.unwatchAddress(invoice.address);
          this.watchedAddresses.delete(invoice.address);
        }
      }
    } catch (err) {
      console.error('[InvoicePoller] Poll error:', err);
    }
  }

  private makeCallback(invoice: PendingInvoice): TransactionCallback {
    return async (tx) => {
      if (tx.confirmations < MIN_CONFIRMATIONS) return;

      try {
        await this.confirmInvoice(invoice.id, {
          txHash: tx.txHash,
          paidAmountCrypto: tx.amount,
        });
        this.watcher.unwatchAddress(invoice.address);
        this.watchedAddresses.delete(invoice.address);
      } catch (err) {
        console.error(`[InvoicePoller] Failed to confirm invoice ${invoice.id}:`, err);
      }
    };
  }

  private async fetchPendingInvoices(): Promise<PendingInvoice[]> {
    const res = await fetch(`${API_BASE}/payments/crypto/invoices?status=PENDING`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.invoices ?? [];
  }

  private async updateInvoiceStatus(id: string, status: string): Promise<void> {
    await fetch(`${API_BASE}/payments/crypto/invoices/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify({ status }),
    });
  }

  private async confirmInvoice(id: string, data: { txHash: string; paidAmountCrypto: string }): Promise<void> {
    await fetch(`${API_BASE}/payments/crypto/invoices/${id}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify({ ...data, status: 'CONFIRMED', confirmedAt: new Date().toISOString() }),
    });
  }
}
