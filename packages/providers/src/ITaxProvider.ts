export interface TaxLineItem {
  variantId: string;
  quantity: number;
  unitCents: number;
  categoryCode?: string;
}

export interface TaxCalculation {
  lineItems: Array<{
    variantId: string;
    taxCents: number;
    taxBps: number;
    taxName: string;
  }>;
  totalTaxCents: number;
}

export interface ITaxProvider {
  readonly providerId: string;
  calculateTax(
    merchantId: string,
    locationId: string,
    items: TaxLineItem[]
  ): Promise<TaxCalculation>;
}
