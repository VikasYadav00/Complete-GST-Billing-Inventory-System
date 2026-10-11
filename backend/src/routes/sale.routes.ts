import { Router, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';
import { createSaleSchema } from '../validators/schemas.js';
import { SalesService } from '../services/sales.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { NotFoundError } from '../utils/httpErrors.js';

const router = Router();
router.use(authenticate);

// List sales
router.get('/', requirePermission('sales', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SalesService.getSales(req.businessId!, {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      search: req.query.search as string,
      status: req.query.status as string,
      paymentStatus: req.query.paymentStatus as string,
      hasBalance: req.query.hasBalance as string,
      customerId: req.query.customerId as string,
      supplierId: req.query.supplierId as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// Get single sale
router.get('/:id', requirePermission('sales', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: { customer: true, supplier: true, items: true, allocations: { include: { payment: true } } },
    });
    if (!sale || sale.businessId !== req.businessId) throw new NotFoundError('Sale not found');
    res.json({ success: true, data: sale });
  } catch (err) { next(err); }
});

// Create sale / POS checkout
router.post('/', requirePermission('sales', 'create'), validateBody(createSaleSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sale = await SalesService.createSale({ ...req.body, businessId: req.businessId!, userId: req.user?.id });
    res.status(201).json({ success: true, message: 'Invoice created successfully', data: sale });
  } catch (err) { next(err); }
});

// Cancel a FINAL sale (Owner/Manager)
router.post('/:id/cancel', requirePermission('sales', 'manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sale = await prisma.sale.findUnique({ where: { id: req.params.id } });
    if (!sale || sale.businessId !== req.businessId) throw new NotFoundError('Sale not found');
    if (sale.status === 'CANCELLED') {
      return res.json({ success: false, message: 'Sale is already cancelled' });
    }
    await prisma.sale.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
    res.json({ success: true, message: 'Sale cancelled successfully' });
  } catch (err) { next(err); }
});

// GST calculation preview (no invoice created)
router.post('/calculate-gst', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { GstService } = await import('../services/gst.service.js');
    const business = await prisma.business.findUnique({ where: { id: req.businessId! } });
    if (!business) throw new NotFoundError('Business not found');

    const result = GstService.calculateInvoiceGst({
      items: req.body.items,
      businessStateCode: business.stateCode,
      customerStateCode: req.body.customerStateCode,
      taxPricingMode: business.taxPricingMode as 'EXCLUSIVE' | 'INCLUSIVE',
      isGstRegistered: business.isGstRegistered,
      isGstInvoice: req.body.isGstInvoice !== false,
      invoiceDiscountAmount: req.body.invoiceDiscountAmount || 0,
    });

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

export default router;
