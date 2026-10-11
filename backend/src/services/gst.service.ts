export interface GstCalculationItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  gstRate: number; // 0, 5, 12, 18, 28
  hsnCode?: string | null;
}

export interface GstCalculationItemResult {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  totalAmount: number;
}

export interface GstTaxBreakupItem {
  gstRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
}

export interface GstCalculationResult {
  items: GstCalculationItemResult[];
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  rawTotal: number;
  roundOff: number;
  grandTotal: number;
  isInterState: boolean;
  taxBreakup: GstTaxBreakupItem[];
}

export interface CalculateGstParams {
  items: GstCalculationItemInput[];
  businessStateCode: string; // e.g. "07"
  customerStateCode?: string | null; // e.g. "07" or "27"
  taxPricingMode?: 'EXCLUSIVE' | 'INCLUSIVE';
  isGstRegistered?: boolean;
  isGstInvoice?: boolean;
  invoiceDiscountAmount?: number;
}

export class GstService {
  /**
   * Rounds a number to exactly two decimal places using standard half-up rounding
   */
  public static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Determine whether a transaction is Inter-State or Intra-State
   */
  public static isInterStateTransaction(
    businessStateCode: string,
    customerStateCode?: string | null
  ): boolean {
    if (!customerStateCode || !customerStateCode.trim()) {
      // By default, if customer state is unspecified, treated as local intra-state
      return false;
    }
    const cleanBiz = businessStateCode.trim().padStart(2, '0');
    const cleanCust = customerStateCode.trim().padStart(2, '0');
    return cleanBiz !== cleanCust;
  }

  /**
   * Calculate GST, taxable amounts, and tax breakups for invoice items
   */
  public static calculateInvoiceGst(params: CalculateGstParams): GstCalculationResult {
    const {
      items,
      businessStateCode,
      customerStateCode,
      taxPricingMode = 'EXCLUSIVE',
      isGstRegistered = true,
      isGstInvoice = true,
      invoiceDiscountAmount = 0,
    } = params;

    // When isGstInvoice is true, GST calculation is applicable (preserving rates chosen at checkout)
    const isGstApplicable = Boolean(isGstInvoice);
    const isInterState = isGstApplicable
      ? this.isInterStateTransaction(businessStateCode, customerStateCode)
      : false;

    let subtotal = 0;
    let totalDiscount = 0;
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const taxBreakupMap = new Map<number, GstTaxBreakupItem>();

    const calculatedItems: GstCalculationItemResult[] = items.map((item) => {
      const qty = item.quantity;
      const rate = item.unitPrice;
      const gross = this.round2(qty * rate);
      subtotal += gross;

      // Item discount calculation
      let itemDiscount = 0;
      if (item.discountAmount && item.discountAmount > 0) {
        itemDiscount = this.round2(item.discountAmount);
      } else if (item.discountPercent && item.discountPercent > 0) {
        itemDiscount = this.round2((gross * item.discountPercent) / 100);
      }
      totalDiscount += itemDiscount;
      const lineNet = Math.max(0, this.round2(gross - itemDiscount));

      const effectiveGstRate = isGstApplicable ? item.gstRate : 0;

      let taxable = 0;
      let cgst = 0;
      let sgst = 0;
      let igst = 0;
      let totalTax = 0;
      let lineTotal = 0;

      if (!isGstApplicable || effectiveGstRate === 0) {
        taxable = lineNet;
        cgst = 0;
        sgst = 0;
        igst = 0;
        totalTax = 0;
        lineTotal = lineNet;
      } else if (taxPricingMode === 'INCLUSIVE') {
        // Price includes tax: Taxable = Gross / (1 + Rate / 100)
        taxable = this.round2((lineNet * 100) / (100 + effectiveGstRate));
        totalTax = this.round2(lineNet - taxable);

        if (isInterState) {
          igst = totalTax;
          cgst = 0;
          sgst = 0;
        } else {
          cgst = this.round2(totalTax / 2);
          sgst = this.round2(totalTax - cgst);
          igst = 0;
        }
        lineTotal = lineNet;
      } else {
        // Tax-Exclusive: Tax added on top of price
        taxable = lineNet;
        if (isInterState) {
          igst = this.round2((taxable * effectiveGstRate) / 100);
          cgst = 0;
          sgst = 0;
          totalTax = igst;
        } else {
          const halfRate = effectiveGstRate / 2;
          cgst = this.round2((taxable * halfRate) / 100);
          sgst = this.round2((taxable * halfRate) / 100);
          igst = 0;
          totalTax = this.round2(cgst + sgst);
        }
        lineTotal = this.round2(taxable + totalTax);
      }

      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      // Group into Tax Breakup
      const existingBreakup = taxBreakupMap.get(effectiveGstRate) || {
        gstRate: effectiveGstRate,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTax: 0,
      };

      existingBreakup.taxableAmount = this.round2(existingBreakup.taxableAmount + taxable);
      existingBreakup.cgstAmount = this.round2(existingBreakup.cgstAmount + cgst);
      existingBreakup.sgstAmount = this.round2(existingBreakup.sgstAmount + sgst);
      existingBreakup.igstAmount = this.round2(existingBreakup.igstAmount + igst);
      existingBreakup.totalTax = this.round2(existingBreakup.totalTax + totalTax);
      taxBreakupMap.set(effectiveGstRate, existingBreakup);

      return {
        productId: item.productId,
        quantity: qty,
        unitPrice: rate,
        discountPercent: item.discountPercent || 0,
        discountAmount: itemDiscount,
        taxableAmount: taxable,
        gstRate: effectiveGstRate,
        cgstRate: isInterState ? 0 : effectiveGstRate / 2,
        sgstRate: isInterState ? 0 : effectiveGstRate / 2,
        igstRate: isInterState ? effectiveGstRate : 0,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalTax,
        totalAmount: lineTotal,
      };
    });

    // Handle optional overall invoice discount
    if (invoiceDiscountAmount > 0) {
      totalDiscount += invoiceDiscountAmount;
    }

    const calculatedTotalTax = this.round2(totalCgst + totalSgst + totalIgst);
    const rawTotal = this.round2(
      taxPricingMode === 'INCLUSIVE'
        ? subtotal - totalDiscount
        : totalTaxable + calculatedTotalTax - (invoiceDiscountAmount || 0)
    );

    // Round off to nearest integer (Standard practice in Indian GST invoicing)
    const grandTotal = Math.round(rawTotal);
    const roundOff = this.round2(grandTotal - rawTotal);

    return {
      items: calculatedItems,
      subtotal: this.round2(subtotal),
      totalDiscount: this.round2(totalDiscount),
      taxableAmount: this.round2(totalTaxable),
      cgstAmount: this.round2(totalCgst),
      sgstAmount: this.round2(totalSgst),
      igstAmount: this.round2(totalIgst),
      totalTax: calculatedTotalTax,
      rawTotal,
      roundOff,
      grandTotal,
      isInterState,
      taxBreakup: Array.from(taxBreakupMap.values()).sort((a, b) => a.gstRate - b.gstRate),
    };
  }

  /**
   * Validate Indian 15-character GSTIN format
   */
  public static isValidGstin(gstin?: string | null): boolean {
    if (!gstin) return false;
    const cleanGstin = gstin.trim().toUpperCase();
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(cleanGstin);
  }
}
