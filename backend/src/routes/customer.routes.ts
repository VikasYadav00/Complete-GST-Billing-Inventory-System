import { Router, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';
import { createCustomerSchema, updateCustomerSchema } from '../validators/schemas.js';
import { AuthenticatedRequest } from '../types/index.js';
import { NotFoundError } from '../utils/httpErrors.js';
import { CustomerService } from '../services/customer.service.js';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('customers', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const businessId = req.businessId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const search = (req.query.search as string)?.trim();
    const type = (req.query.type as string)?.toUpperCase();

    const where: Prisma.CustomerWhereInput = { businessId, isActive: true };
    if (type && (type === 'RETAIL' || type === 'WHOLESALE')) {
      where.customerType = type;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { gstin: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.customer.count({ where }),
    ]);

    res.json({ success: true, data: customers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

router.get('/:id', requirePermission('customers', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer || customer.businessId !== req.businessId) throw new NotFoundError('Customer not found');
    res.json({ success: true, data: customer });
  } catch (err) { next(err); }
});

router.post('/', requirePermission('customers', 'create'), validateBody(createCustomerSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customer = await prisma.customer.create({
      data: { ...req.body, businessId: req.businessId!, gstin: req.body.gstin?.toUpperCase() || null },
    });
    res.status(201).json({ success: true, message: 'Customer added successfully', data: customer });
  } catch (err) { next(err); }
});

router.put('/:id', requirePermission('customers', 'update'), validateBody(updateCustomerSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer || customer.businessId !== req.businessId) throw new NotFoundError('Customer not found');
    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        gstin: req.body.gstin ? req.body.gstin.trim().toUpperCase() : (req.body.gstin === '' ? null : req.body.gstin),
      },
    });
    res.json({ success: true, message: 'Party updated successfully', data: updated });
  } catch (err) { next(err); }
});

router.get('/:id/statement', requirePermission('customers', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const result = await CustomerService.getCustomerStatement(req.businessId!, req.params.id, startDate, endDate);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('customers', 'delete'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer || customer.businessId !== req.businessId) throw new NotFoundError('Party / Customer not found');

    const [salesCount, paymentsCount] = await Promise.all([
      prisma.sale.count({ where: { customerId: req.params.id } }),
      prisma.payment.count({ where: { customerId: req.params.id } }),
    ]);

    if (salesCount === 0 && paymentsCount === 0) {
      await prisma.customer.delete({ where: { id: req.params.id } });
    } else {
      await prisma.customer.update({ where: { id: req.params.id }, data: { isActive: false } });
    }

    res.json({ success: true, message: 'Party deleted successfully' });
  } catch (err) { next(err); }
});

export default router;
