import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/httpErrors.js';
import { AuditService } from './audit.service.js';

export interface RecordCustomerPaymentInput {
  businessId: string;
  customerId: string;
  amount: number;
  paymentMethod: string;
  transactionReference?: string;
  notes?: string;
  userId?: string;
  specificSaleId?: string;
}

export interface RecordSupplierPaymentInput {
  businessId: string;
  supplierId: string;
  amount: number;
  paymentMethod: string;
  transactionReference?: string;
  notes?: string;
  userId?: string;
  specificPurchaseId?: string;
}

export class PaymentService {
  /**
   * Record Customer Payment with invoice allocation
   */
  public static async recordCustomerPayment(input: RecordCustomerPaymentInput) {
    const {
      businessId,
      customerId,
      amount,
      paymentMethod,
      transactionReference,
      notes,
      userId,
      specificSaleId,
    } = input;

    if (amount <= 0) {
      throw new BadRequestError('Payment amount must be greater than zero');
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer || customer.businessId !== businessId) {
      throw new NotFoundError('Customer not found');
    }

    const paymentNumber = `PAY-${Date.now()}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payment record
      const payment = await tx.payment.create({
        data: {
          businessId,
          customerId,
          paymentNumber,
          paymentType: 'CUSTOMER_PAYMENT',
          amount: new Prisma.Decimal(amount.toFixed(2)),
          paymentDate: new Date(),
          paymentMethod,
          transactionReference: transactionReference || null,
          notes: notes || null,
          createdById: userId || null,
        },
      });

      // 2. Reduce Customer Outstanding Balance
      await tx.customer.update({
        where: { id: customerId },
        data: {
          currentBalance: { decrement: new Prisma.Decimal(amount.toFixed(2)) },
        },
      });

      // 3. Allocate Payment to Invoices
      let remainingToAllocate = amount;

      if (specificSaleId) {
        const sale = await tx.sale.findUnique({ where: { id: specificSaleId } });
        if (sale && sale.businessId === businessId) {
          const unpaidSaleBalance = Number(sale.balanceAmount);
          const allocated = Math.min(remainingToAllocate, unpaidSaleBalance);

          if (allocated > 0) {
            await tx.paymentAllocation.create({
              data: {
                paymentId: payment.id,
                saleId: sale.id,
                allocatedAmount: new Prisma.Decimal(allocated.toFixed(2)),
              },
            });

            const newPaid = Number(sale.paidAmount) + allocated;
            const newBalance = Math.max(0, Number(sale.grandTotal) - newPaid);
            const newStatus = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';

            await tx.sale.update({
              where: { id: sale.id },
              data: {
                customerId: sale.customerId || customerId,
                paidAmount: new Prisma.Decimal(newPaid.toFixed(2)),
                balanceAmount: new Prisma.Decimal(newBalance.toFixed(2)),
                paymentStatus: newStatus,
              },
            });

            remainingToAllocate -= allocated;
          }
        }
      }

      // If amount still remains, allocate to oldest unpaid sales (FIFO)
      if (remainingToAllocate > 0) {
        const unpaidSales = await tx.sale.findMany({
          where: {
            businessId,
            customerId,
            balanceAmount: { gt: 0 },
            status: { not: 'CANCELLED' },
          },
          orderBy: { invoiceDate: 'asc' },
        });

        for (const sale of unpaidSales) {
          if (remainingToAllocate <= 0) break;

          const unpaidSaleBalance = Number(sale.balanceAmount);
          const allocated = Math.min(remainingToAllocate, unpaidSaleBalance);

          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              saleId: sale.id,
              allocatedAmount: new Prisma.Decimal(allocated.toFixed(2)),
            },
          });

          const newPaid = Number(sale.paidAmount) + allocated;
          const newBalance = Math.max(0, Number(sale.grandTotal) - newPaid);
          const newStatus = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';

          await tx.sale.update({
            where: { id: sale.id },
            data: {
              paidAmount: new Prisma.Decimal(newPaid.toFixed(2)),
              balanceAmount: new Prisma.Decimal(newBalance.toFixed(2)),
              paymentStatus: newStatus,
            },
          });

          remainingToAllocate -= allocated;
        }
      }

      return payment;
    });

    await AuditService.log({
      businessId,
      userId,
      action: 'RECORD_PAYMENT',
      entity: 'Payment',
      entityId: result.id,
      newValues: { paymentNumber, amount, customerId },
    });

    return result;
  }

  /**
   * Record Supplier Payment with purchase allocation
   */
  public static async recordSupplierPayment(input: RecordSupplierPaymentInput) {
    const {
      businessId,
      supplierId,
      amount,
      paymentMethod,
      transactionReference,
      notes,
      userId,
      specificPurchaseId,
    } = input;

    if (amount <= 0) {
      throw new BadRequestError('Payment amount must be greater than zero');
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier || supplier.businessId !== businessId) {
      throw new NotFoundError('Supplier not found');
    }

    const paymentNumber = `SUP-PAY-${Date.now()}`;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          businessId,
          supplierId,
          paymentNumber,
          paymentType: 'SUPPLIER_PAYMENT',
          amount: new Prisma.Decimal(amount.toFixed(2)),
          paymentDate: new Date(),
          paymentMethod,
          transactionReference: transactionReference || null,
          notes: notes || null,
          createdById: userId || null,
        },
      });

      // Reduce Supplier Liability
      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          currentBalance: { decrement: new Prisma.Decimal(amount.toFixed(2)) },
        },
      });

      // Allocate to specific or FIFO purchases
      let remaining = amount;
      if (specificPurchaseId) {
        const purchase = await tx.purchase.findUnique({ where: { id: specificPurchaseId } });
        if (purchase && purchase.businessId === businessId) {
          const unp = Number(purchase.balanceAmount);
          const alloc = Math.min(remaining, unp);
          if (alloc > 0) {
            await tx.paymentAllocation.create({
              data: {
                paymentId: payment.id,
                purchaseId: purchase.id,
                allocatedAmount: new Prisma.Decimal(alloc.toFixed(2)),
              },
            });
            const newPaid = Number(purchase.paidAmount) + alloc;
            const newBal = Math.max(0, Number(purchase.totalAmount) - newPaid);
            await tx.purchase.update({
              where: { id: purchase.id },
              data: {
                paidAmount: new Prisma.Decimal(newPaid.toFixed(2)),
                balanceAmount: new Prisma.Decimal(newBal.toFixed(2)),
                paymentStatus: newBal === 0 ? 'PAID' : 'PARTIALLY_PAID',
              },
            });
            remaining -= alloc;
          }
        }
      }

      if (remaining > 0) {
        const unpaidPurchases = await tx.purchase.findMany({
          where: { businessId, supplierId, balanceAmount: { gt: 0 } },
          orderBy: { purchaseDate: 'asc' },
        });

        for (const p of unpaidPurchases) {
          if (remaining <= 0) break;
          const unp = Number(p.balanceAmount);
          const alloc = Math.min(remaining, unp);
          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              purchaseId: p.id,
              allocatedAmount: new Prisma.Decimal(alloc.toFixed(2)),
            },
          });
          const newPaid = Number(p.paidAmount) + alloc;
          const newBal = Math.max(0, Number(p.totalAmount) - newPaid);
          await tx.purchase.update({
            where: { id: p.id },
            data: {
              paidAmount: new Prisma.Decimal(newPaid.toFixed(2)),
              balanceAmount: new Prisma.Decimal(newBal.toFixed(2)),
              paymentStatus: newBal === 0 ? 'PAID' : 'PARTIALLY_PAID',
            },
          });
          remaining -= alloc;
        }
      }

      return payment;
    });

    await AuditService.log({
      businessId,
      userId,
      action: 'RECORD_SUPPLIER_PAYMENT',
      entity: 'Payment',
      entityId: result.id,
      newValues: { paymentNumber, amount, supplierId },
    });

    return result;
  }
}
