import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { ProductController } from '../controllers/product.controller.js';
import { validateBody } from '../middleware/validate.js';
import { createProductSchema, updateProductSchema } from '../validators/schemas.js';
import { StockLedgerService } from '../services/stockLedger.service.js';
import { manualStockAdjustmentSchema } from '../validators/schemas.js';

import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(process.cwd(), 'uploads', 'products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `prod-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext) || allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, webp, gif) are allowed'));
    }
  },
});

const router = Router();

router.use(authenticate);

// Product Image Upload
router.post('/upload-image', requirePermission('products', 'create'), upload.single('image'), ProductController.uploadImage);
router.post('/:id/image', requirePermission('products', 'update'), upload.single('image'), ProductController.uploadImage);

// Product CRUD
router.get('/', requirePermission('products', 'read'), ProductController.list);
router.get('/:id', requirePermission('products', 'read'), ProductController.getById);
router.post('/', requirePermission('products', 'create'), validateBody(createProductSchema), ProductController.create);
router.put('/:id', requirePermission('products', 'update'), validateBody(updateProductSchema), ProductController.update);
router.delete('/:id', requirePermission('products', 'delete'), ProductController.delete);
router.post('/bulk-import', requirePermission('products', 'create'), ProductController.bulkImport);

// Inventory movements for a specific product
router.get('/:id/movements', requirePermission('inventory', 'read'), async (req: any, res, next) => {
  try {
    const result = await StockLedgerService.getMovements(req.businessId!, {
      productId: req.params.id,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// Manual stock adjustment (Owner/Manager only)
router.post('/stock/adjust', requirePermission('inventory', 'manage'), validateBody(manualStockAdjustmentSchema), async (req: any, res, next) => {
  try {
    const { productId, quantityChange, reason, unitCost } = req.body;
    const result = await StockLedgerService.recordMovement({
      businessId: req.businessId!,
      productId,
      quantityChange,
      movementType: 'MANUAL_ADJUSTMENT',
      unitCost,
      reason,
      userId: req.user?.id,
    });
    res.json({ success: true, message: 'Stock adjusted successfully', data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
