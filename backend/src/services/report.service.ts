import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { GstService } from './gst.service.js';

export class ReportService {
  /**
   * Get Live Dashboard Metrics & KPIs
   */
  public static async getDashboardMetrics(businessId: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todaySalesAgg,
      monthSalesAgg,
      todayPaymentsAgg,
      monthPurchasesAgg,
      activeProductsCount,
      allProducts,
      customerDuesAgg,
      salesDuesAgg,
      supplierDuesAgg,
      purchaseDuesAgg,
      monthExpensesAgg,
      recentSales,
      recentMovements,
    ] = await Promise.all([
      // 1. Today's sales
      prisma.sale.aggregate({
        where: {
          businessId,
          status: 'FINAL',
          invoiceDate: { gte: startOfToday },
        },
        _sum: { grandTotal: true, paidAmount: true, balanceAmount: true },
        _count: true,
      }),

      // 2. Month's sales
      prisma.sale.aggregate({
        where: {
          businessId,
          status: 'FINAL',
          invoiceDate: { gte: startOfMonth },
        },
        _sum: { grandTotal: true, paidAmount: true, balanceAmount: true },
        _count: true,
      }),

      // 3. Cash & payments actually collected this month
      prisma.payment.aggregate({
        where: {
          businessId,
          paymentType: 'CUSTOMER_PAYMENT',
          paymentDate: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),

      // 4. Month's purchases
      prisma.purchase.aggregate({
        where: {
          businessId,
          status: { in: ['RECEIVED', 'PARTIALLY_RECEIVED'] },
          purchaseDate: { gte: startOfMonth },
        },
        _sum: { totalAmount: true },
      }),

      // 5. Product counts
      prisma.product.count({
        where: { businessId, isActive: true, isArchived: false },
      }),

      // 6. Fetch products for low stock and valuation
      prisma.product.findMany({
        where: { businessId, isActive: true, isArchived: false },
        select: {
          id: true,
          name: true,
          sku: true,
          currentStock: true,
          lowStockThreshold: true,
          purchasePrice: true,
          sellingPrice: true,
          unit: true,
        },
      }),

      // 7a. Customer dues
      prisma.customer.aggregate({
        where: { businessId, isActive: true },
        _sum: { currentBalance: true },
      }),

      // 7b. Outstanding sales dues (unpaid or partially paid sales)
      prisma.sale.aggregate({
        where: {
          businessId,
          status: 'FINAL',
          balanceAmount: { gt: 0 },
        },
        _sum: { balanceAmount: true },
        _count: true,
      }),

      // 8a. Supplier ledger dues (only positive balances where we owe supplier)
      prisma.supplier.aggregate({
        where: { businessId, isActive: true, currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),

      // 8b. Outstanding purchase dues (unpaid or partially paid purchase bills)
      prisma.purchase.aggregate({
        where: {
          businessId,
          balanceAmount: { gt: 0 },
        },
        _sum: { balanceAmount: true },
        _count: true,
      }),

      // 9. Month expenses
      prisma.expense.aggregate({
        where: {
          businessId,
          expenseDate: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),

      // 10. Recent sales
      prisma.sale.findMany({
        where: { businessId },
        take: 5,
        orderBy: { invoiceDate: 'desc' },
        include: { customer: true },
      }),

      // 11. Recent movements
      prisma.inventoryMovement.findMany({
        where: { businessId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { product: true },
      }),
    ]);

    // Calculate low-stock and out-of-stock products
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalInventoryCostValue = 0;
    let totalInventoryRetailValue = 0;

    const lowStockProductsList: Array<{
      id: string;
      name: string;
      sku: string;
      currentStock: number;
      threshold: number;
      unit: string;
    }> = [];

    for (const p of allProducts) {
      const stock = Number(p.currentStock);
      const threshold = p.lowStockThreshold;
      const cost = Number(p.purchasePrice);
      const sell = Number(p.sellingPrice);

      if (stock > 0) {
        totalInventoryCostValue += stock * cost;
        totalInventoryRetailValue += stock * sell;
      }

      if (stock <= 0) {
        outOfStockCount++;
        lowStockProductsList.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          currentStock: stock,
          threshold,
          unit: p.unit,
        });
      } else if (stock <= threshold) {
        lowStockCount++;
        lowStockProductsList.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          currentStock: stock,
          threshold,
          unit: p.unit,
        });
      }
    }

    // Calculate COGS and Gross Profit for the current month
    const monthSaleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          businessId,
          status: { notIn: ['CANCELLED', 'DRAFT'] },
          invoiceDate: { gte: startOfMonth },
        },
      },
      select: {
        quantity: true,
        unitPrice: true,
        costPrice: true,
        taxableAmount: true,
        product: {
          select: {
            purchasePrice: true,
          },
        },
      },
    });

    let monthCostOfGoodsSold = 0;
    let monthTaxableRevenue = 0;

    for (const item of monthSaleItems) {
      const qty = Number(item.quantity);
      const unitCost = Number(item.costPrice) > 0 ? Number(item.costPrice) : Number(item.product?.purchasePrice || 0);
      monthCostOfGoodsSold += qty * unitCost;
      monthTaxableRevenue += Number(item.taxableAmount);
    }

    monthCostOfGoodsSold = GstService.round2(monthCostOfGoodsSold);
    monthTaxableRevenue = GstService.round2(monthTaxableRevenue);
    const monthGrossProfit = GstService.round2(monthTaxableRevenue - monthCostOfGoodsSold);
    const monthExpenses = Number(monthExpensesAgg._sum.amount || 0);
    const monthNetProfit = GstService.round2(monthGrossProfit - monthExpenses);
    const grossProfitMarginPercent =
      monthTaxableRevenue > 0
        ? GstService.round2((monthGrossProfit / monthTaxableRevenue) * 100)
        : 0;
    const netProfitMarginPercent =
      monthTaxableRevenue > 0
        ? GstService.round2((monthNetProfit / monthTaxableRevenue) * 100)
        : 0;

    return {
      todaySales: Number(todaySalesAgg._sum.grandTotal || 0),
      todayInvoicesCount: todaySalesAgg._count,
      monthSales: Number(monthSalesAgg._sum.grandTotal || 0),
      monthCashCollected: Number(todayPaymentsAgg._sum.amount || 0),
      monthPurchases: Number(monthPurchasesAgg._sum.totalAmount || 0),
      activeProductsCount,
      lowStockCount,
      outOfStockCount,
      lowStockProductsList: lowStockProductsList.slice(0, 5),
      customerOutstandingDues: Math.max(
        Number(customerDuesAgg._sum.currentBalance || 0),
        Number(salesDuesAgg._sum.balanceAmount || 0)
      ),
      unpaidInvoicesCount: salesDuesAgg._count,
      supplierOutstandingDues: Math.max(
        Number(supplierDuesAgg._sum.currentBalance || 0),
        Number(purchaseDuesAgg._sum.balanceAmount || 0)
      ),
      unpaidPurchasesCount: purchaseDuesAgg._count,
      unpaidPurchasesTotalDue: Number(purchaseDuesAgg._sum.balanceAmount || 0),
      inventoryValuation: {
        costValue: GstService.round2(totalInventoryCostValue),
        retailValue: GstService.round2(totalInventoryRetailValue),
        potentialMargin: GstService.round2(
          totalInventoryRetailValue - totalInventoryCostValue
        ),
      },
      // Top-level profit & loss fields for seamless direct consumption
      grossProfit: monthGrossProfit,
      netProfit: monthNetProfit,
      cogs: monthCostOfGoodsSold,
      costOfGoodsSold: monthCostOfGoodsSold,
      taxableRevenue: monthTaxableRevenue,
      monthTaxableRevenue,
      expenses: monthExpenses,
      grossProfitMarginPercent,
      netProfitMarginPercent,
      profitability: {
        taxableRevenue: monthTaxableRevenue,
        costOfGoodsSold: monthCostOfGoodsSold,
        grossProfit: monthGrossProfit,
        expenses: monthExpenses,
        netProfit: monthNetProfit,
        grossProfitMarginPercent,
        netProfitMarginPercent,
      },
      recentSales,
      recentMovements,
    };
  }

  /**
   * Sales Trends Chart Data (Daily for last 30 days)
   */
  public static async getSalesTrend(businessId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const sales = await prisma.sale.findMany({
      where: {
        businessId,
        status: 'FINAL',
        invoiceDate: { gte: startDate },
      },
      select: {
        invoiceDate: true,
        grandTotal: true,
        paidAmount: true,
        balanceAmount: true,
      },
      orderBy: { invoiceDate: 'asc' },
    });

    const dayMap = new Map<
      string,
      { date: string; sales: number; collected: number; dues: number; count: number }
    >();

    for (const sale of sales) {
      const dateKey = sale.invoiceDate.toISOString().split('T')[0];
      const entry = dayMap.get(dateKey) || {
        date: dateKey,
        sales: 0,
        collected: 0,
        dues: 0,
        count: 0,
      };

      entry.sales = GstService.round2(entry.sales + Number(sale.grandTotal));
      entry.collected = GstService.round2(entry.collected + Number(sale.paidAmount));
      entry.dues = GstService.round2(entry.dues + Number(sale.balanceAmount));
      entry.count += 1;
      dayMap.set(dateKey, entry);
    }

    return Array.from(dayMap.values());
  }

  /**
   * GST Summary Report (GSTR-1 & Input Tax Credit Summary)
   */
  public static async getGstSummaryReport(
    businessId: string,
    startDate: Date,
    endDate: Date
  ) {
    const [sales, purchases] = await Promise.all([
      prisma.sale.findMany({
        where: {
          businessId,
          status: 'FINAL',
          isGstInvoice: true,
          invoiceDate: { gte: startDate, lte: endDate },
        },
        include: { items: true, customer: true },
      }),
      prisma.purchase.findMany({
        where: {
          businessId,
          status: { in: ['RECEIVED', 'PARTIALLY_RECEIVED'] },
          purchaseDate: { gte: startDate, lte: endDate },
        },
        include: { items: true, supplier: true },
      }),
    ]);

    // Output Tax Collected on Sales
    let b2bTaxable = 0;
    let b2bCgst = 0;
    let b2bSgst = 0;
    let b2bIgst = 0;

    let b2cTaxable = 0;
    let b2cCgst = 0;
    let b2cSgst = 0;
    let b2cIgst = 0;

    const hsnMap = new Map<
      string,
      {
        hsnCode: string;
        description: string;
        quantity: number;
        taxableAmount: number;
        cgstAmount: number;
        sgstAmount: number;
        igstAmount: number;
        totalTax: number;
      }
    >();

    for (const sale of sales) {
      const isB2B = Boolean(sale.customer?.gstin && sale.customer.gstin.trim());
      const taxable = Number(sale.taxableAmount);
      const cgst = Number(sale.cgstAmount);
      const sgst = Number(sale.sgstAmount);
      const igst = Number(sale.igstAmount);

      if (isB2B) {
        b2bTaxable += taxable;
        b2bCgst += cgst;
        b2bSgst += sgst;
        b2bIgst += igst;
      } else {
        b2cTaxable += taxable;
        b2cCgst += cgst;
        b2cSgst += sgst;
        b2cIgst += igst;
      }

      // HSN summary grouping
      for (const item of sale.items) {
        const hsn = item.hsnCode || 'N/A';
        const curr = hsnMap.get(hsn) || {
          hsnCode: hsn,
          description: item.productName,
          quantity: 0,
          taxableAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          totalTax: 0,
        };

        curr.quantity += Number(item.quantity);
        curr.taxableAmount = GstService.round2(curr.taxableAmount + Number(item.taxableAmount));
        curr.cgstAmount = GstService.round2(curr.cgstAmount + Number(item.cgstAmount));
        curr.sgstAmount = GstService.round2(curr.sgstAmount + Number(item.sgstAmount));
        curr.igstAmount = GstService.round2(curr.igstAmount + Number(item.igstAmount));
        curr.totalTax = GstService.round2(
          curr.cgstAmount + curr.sgstAmount + curr.igstAmount
        );
        hsnMap.set(hsn, curr);
      }
    }

    // Input Tax Credit (ITC) from Purchases
    let itcTaxable = 0;
    let itcCgst = 0;
    let itcSgst = 0;
    let itcIgst = 0;

    for (const purchase of purchases) {
      itcTaxable += Number(purchase.taxableAmount);
      itcCgst += Number(purchase.cgstAmount);
      itcSgst += Number(purchase.sgstAmount);
      itcIgst += Number(purchase.igstAmount);
    }

    const totalOutputTax = GstService.round2(
      b2bCgst + b2bSgst + b2bIgst + b2cCgst + b2cSgst + b2cIgst
    );
    const totalInputCredit = GstService.round2(itcCgst + itcSgst + itcIgst);
    const netGstPayable = GstService.round2(Math.max(0, totalOutputTax - totalInputCredit));

    return {
      period: { startDate, endDate },
      outputTax: {
        b2b: {
          taxableAmount: GstService.round2(b2bTaxable),
          cgst: GstService.round2(b2bCgst),
          sgst: GstService.round2(b2bSgst),
          igst: GstService.round2(b2bIgst),
          totalTax: GstService.round2(b2bCgst + b2bSgst + b2bIgst),
        },
        b2c: {
          taxableAmount: GstService.round2(b2cTaxable),
          cgst: GstService.round2(b2cCgst),
          sgst: GstService.round2(b2cSgst),
          igst: GstService.round2(b2cIgst),
          totalTax: GstService.round2(b2cCgst + b2cSgst + b2cIgst),
        },
        totalTaxable: GstService.round2(b2bTaxable + b2cTaxable),
        totalOutputTax,
      },
      inputTaxCredit: {
        taxableAmount: GstService.round2(itcTaxable),
        cgst: GstService.round2(itcCgst),
        sgst: GstService.round2(itcSgst),
        igst: GstService.round2(itcIgst),
        totalInputCredit,
      },
      netGstPayable,
      hsnSummary: Array.from(hsnMap.values()),
    };
  }

  /**
   * Profit & Loss Report for a custom date range
   */
  public static async getProfitAndLossReport(
    businessId: string,
    startDate: Date,
    endDate: Date
  ) {
    const [salesAgg, expensesAgg, saleItems, expensesByCategory] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          businessId,
          status: { notIn: ['CANCELLED', 'DRAFT'] },
          invoiceDate: { gte: startDate, lte: endDate },
        },
        _sum: {
          grandTotal: true,
          subtotal: true,
          taxableAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          totalTax: true,
          discountAmount: true,
        },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: {
          businessId,
          expenseDate: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.saleItem.findMany({
        where: {
          sale: {
            businessId,
            status: { notIn: ['CANCELLED', 'DRAFT'] },
            invoiceDate: { gte: startDate, lte: endDate },
          },
        },
        select: {
          quantity: true,
          unitPrice: true,
          costPrice: true,
          taxableAmount: true,
          product: {
            select: {
              purchasePrice: true,
            },
          },
        },
      }),
      prisma.expense.groupBy({
        by: ['categoryId'],
        where: {
          businessId,
          expenseDate: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // Calculate COGS using costPrice snapshot with fallback to product.purchasePrice
    let cogs = 0;
    for (const item of saleItems) {
      const qty = Number(item.quantity);
      const unitCost =
        Number(item.costPrice) > 0
          ? Number(item.costPrice)
          : Number(item.product?.purchasePrice || 0);
      cogs += qty * unitCost;
    }
    cogs = GstService.round2(cogs);

    const grossSales = GstService.round2(Number(salesAgg._sum.grandTotal || 0));
    const taxableRevenue = GstService.round2(Number(salesAgg._sum.taxableAmount || 0));
    const totalGstCollected = GstService.round2(
      Number(salesAgg._sum.totalTax || 0) ||
        Number(salesAgg._sum.cgstAmount || 0) +
          Number(salesAgg._sum.sgstAmount || 0) +
          Number(salesAgg._sum.igstAmount || 0)
    );
    const totalDiscounts = GstService.round2(Number(salesAgg._sum.discountAmount || 0));
    const totalExpenses = GstService.round2(Number(expensesAgg._sum.amount || 0));

    // Gross Profit = Net Turnover (Taxable Revenue excl. GST) - COGS
    const grossProfit = GstService.round2(taxableRevenue - cogs);
    const netProfit = GstService.round2(grossProfit - totalExpenses);

    const grossProfitMargin =
      taxableRevenue > 0
        ? GstService.round2((grossProfit / taxableRevenue) * 100)
        : 0;
    const netProfitMargin =
      taxableRevenue > 0
        ? GstService.round2((netProfit / taxableRevenue) * 100)
        : 0;

    // Fetch expense categories for clear breakdown
    const categories = await prisma.expenseCategory.findMany({
      where: { businessId },
      select: { id: true, name: true },
    });
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const expenseBreakdown = expensesByCategory.map((eb) => ({
      categoryId: eb.categoryId,
      categoryName: catMap.get(eb.categoryId) || 'Store Expenses',
      amount: GstService.round2(Number(eb._sum.amount || 0)),
      count: eb._count,
    }));

    return {
      period: { startDate, endDate },
      invoicesCount: salesAgg._count,
      grossSales,
      taxableRevenue,
      totalGstCollected,
      totalDiscounts,
      cogs,
      grossProfit,
      grossProfitMargin,
      totalExpenses,
      netProfit,
      netProfitMargin,
      expenseBreakdown,
    };
  }

  /**
   * Inventory Valuation Report
   */
  public static async getInventoryValuationReport(businessId: string) {
    const products = await prisma.product.findMany({
      where: { businessId, isActive: true, isArchived: false },
      include: { category: true, stockBalance: true },
      orderBy: { name: 'asc' },
    });

    let totalCost = 0;
    let totalRetail = 0;
    let totalUnits = 0;

    const items = products.map((p) => {
      const stock = Number(p.currentStock);
      const costRate = Number(p.stockBalance?.weightedAvgCost ?? p.purchasePrice);
      const retailRate = Number(p.sellingPrice);
      const itemCostVal = GstService.round2(stock * costRate);
      const itemRetailVal = GstService.round2(stock * retailRate);

      if (stock > 0) {
        totalCost += itemCostVal;
        totalRetail += itemRetailVal;
        totalUnits += stock;
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category?.name || 'Uncategorized',
        unit: p.unit,
        currentStock: stock,
        unitCost: costRate,
        sellingPrice: retailRate,
        totalCostValue: itemCostVal,
        totalRetailValue: itemRetailVal,
        potentialMargin: GstService.round2(itemRetailVal - itemCostVal),
      };
    });

    totalCost = GstService.round2(totalCost);
    totalRetail = GstService.round2(totalRetail);

    return {
      items,
      totalProducts: products.length,
      totalUnits: GstService.round2(totalUnits),
      totalCostValue: totalCost,
      totalRetailValue: totalRetail,
      totalPurchaseValue: totalCost,
      totalSellingValue: totalRetail,
      totalPotentialMargin: GstService.round2(totalRetail - totalCost),
    };
  }
}
