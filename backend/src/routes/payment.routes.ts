import { Router, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';
import { createCustomerPaymentSchema, createSupplierPaymentSchema } from '../validators/schemas.js';
import { PaymentService } from '../services/payment.service.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();
router.use(authenticate);

// Customer payments
router.get('/customer', requirePermission('payments', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { businessId: req.businessId!, paymentType: 'CUSTOMER_PAYMENT' },
        skip, take: limit, orderBy: { paymentDate: 'desc' },
        include: { customer: true, allocations: true },
      }),
      prisma.payment.count({ where: { businessId: req.businessId!, paymentType: 'CUSTOMER_PAYMENT' } }),
    ]);
    res.json({ success: true, data: payments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

router.post('/customer', requirePermission('payments', 'create'), validateBody(createCustomerPaymentSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const payment = await PaymentService.recordCustomerPayment({ ...req.body, businessId: req.businessId!, userId: req.user?.id });
    res.status(201).json({ success: true, message: 'Payment recorded successfully', data: payment });
  } catch (err) { next(err); }
});

// Supplier payments
router.get('/supplier', requirePermission('payments', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { businessId: req.businessId!, paymentType: 'SUPPLIER_PAYMENT' },
        skip, take: limit, orderBy: { paymentDate: 'desc' },
        include: { supplier: true, allocations: true },
      }),
      prisma.payment.count({ where: { businessId: req.businessId!, paymentType: 'SUPPLIER_PAYMENT' } }),
    ]);
    res.json({ success: true, data: payments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

router.post('/supplier', requirePermission('payments', 'create'), validateBody(createSupplierPaymentSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const payment = await PaymentService.recordSupplierPayment({ ...req.body, businessId: req.businessId!, userId: req.user?.id });
    res.status(201).json({ success: true, message: 'Supplier payment recorded', data: payment });
  } catch (err) { next(err); }
});

export default router;
