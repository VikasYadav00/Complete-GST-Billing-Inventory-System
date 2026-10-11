import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/httpErrors.js';
import { GstService } from './gst.service.js';
import { StockLedgerService } from './stockLedger.service.js';
import { AuditService } from './audit.service.js';
import { MOVEMENT_TYPES } from '../config/constants.js';

export interface CreateSaleItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number; // optional override if allowed
  discountPercent?: number;
  discountAmount?: number;
}

export interface CreateSaleInput {
  businessId: string;
  customerId?: string | null;
  supplierId?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerStateCode?: string;
  customerGstin?: string;
  items: CreateSaleItemInput[];
  status?: 'DRAFT' | 'FINAL';
  paymentMethod?: string; // CASH, UPI, CARD, BANK_TRANSFER, CREDIT, SPLIT
  paidAmount?: number;
  invoiceDiscountAmount?: number;
  offsetSupplierDues?: boolean;
  saleType?: 'RETAIL' | 'WHOLESALE';
  notes?: string;
  idempotencyKey?: string;
  userId?: string;
  isGstInvoice?: boolean;
}

export class SalesService {
  /**
   * Generate next sequential invoice number for business and current financial year
   */
  public static async getNextInvoiceNumber(
    businessId: string,
    prefix = 'INV-',
    tx: Prisma.TransactionClient = prisma
  ): Promise<string> {
    const currentYear = new Date().getFullYear();

    // Check highest existing invoice number in database for this business and year
    const highestSale = await tx.sale.findFirst({
      where: {
        businessId,
        invoiceNumber: { startsWith: `${prefix}${currentYear}-` },
      },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    let highestExistingNumber = 0;
    if (highestSale?.invoiceNumber) {
      const parts = highestSale.invoiceNumber.split('-');
      const numPart = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(numPart)) {
        highestExistingNumber = numPart;
      }
    }

    const sequence = await tx.invoiceSequence.upsert({
      where: {
        businessId_prefix_year: {
          businessId,
          prefix,
          year: currentYear,
        },
      },
      create: {
        businessId,
        prefix,
        year: currentYear,
        lastNumber: Math.max(1, highestExistingNumber + 1),
      },
      update: {
        lastNumber: { increment: 1 },
      },
    });

    let targetNumber = sequence.lastNumber;
    if (targetNumber <= highestExistingNumber) {
      targetNumber = highestExistingNumber + 1;
      await tx.invoiceSequence.update({
        where: { id: sequence.id },
        data: { lastNumber: targetNumber },
      });
    }

    const paddedNumber = String(targetNumber).padStart(4, '0');
    return `${prefix}${currentYear}-${paddedNumber}`;
  }

  /**
   * Finalize or Draft a Sale atomically with concurrency-safe stock deduction and idempotency
   */
  public static async createSale(input: CreateSaleInput) {
    const {
      businessId,
      items: inputItems,
      status = 'FINAL',
      paymentMethod = 'CASH',
      paidAmount: inputPaidAmount,
      invoiceDiscountAmount = 0,
      notes,
      idempotencyKey,
      userId,
      isGstInvoice = true,
    } = input;

    if (!inputItems || inputItems.length === 0) {
      throw new BadRequestError('Invoice must contain at least one item');
    }

    // 1. Idempotency Check: if key provided, verify if already processed
    if (idempotencyKey) {
      const existingSale = await prisma.sale.findUnique({
        where: { idempotencyKey },
        include: {
          items: true,
          customer: true,
          allocations: { include: { payment: true } },
        },
      });

      if (existingSale) {
        return existingSale;
      }
    }

    // 2. Fetch business, settings, products, and customer
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { settings: true },
    });

    if (!business) {
      throw new NotFoundError('Business not found');
    }

    const productIds = inputItems.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        businessId,
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestError('One or more products not found or belong to another business');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 3. Resolve Customer & Supplier (supports selling to either a customer or a supplier)
    let supplierId = input.supplierId || null;
    let customerId = input.customerId || null;
    let customerStateCode = input.customerStateCode || null;

    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });
      if (!supplier || supplier.businessId !== businessId) {
        throw new NotFoundError('Supplier not found');
      }

      if (!customerId) {
        // Auto-link/create a corresponding customer profile for the supplier
        let matchingCust = await prisma.customer.findFirst({
          where: { businessId, phone: supplier.phone.trim() },
        });
        if (!matchingCust) {
          matchingCust = await prisma.customer.create({
            data: {
              businessId,
              name: supplier.companyName
                ? `${supplier.name} (${supplier.companyName})`
                : supplier.name,
              phone: supplier.phone.trim(),
              state: supplier.state || business.state,
              stateCode: supplier.stateCode || business.stateCode,
              gstin: supplier.gstin ? supplier.gstin.trim().toUpperCase() : null,
              billingAddress: supplier.address || null,
            },
          });
        }
        customerId = matchingCust.id;
        customerStateCode = matchingCust.stateCode;
      } else {
        const cust = await prisma.customer.findUnique({ where: { id: customerId } });
        if (cust) customerStateCode = cust.stateCode;
      }
    } else if (!customerId && input.customerPhone && input.customerName) {
      let existingCust = await prisma.customer.findFirst({
        where: { businessId, phone: input.customerPhone.trim() },
      });

      if (!existingCust) {
        existingCust = await prisma.customer.create({
          data: {
            businessId,
            name: input.customerName.trim(),
            phone: input.customerPhone.trim(),
            stateCode: input.customerStateCode || business.stateCode,
            gstin: input.customerGstin ? input.customerGstin.trim().toUpperCase() : null,
          },
        });
      }
      customerId = existingCust.id;
      customerStateCode = existingCust.stateCode;
    } else if (customerId) {
      const cust = await prisma.customer.findUnique({ where: { id: customerId } });
      if (cust) {
        customerStateCode = cust.stateCode;
      }
    }

    // 4. Prepare items for GST calculation
    const gstInputItems = inputItems.map((item) => {
      const prod = productMap.get(item.productId)!;
      const rate = item.unitPrice ?? Number(prod.sellingPrice);
      return {
        productId: prod.id,
        quantity: item.quantity,
        unitPrice: rate,
        discountPercent: item.discountPercent,
        discountAmount: item.discountAmount,
        gstRate: Number(prod.gstRate),
        hsnCode: prod.hsnCode,
      };
    });

    const gstResult = GstService.calculateInvoiceGst({
      items: gstInputItems,
      businessStateCode: business.stateCode,
      customerStateCode,
      taxPricingMode: business.taxPricingMode as 'EXCLUSIVE' | 'INCLUSIVE',
      isGstRegistered: business.isGstRegistered,
      isGstInvoice,
      invoiceDiscountAmount,
    });

    // 5. Payment details
    const grandTotal = gstResult.grandTotal;
    const isCredit = paymentMethod === 'CREDIT';
    const paidAmount = isCredit
      ? (inputPaidAmount !== undefined && inputPaidAmount > 0 ? Math.min(grandTotal, inputPaidAmount) : 0)
      : inputPaidAmount !== undefined
      ? Math.min(grandTotal, inputPaidAmount)
      : grandTotal;
    const balanceAmount = Math.max(0, GstService.round2(grandTotal - paidAmount));
    const paymentStatus =
      balanceAmount === 0 ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    // Credit sales or sales with an outstanding balance require an identified party
    if (balanceAmount > 0 && !customerId && !supplierId) {
      throw new BadRequestError(
        'A customer or supplier is required for Credit sales or when there is an unpaid balance.'
      );
    }

    const invoicePrefix = business.settings?.invoicePrefix || 'INV-';

    // 6. Execute atomic database transaction
    const finalSale = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.getNextInvoiceNumber(businessId, invoicePrefix, tx);

      // Create Sale record
      const sale = await tx.sale.create({
        data: {
          businessId,
          customerId,
          supplierId,
          invoiceNumber,
          invoiceDate: new Date(),
          status,
          paymentStatus,
          isGstInvoice,
          placeOfSupply: customerStateCode || business.stateCode,
          isInterState: gstResult.isInterState,
          taxPricingMode: business.taxPricingMode,
          subtotal: new Prisma.Decimal(gstResult.subtotal.toFixed(2)),
          discountAmount: new Prisma.Decimal(gstResult.totalDiscount.toFixed(2)),
          taxableAmount: new Prisma.Decimal(gstResult.taxableAmount.toFixed(2)),
          cgstAmount: new Prisma.Decimal(gstResult.cgstAmount.toFixed(2)),
          sgstAmount: new Prisma.Decimal(gstResult.sgstAmount.toFixed(2)),
          igstAmount: new Prisma.Decimal(gstResult.igstAmount.toFixed(2)),
          totalTax: new Prisma.Decimal(gstResult.totalTax.toFixed(2)),
          roundOff: new Prisma.Decimal(gstResult.roundOff.toFixed(2)),
          grandTotal: new Prisma.Decimal(grandTotal.toFixed(2)),
          paidAmount: new Prisma.Decimal(paidAmount.toFixed(2)),
          balanceAmount: new Prisma.Decimal(balanceAmount.toFixed(2)),
          paymentMethod,
          saleType: input.saleType || 'RETAIL',
          idempotencyKey: idempotencyKey || null,
          createdById: userId || null,
          notes: notes || null,
        },
      });

      // Create SaleItems
      for (const itemResult of gstResult.items) {
        const prod = productMap.get(itemResult.productId)!;

        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            hsnCode: prod.hsnCode || null,
            unit: prod.unit,
            quantity: new Prisma.Decimal(itemResult.quantity.toFixed(2)),
            unitPrice: new Prisma.Decimal(itemResult.unitPrice.toFixed(2)),
            costPrice: prod.purchasePrice, // For COGS calculations!
            discountPercent: new Prisma.Decimal(itemResult.discountPercent.toFixed(2)),
            discountAmount: new Prisma.Decimal(itemResult.discountAmount.toFixed(2)),
            taxableAmount: new Prisma.Decimal(itemResult.taxableAmount.toFixed(2)),
            gstRate: new Prisma.Decimal(itemResult.gstRate.toFixed(2)),
            cgstAmount: new Prisma.Decimal(itemResult.cgstAmount.toFixed(2)),
            sgstAmount: new Prisma.Decimal(itemResult.sgstAmount.toFixed(2)),
            igstAmount: new Prisma.Decimal(itemResult.igstAmount.toFixed(2)),
            totalAmount: new Prisma.Decimal(itemResult.totalAmount.toFixed(2)),
          },
        });

        // If Final invoice, deduct stock atomically in ledger
        if (status === 'FINAL') {
          await StockLedgerService.recordMovement({
            businessId,
            productId: prod.id,
            quantityChange: -itemResult.quantity,
            movementType: MOVEMENT_TYPES.SALE,
            referenceType: 'SALE',
            referenceId: sale.id,
            reason: `Invoice #${invoiceNumber}`,
            userId,
            tx,
          });
        }
      }

      // Record Payment if paidAmount > 0
      if (paidAmount > 0) {
        const paymentNumber = `PAY-${Date.now()}`;
        const payment = await tx.payment.create({
          data: {
            businessId,
            paymentNumber,
            paymentType: 'CUSTOMER_PAYMENT',
            customerId,
            amount: new Prisma.Decimal(paidAmount.toFixed(2)),
            paymentDate: new Date(),
            paymentMethod: isCredit ? 'CREDIT' : paymentMethod,
            notes: `Payment for Invoice #${invoiceNumber}`,
            createdById: userId,
          },
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            saleId: sale.id,
            allocatedAmount: new Prisma.Decimal(paidAmount.toFixed(2)),
          },
        });
      }

      // Update customer balance if there is an outstanding balance
      if (customerId && balanceAmount > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            currentBalance: { increment: new Prisma.Decimal(balanceAmount.toFixed(2)) },
          },
        });
      }

      // If selling to a supplier on credit and offsetSupplierDues is enabled:
      // Offset against what we owe the supplier (reducing our payable balance)
      if (supplierId && balanceAmount > 0 && input.offsetSupplierDues) {
        await tx.supplier.update({
          where: { id: supplierId },
          data: {
            currentBalance: { decrement: new Prisma.Decimal(balanceAmount.toFixed(2)) },
          },
        });
      }

      return sale;
    });

    // Record Audit Log
    await AuditService.log({
      businessId,
      userId,
      action: 'CREATE_SALE',
      entity: 'Sale',
      entityId: finalSale.id,
      newValues: {
        invoiceNumber: finalSale.invoiceNumber,
        grandTotal,
        paymentStatus,
        supplierId,
      },
    });

    // Fetch complete created sale
    return prisma.sale.findUnique({
      where: { id: finalSale.id },
      include: {
        items: true,
        customer: true,
        supplier: true,
        allocations: { include: { payment: true } },
      },
    });
  }

  /**
   * Get paginated sales with search and filters
   */
  public static async getSales(
    businessId: string,
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      paymentStatus?: string;
      hasBalance?: boolean | string;
      startDate?: Date;
      endDate?: Date;
      customerId?: string;
      supplierId?: string;
    } = {}
  ) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SaleWhereInput = { businessId };

    if (filters.status) where.status = filters.status;
    if (filters.paymentStatus) {
      if (filters.paymentStatus.includes(',')) {
        where.paymentStatus = { in: filters.paymentStatus.split(',') as any };
      } else {
        where.paymentStatus = filters.paymentStatus;
      }
    }
    if ((filters as any).hasBalance === true || (filters as any).hasBalance === 'true') {
      where.balanceAmount = { gt: 0 };
      if (!where.status) {
        where.status = { not: 'CANCELLED' };
      }
    }
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.supplierId) where.supplierId = filters.supplierId;

    if (filters.search) {
      where.OR = [
        { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
        { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
        { customer: { companyName: { contains: filters.search, mode: 'insensitive' } } },
        { customer: { phone: { contains: filters.search, mode: 'insensitive' } } },
        { supplier: { name: { contains: filters.search, mode: 'insensitive' } } },
        { supplier: { companyName: { contains: filters.search, mode: 'insensitive' } } },
        { supplier: { phone: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    if (filters.startDate || filters.endDate) {
      where.invoiceDate = {};
      if (filters.startDate) where.invoiceDate.gte = filters.startDate;
      if (filters.endDate) where.invoiceDate.lte = filters.endDate;
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              companyName: true,
              customerType: true,
              phone: true,
              gstin: true,
            },
          },
          supplier: {
            select: {
              id: true,
              name: true,
              companyName: true,
              phone: true,
              gstin: true,
            },
          },
          items: true,
        },
      }),
      prisma.sale.count({ where }),
    ]);

    return {
      data: sales,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
