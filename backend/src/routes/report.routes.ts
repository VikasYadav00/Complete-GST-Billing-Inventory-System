import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { ReportService } from '../services/report.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { ExportService } from '../services/export.service.js';
import { StockLedgerService } from '../services/stockLedger.service.js';
import { AuditService } from '../services/audit.service.js';
import { BadRequestError } from '../utils/httpErrors.js';

const router = Router();
router.use(authenticate);

// Dashboard KPIs
router.get('/dashboard', requirePermission('reports', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const metrics = await ReportService.getDashboardMetrics(req.businessId!);
    res.json({ success: true, data: metrics });
  } catch (err) { next(err); }
});

// Sales trend chart data
router.get('/sales-trend', requirePermission('reports', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const trend = await ReportService.getSalesTrend(req.businessId!, days);
    res.json({ success: true, data: trend });
  } catch (err) { next(err); }
});

// GST Summary Report
router.get('/gst-summary', requirePermission('reports', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    endDate.setHours(23, 59, 59, 999);
    const report = await ReportService.getGstSummaryReport(req.businessId!, startDate, endDate);
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

// Profit & Loss Report
router.get('/profit-loss', requirePermission('reports', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    endDate.setHours(23, 59, 59, 999);
    const report = await ReportService.getProfitAndLossReport(req.businessId!, startDate, endDate);
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

// Inventory valuation
router.get('/inventory-valuation', requirePermission('reports', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const report = await ReportService.getInventoryValuationReport(req.businessId!);
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

// Stock movements ledger
router.get('/inventory-movements', requirePermission('inventory', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await StockLedgerService.getMovements(req.businessId!, {
      productId: req.query.productId as string,
      movementType: req.query.movementType as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// Audit logs (Owner only)
router.get('/audit-logs', requirePermission('audit', 'read'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await AuditService.getLogs(req.businessId!, {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      entity: req.query.entity as string,
      action: req.query.action as string,
      userId: req.query.userId as string,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// Export products to Excel
router.get('/export/products', requirePermission('products', 'export'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../db/prisma.js');
    const products = await prisma.product.findMany({
      where: { businessId: req.businessId!, isArchived: false },
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    const format = req.query.format || 'xlsx';
    const columns = [
      { header: 'Product Name', key: 'name', width: 30 },
      { header: 'SKU', key: 'sku', width: 18 },
      { header: 'Barcode', key: 'barcode', width: 18 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Brand', key: 'brand', width: 18 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Purchase Price (₹)', key: 'purchasePrice', width: 20 },
      { header: 'Selling Price (₹)', key: 'sellingPrice', width: 20 },
      { header: 'GST Rate (%)', key: 'gstRate', width: 14 },
      { header: 'HSN Code', key: 'hsnCode', width: 15 },
      { header: 'Current Stock', key: 'currentStock', width: 15 },
      { header: 'Low Stock Threshold', key: 'lowStockThreshold', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    const data = products.map(p => ({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || '',
      category: (p.category as any)?.name || 'Uncategorized',
      brand: p.brand || '',
      unit: p.unit,
      purchasePrice: Number(p.purchasePrice),
      sellingPrice: Number(p.sellingPrice),
      gstRate: Number(p.gstRate),
      hsnCode: p.hsnCode || '',
      currentStock: Number(p.currentStock),
      lowStockThreshold: p.lowStockThreshold,
      status: p.isActive ? 'Active' : 'Inactive',
    }));

    if (format === 'csv') {
      const csv = ExportService.exportToCsv(columns, data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
      return res.send(csv);
    }

    const buffer = await ExportService.exportToExcel('Products', columns, data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="products.xlsx"');
    res.send(buffer);
  } catch (err) { next(err); }
});

// Export sales to Excel
router.get('/export/sales', requirePermission('sales', 'export'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../db/prisma.js');
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    const sales = await prisma.sale.findMany({
      where: { businessId: req.businessId!, invoiceDate: { gte: startDate, lte: endDate }, status: { not: 'CANCELLED' } },
      include: { customer: true },
      orderBy: { invoiceDate: 'desc' },
    });

    const columns = [
      { header: 'Invoice No.', key: 'invoiceNumber', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Customer', key: 'customer', width: 25 },
      { header: 'Taxable Amount (₹)', key: 'taxableAmount', width: 20 },
      { header: 'CGST (₹)', key: 'cgst', width: 14 },
      { header: 'SGST (₹)', key: 'sgst', width: 14 },
      { header: 'IGST (₹)', key: 'igst', width: 14 },
      { header: 'Grand Total (₹)', key: 'grandTotal', width: 18 },
      { header: 'Paid (₹)', key: 'paidAmount', width: 14 },
      { header: 'Balance (₹)', key: 'balance', width: 14 },
      { header: 'Payment Status', key: 'paymentStatus', width: 16 },
    ];

    const data = sales.map(s => ({
      invoiceNumber: s.invoiceNumber,
      date: s.invoiceDate.toLocaleDateString('en-IN'),
      customer: (s.customer as any)?.name || 'Walk-in',
      taxableAmount: Number(s.taxableAmount),
      cgst: Number(s.cgstAmount),
      sgst: Number(s.sgstAmount),
      igst: Number(s.igstAmount),
      grandTotal: Number(s.grandTotal),
      paidAmount: Number(s.paidAmount),
      balance: Number(s.balanceAmount),
      paymentStatus: s.paymentStatus,
    }));

    const format = req.query.format || 'xlsx';
    if (format === 'csv') {
      const csv = ExportService.exportToCsv(columns, data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="sales.csv"');
      return res.send(csv);
    }

    const buffer = await ExportService.exportToExcel('Sales Report', columns, data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="sales_report.xlsx"');
    res.send(buffer);
  } catch (err) { next(err); }
});

export default router;
