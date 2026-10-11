import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/httpErrors.js';
import { StockLedgerService } from './stockLedger.service.js';
import { AuditService } from './audit.service.js';
import { MOVEMENT_TYPES } from '../config/constants.js';

export interface CreatePurchaseItemInput {
  productId: string;
  orderedQuantity?: number;
  quantity?: number;
  receivedQuantity?: number; // stock only increases for receivedQuantity!
  unitCost: number;
  discountPercent?: number;
  discountAmount?: number;
  gstRate: number;
  batchNumber?: string;
  expiryDate?: Date | string;
}

export interface CreatePurchaseInput {
  businessId: string;
  supplierId: string;
  supplierInvoiceNumber?: string;
  invoiceNumber?: string;
  purchaseDate?: Date | string;
  expectedDate?: Date | string;
  items: CreatePurchaseItemInput[];
  additionalCharges?: number;
  paidAmount?: number;
  paymentMethod?: string;
  notes?: string;
  userId?: string;
}

export class PurchaseService {
  /**
   * Create Purchase order / invoice and receive inventory if receivedQuantity > 0
   */
  public static async createPurchase(input: CreatePurchaseInput) {
    const {
      businessId,
      supplierId,
      supplierInvoiceNumber,
      invoiceNumber,
      purchaseDate,
      expectedDate,
      items: inputItems,
      additionalCharges = 0,
      paidAmount: inputPaidAmount = 0,
      paymentMethod = 'BANK_TRANSFER',
      notes,
      userId,
    } = input;

    const effectiveInvoiceNumber = supplierInvoiceNumber || invoiceNumber || null;
    const effectivePurchaseDate = purchaseDate ? new Date(purchaseDate) : new Date();
    const effectiveExpectedDate = expectedDate ? new Date(expectedDate) : null;

    if (!inputItems || inputItems.length === 0) {
      throw new BadRequestError('Purchase must contain at least one item');
    }

    const [business, supplier] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
        include: { settings: true },
      }),
      prisma.supplier.findUnique({
        where: { id: supplierId },
      }),
    ]);

    if (!business) throw new NotFoundError('Business not found');
    if (!supplier || supplier.businessId !== businessId) {
      throw new NotFoundError('Supplier not found in business');
    }

    const currentYear = new Date().getFullYear();
    const purchasePrefix = business.settings?.purchasePrefix || 'PO-';

    // Calculate totals and items
    let subtotal = 0;
    let totalDiscount = 0;
    let taxableAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const isInterState =
      supplier.stateCode && business.stateCode
        ? supplier.stateCode.trim() !== business.stateCode.trim()
        : false;

    const processedItems = inputItems.map((item) => {
      const orderedQuantity = item.orderedQuantity ?? item.quantity ?? 1;
      const receivedQuantity = item.receivedQuantity !== undefined ? item.receivedQuantity : orderedQuantity;
      const normalizedItem = {
        ...item,
        orderedQuantity,
        receivedQuantity,
      };

      const gross = orderedQuantity * item.unitCost;
      subtotal += gross;

      let discount = item.discountAmount || 0;
      if (!discount && item.discountPercent) {
        discount = (gross * item.discountPercent) / 100;
      }
      totalDiscount += discount;

      const taxable = Math.max(0, gross - discount);
      taxableAmount += taxable;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isInterState) {
        igst = (taxable * item.gstRate) / 100;
      } else {
        cgst = (taxable * (item.gstRate / 2)) / 100;
        sgst = (taxable * (item.gstRate / 2)) / 100;
      }

      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      const totalItemAmount = taxable + cgst + sgst + igst;

      return {
        ...normalizedItem,
        taxableAmount: taxable,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalAmount: totalItemAmount,
      };
    });

    const totalTax = totalCgst + totalSgst + totalIgst;
    const rawTotal = taxableAmount + totalTax + additionalCharges;
    const totalAmount = Math.round(rawTotal);
    const roundOff = totalAmount - rawTotal;

    const paidAmount = Math.min(totalAmount, inputPaidAmount);
    const balanceAmount = Math.max(0, totalAmount - paidAmount);
    const paymentStatus =
      balanceAmount === 0 ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    // Status: RECEIVED if all items received, PARTIALLY_RECEIVED if some, else ORDERED
    let totalOrdered = 0;
    let totalReceived = 0;
    for (const it of processedItems) {
      totalOrdered += it.orderedQuantity;
      totalReceived += it.receivedQuantity || 0;
    }
    const status =
      totalReceived >= totalOrdered
        ? 'RECEIVED'
        : totalReceived > 0
        ? 'PARTIALLY_RECEIVED'
        : 'ORDERED';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate purchase sequence safely
      const existingPurchaseWithSeq = await tx.purchase.findFirst({
        where: {
          businessId,
          purchaseNumber: { startsWith: `${purchasePrefix}${currentYear}-` },
        },
        orderBy: { purchaseNumber: 'desc' },
      });

      let currentMax = 0;
      if (existingPurchaseWithSeq) {
        const parts = existingPurchaseWithSeq.purchaseNumber.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num)) currentMax = num;
      }

      const existingSeq = await tx.invoiceSequence.findUnique({
        where: {
          businessId_prefix_year: {
            businessId,
            prefix: purchasePrefix,
            year: currentYear,
          },
        },
      });

      const nextNumber = Math.max(currentMax, existingSeq ? existingSeq.lastNumber : 0) + 1;

      await tx.invoiceSequence.upsert({
        where: {
          businessId_prefix_year: {
            businessId,
            prefix: purchasePrefix,
            year: currentYear,
          },
        },
        create: {
          businessId,
          prefix: purchasePrefix,
          year: currentYear,
          lastNumber: nextNumber,
        },
        update: {
          lastNumber: nextNumber,
        },
      });

      const purchaseNumber = `${purchasePrefix}${currentYear}-${String(nextNumber).padStart(4, '0')}`;

      // 2. Create Purchase
      const purchase = await tx.purchase.create({
        data: {
          businessId,
          supplierId,
          purchaseNumber,
          supplierInvoiceNumber: effectiveInvoiceNumber,
          purchaseDate: effectivePurchaseDate,
          expectedDate: effectiveExpectedDate,
          status,
          paymentStatus,
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          discountAmount: new Prisma.Decimal(totalDiscount.toFixed(2)),
          taxableAmount: new Prisma.Decimal(taxableAmount.toFixed(2)),
          cgstAmount: new Prisma.Decimal(totalCgst.toFixed(2)),
          sgstAmount: new Prisma.Decimal(totalSgst.toFixed(2)),
          igstAmount: new Prisma.Decimal(totalIgst.toFixed(2)),
          totalTax: new Prisma.Decimal(totalTax.toFixed(2)),
          additionalCharges: new Prisma.Decimal(additionalCharges.toFixed(2)),
          roundOff: new Prisma.Decimal(roundOff.toFixed(2)),
          totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
          paidAmount: new Prisma.Decimal(paidAmount.toFixed(2)),
          balanceAmount: new Prisma.Decimal(balanceAmount.toFixed(2)),
          notes: notes || null,
        },
      });

      // 3. Create items and adjust inventory ONLY for quantities received!
      for (const item of processedItems) {
        await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            productId: item.productId,
            orderedQuantity: new Prisma.Decimal(item.orderedQuantity.toFixed(2)),
            receivedQuantity: new Prisma.Decimal((item.receivedQuantity || 0).toFixed(2)),
            unitCost: new Prisma.Decimal(item.unitCost.toFixed(2)),
            discountPercent: new Prisma.Decimal((item.discountPercent || 0).toFixed(2)),
            discountAmount: new Prisma.Decimal((item.discountAmount || 0).toFixed(2)),
            gstRate: new Prisma.Decimal(item.gstRate.toFixed(2)),
            taxableAmount: new Prisma.Decimal(item.taxableAmount.toFixed(2)),
            cgstAmount: new Prisma.Decimal(item.cgstAmount.toFixed(2)),
            sgstAmount: new Prisma.Decimal(item.sgstAmount.toFixed(2)),
            igstAmount: new Prisma.Decimal(item.igstAmount.toFixed(2)),
            totalAmount: new Prisma.Decimal(item.totalAmount.toFixed(2)),
            batchNumber: item.batchNumber || null,
            expiryDate: item.expiryDate || null,
          },
        });

        // If received quantity > 0, increase stock in ledger
        if (item.receivedQuantity && item.receivedQuantity > 0) {
          await StockLedgerService.recordMovement({
            businessId,
            productId: item.productId,
            quantityChange: item.receivedQuantity,
            movementType: MOVEMENT_TYPES.PURCHASE_RECEIVED,
            unitCost: item.unitCost,
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            reason: `Purchase Received #${purchaseNumber}`,
            userId,
            tx,
          });
        }
      }

      // 4. Update supplier liability balance
      if (balanceAmount > 0) {
        await tx.supplier.update({
          where: { id: supplierId },
          data: {
            currentBalance: { increment: new Prisma.Decimal(balanceAmount.toFixed(2)) },
          },
        });
      }

      // 5. Record payment if paidAmount > 0
      if (paidAmount > 0) {
        const payment = await tx.payment.create({
          data: {
            businessId,
            paymentNumber: `SUP-PAY-${Date.now()}`,
            paymentType: 'SUPPLIER_PAYMENT',
            supplierId,
            amount: new Prisma.Decimal(paidAmount.toFixed(2)),
            paymentDate: new Date(),
            paymentMethod,
            notes: `Payment for Purchase #${purchaseNumber}`,
            createdById: userId,
          },
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            purchaseId: purchase.id,
            allocatedAmount: new Prisma.Decimal(paidAmount.toFixed(2)),
          },
        });
      }

      return purchase;
    });

    await AuditService.log({
      businessId,
      userId,
      action: 'CREATE_PURCHASE',
      entity: 'Purchase',
      entityId: result.id,
      newValues: { purchaseNumber: result.purchaseNumber, totalAmount },
    });

    return prisma.purchase.findUnique({
      where: { id: result.id },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    });
  }
}
