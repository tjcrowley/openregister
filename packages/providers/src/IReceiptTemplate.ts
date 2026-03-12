export interface ReceiptLineItem {
  name: string;
  qty: number;
  unitCents: number;
  taxCents: number;
  lineTotalCents: number;
}

export interface ReceiptData {
  merchantName: string;
  locationAddress?: string;
  saleNumber: string;
  completedAt: string;
  lines: ReceiptLineItem[];
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  paymentMethod: string;
  cashTenderedCents?: number;
  changeCents?: number;
  footerText?: string;
}

export interface IReceiptTemplate {
  readonly templateId: string;
  /** Returns an ESC/POS command string or an HTML string ready for rendering. */
  render(data: ReceiptData): string;
  /** Optionally returns an ESC/POS or HTML fragment containing a QR code. */
  renderQRCode?(data: ReceiptData): string;
}
