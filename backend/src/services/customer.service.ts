import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/httpErrors.js';
import { AuditService } from './audit.service.js';

export interface LedgerEntry {
  date: Date;
  type: 'INVOICE' | 'PAYMENT';
  referenceNumber: string;
  debit: number; // Invoices increase customer dues
  credit: number; // Payments reduce customer dues
  runningBalance: number;
  paymentMethod?: string | null;
  notes?: string | null;
}

export class CustomerService {
  /**
   * Get Customer Ledger Statement with Running Balance
   */
  public static async getCustomerStatement(
    businessId: string,
    customerId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer || customer.businessId !== businessId) {
      throw new NotFoundError('Customer not found');
    }

    const [sales, payments] = await Promise.all([
      prisma.sale.findMany({
        where: {
          businessId,
          customerId,
          status: { not: 'CANCELLED' },
          ...(startDate || endDate
            ? {
                invoiceDate: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
        },
        orderBy: { invoiceDate: 'asc' },
      }),
      prisma.payment.findMany({
        where: {
          businessId,
          customerId,
          paymentType: 'CUSTOMER_PAYMENT',
          ...(startDate || endDate
            ? {
                paymentDate: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
        },
        orderBy: { paymentDate: 'asc' },
      }),
    ]);

    // Merge transactions into chronological ledger

    const merged: {
      date: Date;
      type: 'INVOICE' | 'PAYMENT';
      referenceNumber: string;
      debit: number;
      credit: number;
      paymentMethod?: string | null;
      notes?: string | null;
    }[] = [];

    for (const s of sales) {
      merged.push({
        date: s.invoiceDate,
        type: 'INVOICE',
        referenceNumber: s.invoiceNumber,
        debit: Number(s.grandTotal),
        credit: 0,
        paymentMethod: s.paymentMethod,
        notes: s.notes,
      });
    }

    for (const p of payments) {
      merged.push({
        date: p.paymentDate,
        type: 'PAYMENT',
        referenceNumber: p.paymentNumber,
        debit: 0,
        credit: Number(p.amount),
        paymentMethod: p.paymentMethod,
        notes: p.notes,
      });
    }

    merged.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = 0;
    const ledger: LedgerEntry[] = [];

    for (const item of merged) {
      runningBalance += item.debit - item.credit;
      ledger.push({
        ...item,
        runningBalance: Math.round(runningBalance * 100) / 100,
      });
    }

    return {
      customer,
      currentBalance: Number(customer.currentBalance),
      statement: ledger,
      totalBilled: ledger.reduce((acc, curr) => acc + curr.debit, 0),
      totalPaid: ledger.reduce((acc, curr) => acc + curr.credit, 0),
    };
  }
}
