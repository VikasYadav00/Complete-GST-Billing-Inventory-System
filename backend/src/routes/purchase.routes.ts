import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';
import { createSupplierSchema, updateSupplierSchema, createPurchaseSchema } from '../validators/schemas.js';
import { PurchaseService } from '../services/purchase.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { NotFoundError } from '../utils/httpErrors.js';
import { AuditService } from '../services/audit.service.js';

const router = Router();
router.use(authenticate);

// ---- SUPPLIERS ----
router.get('/suppliers', requirePermission('suppliers', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const search = (req.query.search as string)?.trim();

    const where: Prisma.SupplierWhereInput = { businessId, isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { gstin: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({ where, skip, take: limit, orderBy: { name: 'asc' }, include: { _count: { select: { purchases: true } } } }),
      prisma.supplier.count({ where }),
    ]);

    res.json({ success: true, data: suppliers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

router.post('/suppliers', requirePermission('suppliers', 'create'), validateBody(createSupplierSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const supplier = await prisma.supplier.create({
      data: { ...req.body, businessId: req.businessId!, gstin: req.body.gstin?.toUpperCase() || null },
    });
    res.status(201).json({ success: true, message: 'Supplier created', data: supplier });
  } catch (err) { next(err); }
});

router.get('/suppliers/:id', requirePermission('suppliers', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: {
        purchases: {
          take: 20,
          orderBy: { purchaseDate: 'desc' },
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true, unit: true } },
              },
            },
          },
        },
      },
    });
    if (!supplier || supplier.businessId !== req.businessId) throw new NotFoundError('Supplier not found');
    res.json({ success: true, data: supplier });
  } catch (err) { next(err); }
});

router.get('/suppliers/:id/statement', requirePermission('suppliers', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId!;
    const supplierId = req.params.id;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier || supplier.businessId !== businessId) {
      throw new NotFoundError('Supplier not found');
    }

    const [purchases, payments] = await Promise.all([
      prisma.purchase.findMany({
        where: {
          businessId,
          supplierId,
          status: { not: 'CANCELLED' },
          ...(startDate || endDate
            ? {
                purchaseDate: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
        },
        orderBy: { purchaseDate: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, unit: true },
              },
            },
          },
        },
      }),
      prisma.payment.findMany({
        where: {
          businessId,
          supplierId,
          paymentType: 'SUPPLIER_PAYMENT',
          ...(startDate || endDate
            ? {
                paymentDate: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              }
            : {}),
        },
        orderBy: { paymentDate: 'desc' },
      }),
    ]);

    let totalPurchased = 0;
    for (const p of purchases) {
      totalPurchased += Number(p.totalAmount);
    }

    let totalPaid = 0;
    for (const pay of payments) {
      totalPaid += Number(pay.amount);
    }

    const chronologicalPurchases = [...purchases].reverse();
    const chronologicalPayments = [...payments].reverse();

    const transactions: {
      date: Date;
      type: 'PURCHASE' | 'PAYMENT';
      referenceNumber: string;
      supplierInvoiceNumber?: string | null;
      debit: number;
      credit: number;
      paymentMethod?: string | null;
      notes?: string | null;
      itemsCount?: number;
      purchaseId?: string;
    }[] = [];

    for (const p of chronologicalPurchases) {
      transactions.push({
        date: p.purchaseDate,
        type: 'PURCHASE',
        referenceNumber: p.purchaseNumber,
        supplierInvoiceNumber: p.supplierInvoiceNumber,
        debit: 0,
        credit: Number(p.totalAmount),
        paymentMethod: p.taxPricingMode,
        notes: p.notes,
        itemsCount: p.items.length,
        purchaseId: p.id,
      });
    }

    for (const pay of chronologicalPayments) {
      transactions.push({
        date: pay.paymentDate,
        type: 'PAYMENT',
        referenceNumber: pay.paymentNumber,
        debit: Number(pay.amount),
        credit: 0,
        paymentMethod: pay.paymentMethod,
        notes: pay.notes,
      });
    }

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const statement = transactions.map((t) => {
      runningBalance += t.credit - t.debit;
      return {
        ...t,
        runningBalance,
      };
    }).reverse();

    res.json({
      success: true,
      data: {
        supplier,
        purchases,
        payments,
        statement,
        summary: {
          totalPurchased,
          totalPaid,
          currentBalance: Number(supplier.currentBalance),
          totalPurchasesCount: purchases.length,
          totalPaymentsCount: payments.length,
        },
      },
    });
  } catch (err) { next(err); }
});

router.put('/suppliers/:id', requirePermission('suppliers', 'update'), validateBody(updateSupplierSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!supplier || supplier.businessId !== req.businessId) throw new NotFoundError('Supplier not found');
    const updated = await prisma.supplier.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, message: 'Supplier updated', data: updated });
  } catch (err) { next(err); }
});

router.delete('/suppliers/:id', requirePermission('suppliers', 'delete'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!supplier || supplier.businessId !== req.businessId) throw new NotFoundError('Supplier not found');

    const [purchasesCount, paymentsCount, salesCount] = await Promise.all([
      prisma.purchase.count({ where: { supplierId: req.params.id } }),
      prisma.payment.count({ where: { supplierId: req.params.id } }),
      prisma.sale.count({ where: { supplierId: req.params.id } }),
    ]);

    if (purchasesCount === 0 && paymentsCount === 0 && salesCount === 0) {
      await prisma.supplier.delete({ where: { id: req.params.id } });
    } else {
      await prisma.supplier.update({ where: { id: req.params.id }, data: { isActive: false } });
    }

    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (err) { next(err); }
});

// ---- PURCHASES ----
router.get('/purchases', requirePermission('purchases', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseWhereInput = { businessId };
    if (req.query.supplierId) where.supplierId = req.query.supplierId as string;
    if (req.query.status) where.status = req.query.status as string;
    if (req.query.paymentStatus) {
      const statuses = (req.query.paymentStatus as string).split(',').map((s) => s.trim());
      if (statuses.length > 1) {
        where.paymentStatus = { in: statuses };
      } else {
        where.paymentStatus = statuses[0];
      }
    }
    if (req.query.hasBalance === 'true') {
      where.balanceAmount = { gt: 0 };
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({ where, skip, take: limit, orderBy: { purchaseDate: 'desc' }, include: { supplier: true, items: { include: { product: true } } } }),
      prisma.purchase.count({ where }),
    ]);

    res.json({ success: true, data: purchases, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

router.get('/purchases/:id', requirePermission('purchases', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const purchase = await prisma.purchase.findUnique({ where: { id: req.params.id }, include: { supplier: true, items: { include: { product: true } }, allocations: { include: { payment: true } } } });
    if (!purchase || purchase.businessId !== req.businessId) throw new NotFoundError('Purchase not found');
    res.json({ success: true, data: purchase });
  } catch (err) { next(err); }
});

router.post('/purchases', requirePermission('purchases', 'create'), validateBody(createPurchaseSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await PurchaseService.createPurchase({ ...req.body, businessId: req.businessId!, userId: req.user?.id });
    res.status(201).json({ success: true, message: 'Purchase recorded successfully', data: result });
  } catch (err) { next(err); }
});

export default router;
