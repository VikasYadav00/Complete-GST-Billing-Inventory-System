import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { CategoryController } from '../controllers/category.controller.js';
import { validateBody } from '../middleware/validate.js';
import { createCategorySchema, updateCategorySchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('categories', 'read'), CategoryController.list);
router.post('/', requirePermission('categories', 'create'), validateBody(createCategorySchema), CategoryController.create);
router.put('/:id', requirePermission('categories', 'update'), validateBody(updateCategorySchema), CategoryController.update);
router.delete('/:id', requirePermission('categories', 'delete'), CategoryController.delete);

export default router;
