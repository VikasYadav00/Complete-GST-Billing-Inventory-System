import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/httpErrors.js';
import { AuditService } from './audit.service.js';

export interface CreateExpenseInput {
  businessId: string;
  categoryId?: string | null;
  amount: number;
  title?: string | null;
  expenseDate?: Date;
  paymentMethod?: string;
  reference?: string | null;
  notes?: string | null;
  receiptUrl?: string | null;
  userId?: string | null;
}

export class ExpenseService {
  /**
   * Record a Business Expense
   */
  public static async createExpense(input: CreateExpenseInput) {
    const {
      businessId,
      categoryId,
      amount,
      title,
      expenseDate = new Date(),
      paymentMethod = 'CASH',
      reference,
      notes,
      receiptUrl,
      userId,
    } = input;

    if (amount <= 0) {
      throw new BadRequestError('Expense amount must be greater than zero');
    }

    let resolvedCategoryId = categoryId;
    if (!resolvedCategoryId) {
      let defaultCat = await prisma.expenseCategory.findFirst({
        where: { businessId, name: { in: ['Miscellaneous', 'General', 'General Expenses'] } },
      });
      if (!defaultCat) {
        defaultCat = await prisma.expenseCategory.findFirst({
          where: { businessId },
        });
      }
      if (!defaultCat) {
        defaultCat = await prisma.expenseCategory.create({
          data: { businessId, name: 'Miscellaneous' },
        });
      }
      resolvedCategoryId = defaultCat.id;
    }

    const category = await prisma.expenseCategory.findUnique({
      where: { id: resolvedCategoryId },
    });

    if (!category || category.businessId !== businessId) {
      throw new NotFoundError('Expense category not found');
    }

    const finalReference = reference || title || null;

    const expense = await prisma.expense.create({
      data: {
        businessId,
        categoryId: resolvedCategoryId,
        amount: new Prisma.Decimal(amount.toFixed(2)),
        expenseDate,
        paymentMethod,
        reference: finalReference,
        notes: notes || null,
        receiptUrl: receiptUrl || null,
        recordedBy: userId || null,
      },
      include: {
        category: true,
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: 'RECORD_EXPENSE',
      entity: 'Expense',
      entityId: expense.id,
      newValues: { category: category.name, amount, paymentMethod },
    });

    return expense;
  }

  /**
   * Get Expenses with filtering and pagination
   */
  public static async getExpenses(
    businessId: string,
    filters: {
      page?: number;
      limit?: number;
      categoryId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = { businessId };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.startDate || filters.endDate) {
      where.expenseDate = {};
      if (filters.startDate) where.expenseDate.gte = filters.startDate;
      if (filters.endDate) where.expenseDate.lte = filters.endDate;
    }

    const [expenses, total, sumResult] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expenseDate: 'desc' },
        include: { category: true },
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const mappedExpenses = expenses.map((e) => ({
      ...e,
      title: e.reference || e.notes || e.category?.name || 'Expense',
    }));

    return {
      data: mappedExpenses,
      totalAmount: Number(sumResult._sum.amount || 0),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
