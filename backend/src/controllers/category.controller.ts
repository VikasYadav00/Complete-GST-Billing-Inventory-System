import { Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { NotFoundError } from '../utils/httpErrors.js';
import { AuditService } from '../services/audit.service.js';

export class CategoryController {
  public static async list(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const businessId = req.businessId!;
      const categories = await prisma.category.findMany({
        where: { businessId, isActive: true },
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { products: true } },
          children: true,
        },
      });

      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async create(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const businessId = req.businessId!;
      const { name, description, parentId } = req.body;

      const category = await prisma.category.create({
        data: {
          businessId,
          name: name.trim(),
          description: description?.trim() || null,
          parentId: parentId || null,
        },
      });

      await AuditService.log({
        businessId,
        userId: req.user?.id,
        action: 'CREATE_CATEGORY',
        entity: 'Category',
        entityId: category.id,
        newValues: { name: category.name },
      });

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async update(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const businessId = req.businessId!;
      const { name, description, parentId } = req.body;

      const category = await prisma.category.findUnique({ where: { id } });
      if (!category || category.businessId !== businessId) {
        throw new NotFoundError('Category not found');
      }

      const updated = await prisma.category.update({
        where: { id },
        data: {
          name: name ? name.trim() : undefined,
          description: description !== undefined ? description?.trim() || null : undefined,
          parentId: parentId !== undefined ? parentId : undefined,
        },
      });

      res.json({
        success: true,
        message: 'Category updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async delete(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const businessId = req.businessId!;

      const category = await prisma.category.findUnique({ where: { id } });
      if (!category || category.businessId !== businessId) {
        throw new NotFoundError('Category not found');
      }

      await prisma.category.update({
        where: { id },
        data: { isActive: false },
      });

      res.json({
        success: true,
        message: 'Category deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
