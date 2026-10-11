import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';
import { createExpenseSchema, createExpenseCategorySchema } from '../validators/schemas.js';
import { ExpenseService } from '../services/expense.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/httpErrors.js';

const router = Router();
router.use(authenticate);

// Expense Categories
router.get('/categories', requirePermission('expenses', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.expenseCategory.findMany({ where: { businessId: req.businessId! }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: categories });
  } catch (err) { next(err); }
});

router.post('/categories', requirePermission('expenses', 'manage'), validateBody(createExpenseCategorySchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cat = await prisma.expenseCategory.create({ data: { ...req.body, businessId: req.businessId! } });
    res.status(201).json({ success: true, data: cat });
  } catch (err) { next(err); }
});

// Expenses
router.get('/', requirePermission('expenses', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await ExpenseService.getExpenses(req.businessId!, {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      categoryId: req.query.categoryId as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.post('/', requirePermission('expenses', 'create'), validateBody(createExpenseSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rawDate = req.body.expenseDate;
    const parsedDate = rawDate && !isNaN(Date.parse(rawDate)) ? new Date(rawDate) : new Date();
    const expense = await ExpenseService.createExpense({
      ...req.body,
      businessId: req.businessId!,
      userId: req.user?.id,
      expenseDate: parsedDate,
    });
    res.status(201).json({ success: true, message: 'Expense recorded', data: expense });
  } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('expenses', 'manage'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense || expense.businessId !== req.businessId) throw new NotFoundError('Expense not found');
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Expense deleted' });
  } catch (err) { next(err); }
});

export default router;
