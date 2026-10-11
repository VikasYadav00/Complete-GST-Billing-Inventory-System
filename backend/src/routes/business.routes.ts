import { Router, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';
import { updateBusinessProfileSchema, updateBusinessSettingsSchema, testWhatsAppNotificationSchema } from '../validators/schemas.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { NotFoundError } from '../utils/httpErrors.js';
import { AuditService } from '../services/audit.service.js';
import { ROLES } from '../config/constants.js';

const router = Router();
router.use(authenticate);

// Get business profile
router.get('/profile', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.businessId! },
      include: { settings: true },
    });
    if (!business) throw new NotFoundError('Business not found');
    // Never expose secrets in response
    const safeSettings = business.settings ? { ...business.settings, whatsAppAccessToken: business.settings.whatsAppAccessToken ? '***HIDDEN***' : null, cloudinaryApiSecret: business.settings.cloudinaryApiSecret ? '***HIDDEN***' : null } : null;
    res.json({ success: true, data: { ...business, settings: safeSettings } });
  } catch (err) { next(err); }
});

// Update business profile (Owner only)
router.put('/profile', requireRole(ROLES.OWNER), validateBody(updateBusinessProfileSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const oldBiz = await prisma.business.findUnique({ where: { id: req.businessId! } });
    const updated = await prisma.business.update({ where: { id: req.businessId! }, data: req.body });
    await AuditService.log({ businessId: req.businessId!, userId: req.user?.id, action: 'UPDATE_BUSINESS_PROFILE', entity: 'Business', entityId: req.businessId!, oldValues: oldBiz, newValues: req.body });
    res.json({ success: true, message: 'Business profile updated', data: updated });
  } catch (err) { next(err); }
});

// Update business settings (Owner only)
router.put('/settings', requireRole(ROLES.OWNER), validateBody(updateBusinessSettingsSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await prisma.businessSettings.upsert({
      where: { businessId: req.businessId! },
      create: { ...req.body, businessId: req.businessId! },
      update: req.body,
    });
    res.json({ success: true, message: 'Business settings updated', data: updated });
  } catch (err) { next(err); }
});

// Get staff users list (Owner only)
router.get('/users', requireRole(ROLES.OWNER, ROLES.MANAGER), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { businessId: req.businessId! },
      include: { role: { include: { permissions: true } } },
      orderBy: { name: 'asc' },
    });
    const safe = users.map(({ passwordHash: _, ...u }) => u);
    res.json({ success: true, data: safe });
  } catch (err) { next(err); }
});

// Get roles
router.get('/roles', requireRole(ROLES.OWNER), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.role.findMany({ where: { businessId: req.businessId! }, include: { permissions: true } });
    res.json({ success: true, data: roles });
  } catch (err) { next(err); }
});

// Test WhatsApp notification (Owner only)
router.post('/test-whatsapp', requireRole(ROLES.OWNER), validateBody(testWhatsAppNotificationSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await WhatsAppService.sendTestNotification(req.businessId!, req.body.recipientPhone);
    res.json({ success: result.success, message: result.message, data: result.details });
  } catch (err) { next(err); }
});

// WhatsApp notification job history
router.get('/notifications', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      prisma.notificationJob.findMany({ where: { businessId: req.businessId! }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.notificationJob.count({ where: { businessId: req.businessId! } }),
    ]);
    res.json({ success: true, data: jobs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// In-app notifications
router.get('/in-app-notifications', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const notifs = await prisma.notification.findMany({ where: { businessId: req.businessId! }, take: 20, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: notifs });
  } catch (err) { next(err); }
});

router.put('/in-app-notifications/:id/read', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({ where: { id: req.params.id, businessId: req.businessId! }, data: { isRead: true } });
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) { next(err); }
});

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({ success: true, status: 'OK', timestamp: new Date().toISOString() });
});

export default router;
