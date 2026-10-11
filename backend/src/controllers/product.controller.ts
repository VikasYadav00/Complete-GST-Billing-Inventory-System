import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { BadRequestError, NotFoundError } from '../utils/httpErrors.js';
import { StockLedgerService } from '../services/stockLedger.service.js';
import { AuditService } from '../services/audit.service.js';
import { MOVEMENT_TYPES } from '../config/constants.js';

export class ProductController {
  public static async list(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const businessId = req.businessId!;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const search = (req.query.search as string)?.trim();
      const categoryId = req.query.categoryId as string;
      const isArchived = req.query.archived === 'true';
      const lowStockOnly = req.query.lowStock === 'true';

      const where: Prisma.ProductWhereInput = {
        businessId,
        isArchived,
      };

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { hsnCode: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            category: true,
            images: true,
            stockBalance: true,
          },
        }),
        prisma.product.count({ where }),
      ]);

      // If lowStockOnly requested, filter in memory or via threshold
      const filtered = lowStockOnly
        ? products.filter((p) => Number(p.currentStock) <= p.lowStockThreshold)
        : products;

      res.json({
        success: true,
        data: filtered,
        pagination: {
          page,
          limit,
          total: lowStockOnly ? filtered.length : total,
          totalPages: Math.ceil((lowStockOnly ? filtered.length : total) / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          images: true,
          stockBalance: true,
          inventoryMovements: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!product || product.businessId !== req.businessId) {
        throw new NotFoundError('Product not found');
      }

      res.json({
        success: true,
        data: product,
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
      const data = req.body;

      // Check unique SKU within business
      const existingSku = await prisma.product.findUnique({
        where: {
          businessId_sku: {
            businessId,
            sku: data.sku.trim(),
          },
        },
      });

      if (existingSku) {
        throw new BadRequestError(`Product with SKU '${data.sku}' already exists in your store`);
      }

      const openingStock = data.openingStock || 0;

      const product = await prisma.$transaction(async (tx) => {
        const prod = await tx.product.create({
          data: {
            businessId,
            name: data.name.trim(),
            sku: data.sku.trim(),
            barcode: data.barcode?.trim() || null,
            description: data.description?.trim() || null,
            brand: data.brand?.trim() || null,
            categoryId: data.categoryId || null,
            unit: data.unit || 'PCS',
            purchasePrice: new Prisma.Decimal(data.purchasePrice.toFixed(2)),
            sellingPrice: new Prisma.Decimal((data.sellingPrice != null ? data.sellingPrice : (data.purchasePrice != null ? data.purchasePrice : 0)).toFixed(2)),
            wholesalePrice: data.wholesalePrice != null ? new Prisma.Decimal(data.wholesalePrice.toFixed(2)) : null,
            mrp: data.mrp ? new Prisma.Decimal(data.mrp.toFixed(2)) : null,
            gstRate: new Prisma.Decimal(data.gstRate.toFixed(2)),
            hsnCode: data.hsnCode?.trim() || null,
            lowStockThreshold: data.lowStockThreshold || 10,
            openingStock: new Prisma.Decimal(openingStock.toFixed(2)),
            currentStock: new Prisma.Decimal(openingStock.toFixed(2)),
            batchNumber: data.batchNumber?.trim() || null,
            expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
            primaryImageUrl: data.primaryImageUrl || null,
          },
          include: { category: true },
        });

        // Initialize StockBalance
        await tx.stockBalance.create({
          data: {
            businessId,
            productId: prod.id,
            quantity: new Prisma.Decimal(openingStock.toFixed(2)),
            weightedAvgCost: new Prisma.Decimal(data.purchasePrice.toFixed(2)),
            lastRestockedAt: openingStock > 0 ? new Date() : null,
          },
        });

        // If opening stock > 0, record in ledger
        if (openingStock > 0) {
          await tx.inventoryMovement.create({
            data: {
              businessId,
              productId: prod.id,
              movementType: MOVEMENT_TYPES.OPENING_STOCK,
              quantityChange: new Prisma.Decimal(openingStock.toFixed(2)),
              previousStock: new Prisma.Decimal('0.00'),
              resultingStock: new Prisma.Decimal(openingStock.toFixed(2)),
              unitCost: new Prisma.Decimal(data.purchasePrice.toFixed(2)),
              reason: 'Initial Opening Stock',
              userId: req.user?.id,
            },
          });
        }

        return prod;
      });

      await AuditService.log({
        businessId,
        userId: req.user?.id,
        action: 'CREATE_PRODUCT',
        entity: 'Product',
        entityId: product.id,
        newValues: { name: product.name, sku: product.sku },
      });

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product,
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
      const data = req.body;

      const product = await prisma.product.findUnique({
        where: { id },
      });

      if (!product || product.businessId !== businessId) {
        throw new NotFoundError('Product not found');
      }

      // Check SKU collision if SKU changed
      if (data.sku && data.sku.trim() !== product.sku) {
        const existing = await prisma.product.findUnique({
          where: {
            businessId_sku: {
              businessId,
              sku: data.sku.trim(),
            },
          },
        });
        if (existing) {
          throw new BadRequestError(`Product with SKU '${data.sku}' already exists`);
        }
      }

      const updated = await prisma.product.update({
        where: { id },
        data: {
          name: data.name !== undefined ? data.name.trim() : undefined,
          sku: data.sku !== undefined ? data.sku.trim() : undefined,
          barcode: data.barcode !== undefined ? data.barcode?.trim() || null : undefined,
          description: data.description !== undefined ? data.description?.trim() || null : undefined,
          brand: data.brand !== undefined ? data.brand?.trim() || null : undefined,
          categoryId: data.categoryId !== undefined ? data.categoryId : undefined,
          unit: data.unit !== undefined ? data.unit : undefined,
          purchasePrice:
            data.purchasePrice !== undefined
              ? new Prisma.Decimal(data.purchasePrice.toFixed(2))
              : undefined,
          sellingPrice:
            data.sellingPrice !== undefined
              ? data.sellingPrice != null
                ? new Prisma.Decimal(data.sellingPrice.toFixed(2))
                : new Prisma.Decimal('0.00')
              : undefined,
          wholesalePrice:
            data.wholesalePrice !== undefined
              ? data.wholesalePrice != null
                ? new Prisma.Decimal(data.wholesalePrice.toFixed(2))
                : null
              : undefined,
          mrp:
            data.mrp !== undefined
              ? data.mrp
                ? new Prisma.Decimal(data.mrp.toFixed(2))
                : null
              : undefined,
          gstRate:
            data.gstRate !== undefined ? new Prisma.Decimal(data.gstRate.toFixed(2)) : undefined,
          hsnCode: data.hsnCode !== undefined ? data.hsnCode?.trim() || null : undefined,
          lowStockThreshold: data.lowStockThreshold !== undefined ? data.lowStockThreshold : undefined,
          batchNumber:
            data.batchNumber !== undefined ? data.batchNumber?.trim() || null : undefined,
          expiryDate:
            data.expiryDate !== undefined
              ? data.expiryDate
                ? new Date(data.expiryDate)
                : null
              : undefined,
          primaryImageUrl: data.primaryImageUrl !== undefined ? data.primaryImageUrl : undefined,
          isActive: data.isActive !== undefined ? data.isActive : undefined,
        },
        include: { category: true },
      });

      await AuditService.log({
        businessId,
        userId: req.user?.id,
        action: 'UPDATE_PRODUCT',
        entity: 'Product',
        entityId: id,
        oldValues: {
          name: product.name,
          purchasePrice: product.purchasePrice,
          sellingPrice: product.sellingPrice,
        },
        newValues: {
          name: updated.name,
          purchasePrice: updated.purchasePrice,
          sellingPrice: updated.sellingPrice,
        },
      });

      res.json({
        success: true,
        message: 'Product updated successfully',
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

      const product = await prisma.product.findUnique({ where: { id } });
      if (!product || product.businessId !== businessId) {
        throw new NotFoundError('Product not found');
      }

      // Soft archive to preserve invoice and financial history!
      await prisma.product.update({
        where: { id },
        data: { isArchived: true, isActive: false },
      });

      await AuditService.log({
        businessId,
        userId: req.user?.id,
        action: 'ARCHIVE_PRODUCT',
        entity: 'Product',
        entityId: id,
      });

      res.json({
        success: true,
        message: 'Product archived successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  public static async bulkImport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const businessId = req.businessId!;
      const { items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        throw new BadRequestError('Import items array is required and cannot be empty');
      }

      const imported: unknown[] = [];
      const errors: Array<{ row: number; sku: string; error: string }> = [];

      for (let i = 0; i < items.length; i++) {
        const row = items[i];
        try {
          if (!row.name || !row.sku || row.purchasePrice === undefined || row.sellingPrice === undefined) {
            throw new Error('Missing required fields (name, sku, purchasePrice, sellingPrice)');
          }

          const existing = await prisma.product.findUnique({
            where: {
              businessId_sku: {
                businessId,
                sku: String(row.sku).trim(),
              },
            },
          });

          if (existing) {
            throw new Error(`SKU '${row.sku}' already exists`);
          }

          const openingStock = Number(row.openingStock) || 0;
          const purchasePrice = Number(row.purchasePrice);
          const sellingPrice = Number(row.sellingPrice);

          const created = await prisma.product.create({
            data: {
              businessId,
              name: String(row.name).trim(),
              sku: String(row.sku).trim(),
              barcode: row.barcode ? String(row.barcode).trim() : null,
              brand: row.brand ? String(row.brand).trim() : null,
              unit: row.unit || 'PCS',
              purchasePrice: new Prisma.Decimal(purchasePrice.toFixed(2)),
              sellingPrice: new Prisma.Decimal(sellingPrice.toFixed(2)),
              mrp: row.mrp ? new Prisma.Decimal(Number(row.mrp).toFixed(2)) : null,
              gstRate: new Prisma.Decimal(Number(row.gstRate || 18).toFixed(2)),
              hsnCode: row.hsnCode ? String(row.hsnCode).trim() : null,
              lowStockThreshold: parseInt(row.lowStockThreshold) || 10,
              openingStock: new Prisma.Decimal(openingStock.toFixed(2)),
              currentStock: new Prisma.Decimal(openingStock.toFixed(2)),
            },
          });

          await prisma.stockBalance.create({
            data: {
              businessId,
              productId: created.id,
              quantity: new Prisma.Decimal(openingStock.toFixed(2)),
              weightedAvgCost: new Prisma.Decimal(purchasePrice.toFixed(2)),
            },
          });

          imported.push(created);
        } catch (itemErr: unknown) {
          errors.push({
            row: i + 1,
            sku: row.sku || 'N/A',
            error: (itemErr as Error).message || 'Validation error',
          });
        }
      }

      res.json({
        success: true,
        message: `Import completed. ${imported.length} items imported, ${errors.length} errors.`,
        data: {
          importedCount: imported.length,
          errorsCount: errors.length,
          errors,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async uploadImage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('No image file provided');
      }

      const relativePath = `/uploads/products/${req.file.filename}`;
      const productId = req.params.id || req.body.productId;

      if (productId) {
        await prisma.product.updateMany({
          where: { id: productId, businessId: req.businessId! },
          data: { primaryImageUrl: relativePath },
        });

        await prisma.productImage.create({
          data: {
            productId,
            url: relativePath,
            isPrimary: true,
          },
        }).catch(() => {});
      }

      res.json({
        success: true,
        message: 'Product photo uploaded successfully',
        data: {
          url: relativePath,
          filename: req.file.filename,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
