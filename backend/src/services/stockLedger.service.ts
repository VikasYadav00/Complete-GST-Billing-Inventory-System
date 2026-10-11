import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { BadRequestError } from '../utils/httpErrors.js';
import { MOVEMENT_TYPES } from '../config/constants.js';
import { WhatsAppService } from './whatsapp.service.js';

export interface RecordMovementParams {
  businessId: string;
  productId: string;
  quantityChange: number; // positive for addition, negative for reduction
  movementType: keyof typeof MOVEMENT_TYPES | string;
  unitCost?: number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  userId?: string;
  tx?: Prisma.TransactionClient;
}

export class StockLedgerService {
  /**
   * Adjust stock atomically and record inventory movement
   */
  public static async recordMovement(params: RecordMovementParams) {
    const {
      businessId,
      productId,
      quantityChange,
      movementType,
      unitCost,
      referenceType,
      referenceId,
      reason,
      userId,
      tx = prisma,
    } = params;

    // 1. Fetch current product and business configuration
    const [product, business] = await Promise.all([
      tx.product.findUnique({
        where: { id: productId },
      }),
      tx.business.findUnique({
        where: { id: businessId },
      }),
    ]);

    if (!product || product.businessId !== businessId) {
      throw new BadRequestError(`Product with ID '${productId}' not found in business`);
    }

    if (!business) {
      throw new BadRequestError(`Business with ID '${businessId}' not found`);
    }

    const previousStockNum = Number(product.currentStock);
    const newStockNum = previousStockNum + quantityChange;

    // 2. Prevent negative stock unless overselling is explicitly permitted
    if (newStockNum < 0 && !business.allowOverselling) {
      throw new BadRequestError(
        `Insufficient stock for '${product.name}' (SKU: ${product.sku}). Available: ${previousStockNum}, Requested: ${Math.abs(
          quantityChange
        )}`
      );
    }

    // 3. Threshold crossing logic for WhatsApp low-stock alert
    const threshold = product.lowStockThreshold || business.defaultLowStockThreshold || 10;
    let shouldQueueLowStockAlert = false;
    let isCriticalStock = false;
    let updateAlertSentStatus = product.isLowStockAlertSent;

    if (quantityChange < 0) {
      // Deducting stock
      if (newStockNum <= 0) {
        // Critical out of stock
        isCriticalStock = true;
        shouldQueueLowStockAlert = true;
        updateAlertSentStatus = true;
      } else if (newStockNum < threshold && previousStockNum >= threshold) {
        // Crossed below threshold! (e.g. from 10 to 9)
        shouldQueueLowStockAlert = true;
        updateAlertSentStatus = true;
      }
    } else if (quantityChange > 0) {
      // Replenishing stock
      if (newStockNum >= threshold && product.isLowStockAlertSent) {
        // Reset alert eligibility now that product is replenished
        updateAlertSentStatus = false;
      }
    }

    // 4. Update product current stock
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: {
        currentStock: new Prisma.Decimal(newStockNum.toFixed(2)),
        isLowStockAlertSent: updateAlertSentStatus,
      },
    });

    // 5. Update or create StockBalance
    await tx.stockBalance.upsert({
      where: { productId },
      create: {
        businessId,
        productId,
        quantity: new Prisma.Decimal(newStockNum.toFixed(2)),
        weightedAvgCost: unitCost
          ? new Prisma.Decimal(unitCost.toFixed(2))
          : product.purchasePrice,
        lastRestockedAt: quantityChange > 0 ? new Date() : undefined,
      },
      update: {
        quantity: new Prisma.Decimal(newStockNum.toFixed(2)),
        lastRestockedAt: quantityChange > 0 ? new Date() : undefined,
        ...(unitCost && quantityChange > 0
          ? {
              weightedAvgCost: new Prisma.Decimal(
                (
                  (Number(previousStockNum) * Number(product.purchasePrice) +
                    quantityChange * unitCost) /
                  (previousStockNum + quantityChange)
                ).toFixed(2)
              ),
            }
          : {}),
      },
    });

    // 6. Record immutable movement in ledger
    const movement = await tx.inventoryMovement.create({
      data: {
        businessId,
        productId,
        movementType,
        quantityChange: new Prisma.Decimal(quantityChange.toFixed(2)),
        previousStock: new Prisma.Decimal(previousStockNum.toFixed(2)),
        resultingStock: new Prisma.Decimal(newStockNum.toFixed(2)),
        unitCost: unitCost ? new Prisma.Decimal(unitCost.toFixed(2)) : null,
        referenceType: referenceType || null,
        referenceId: referenceId || null,
        reason: reason || null,
        userId: userId || null,
      },
    });

    // 7. If threshold crossed, trigger async WhatsApp alert queue
    if (shouldQueueLowStockAlert) {
      // Execute asynchronously outside transaction commit to avoid rollback on webhook failures
      setImmediate(async () => {
        try {
          await WhatsAppService.queueLowStockAlert({
            businessId,
            product: updatedProduct,
            currentStock: newStockNum,
            threshold,
            isCritical: isCriticalStock,
          });
        } catch (queueErr) {
          console.error('[WHATSAPP_QUEUE_ERR] Failed to queue low stock alert:', queueErr);
        }
      });
    }

    return {
      product: updatedProduct,
      movement,
      previousStock: previousStockNum,
      resultingStock: newStockNum,
    };
  }

  /**
   * Get stock movement history for a product or business
   */
  public static async getMovements(
    businessId: string,
    filters: {
      productId?: string;
      movementType?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryMovementWhereInput = { businessId };
    if (filters.productId) where.productId = filters.productId;
    if (filters.movementType) where.movementType = filters.movementType;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
            },
          },
        },
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    return {
      data: movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
