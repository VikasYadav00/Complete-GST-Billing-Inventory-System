import { z } from 'zod';
import { GST_RATES, UNITS, PAYMENT_METHODS } from '../config/constants.js';

// Auth Schemas
export const registerBusinessSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  state: z.string().optional(),
  stateCode: z.string().optional(),
  gstin: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

// Helper to convert empty string to undefined so optional fields don't fail validation
const emptyToUndefined = (val: unknown) => {
  if (typeof val === 'string' && val.trim() === '') return undefined;
  return val;
};

const optionalString = z.preprocess(emptyToUndefined, z.string().optional().nullable());
const optionalEmail = z.preprocess(emptyToUndefined, z.string().email('Invalid email address').optional().nullable());

// Product Schemas
export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: optionalString,
  description: optionalString,
  brand: optionalString,
  categoryId: z.preprocess(emptyToUndefined, z.string().uuid().optional().nullable()),
  unit: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim().toUpperCase() : 'PCS'),
    z.string().min(1).default('PCS')
  ),
  purchasePrice: z.coerce.number().min(0, 'Purchase price must be positive'),
  sellingPrice: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional().nullable()),
  wholesalePrice: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional().nullable()),
  mrp: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional().nullable()),
  gstRate: z.coerce.number().default(18),
  hsnCode: optionalString,
  lowStockThreshold: z.coerce.number().int().min(0).default(10),
  openingStock: z.coerce.number().min(0).default(0),
  batchNumber: optionalString,
  expiryDate: z.preprocess(emptyToUndefined, z.string().datetime().optional().nullable()),
  primaryImageUrl: optionalString,
});

export const updateProductSchema = createProductSchema.partial();

// Category Schemas
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: optionalString,
  parentId: z.preprocess(emptyToUndefined, z.string().uuid().optional().nullable()),
});

export const updateCategorySchema = createCategorySchema.partial();

// Stock Adjustment Schema
export const manualStockAdjustmentSchema = z.object({
  productId: z.string().uuid('Valid product ID required'),
  quantityChange: z.coerce.number().refine((val) => val !== 0, 'Quantity change cannot be 0'),
  reason: z.string().min(3, 'A clear reason is required for manual stock adjustments'),
  unitCost: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional().nullable()),
});

// Supplier Schemas
export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Supplier name is required'),
  companyName: optionalString,
  phone: z.string().trim().min(10, 'Valid phone number required (at least 10 digits)'),
  email: optionalEmail,
  address: optionalString,
  state: optionalString,
  stateCode: optionalString,
  gstin: optionalString,
});

export const updateSupplierSchema = createSupplierSchema.partial();

// Customer Schemas
export const createCustomerSchema = z.object({
  customerType: z.enum(['RETAIL', 'WHOLESALE']).default('RETAIL'),
  companyName: optionalString,
  name: z.string().trim().min(1, 'Customer name is required'),
  phone: z.string().trim().min(10, 'Valid phone number required (at least 10 digits)'),
  email: optionalEmail,
  billingAddress: optionalString,
  shippingAddress: optionalString,
  city: optionalString,
  state: optionalString,
  stateCode: optionalString,
  gstin: optionalString,
  creditLimit: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional().nullable()),
  notes: optionalString,
});

export const updateCustomerSchema = createCustomerSchema.partial();

// Purchase Schemas
export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid('Please select a valid supplier'),
  supplierInvoiceNumber: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  purchaseDate: z.union([z.string(), z.date()]).optional().nullable(),
  expectedDate: z.union([z.string(), z.date()]).optional().nullable(),
  additionalCharges: z.coerce.number().min(0).default(0),
  paidAmount: z.coerce.number().min(0).default(0),
  paymentMethod: z.string().default('BANK_TRANSFER'),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Please select a valid product'),
        orderedQuantity: z.coerce.number().positive('Quantity must be greater than 0').optional(),
        quantity: z.coerce.number().positive('Quantity must be greater than 0').optional(),
        receivedQuantity: z.coerce.number().min(0).optional(),
        unitCost: z.coerce.number().min(0, 'Unit cost must be at least 0'),
        discountPercent: z.coerce.number().min(0).max(100).default(0),
        discountAmount: z.coerce.number().min(0).default(0),
        gstRate: z.coerce.number().default(18),
        batchNumber: z.string().optional().nullable(),
        expiryDate: z.union([z.string(), z.date()]).optional().nullable(),
      })
    )
    .min(1, 'At least one item required'),
});

// Sale / POS Checkout Schema
export const createSaleSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerStateCode: z.string().optional(),
  customerGstin: z.string().optional(),
  saleType: z.enum(['RETAIL', 'WHOLESALE']).default('RETAIL'),
  status: z.enum(['DRAFT', 'FINAL']).default('FINAL'),
  paymentMethod: z.string().default('CASH'),
  paidAmount: z.number().min(0).optional(),
  invoiceDiscountAmount: z.number().min(0).default(0),
  offsetSupplierDues: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  idempotencyKey: z.string().optional(),
  isGstInvoice: z.boolean().default(true),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive('Quantity must be greater than 0'),
        unitPrice: z.number().min(0).optional(),
        discountPercent: z.number().min(0).max(100).default(0),
        discountAmount: z.number().min(0).default(0),
      })
    )
    .min(1, 'At least one item required'),
});

// Payment Schemas
export const createCustomerPaymentSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.string().default('CASH'),
  transactionReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  specificSaleId: z.string().uuid().optional().nullable(),
});

export const createSupplierPaymentSchema = z.object({
  supplierId: z.string().uuid(),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.string().default('BANK_TRANSFER'),
  transactionReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  specificPurchaseId: z.string().uuid().optional().nullable(),
});

// Expense Schemas
export const createExpenseSchema = z.object({
  title: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable().or(z.literal('')),
  amount: z.number().positive('Expense amount must be greater than zero'),
  expenseDate: z.string().optional().nullable(),
  paymentMethod: z.string().default('CASH'),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
});

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional().nullable(),
});

// Settings & Profile Schemas
export const updateBusinessProfileSchema = z.object({
  name: z.string().min(1).optional(),
  legalName: z.string().optional().nullable(),
  tagline: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional(),
  stateCode: z.string().optional(),
  pincode: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  isGstRegistered: z.boolean().optional(),
  taxPricingMode: z.enum(['EXCLUSIVE', 'INCLUSIVE']).optional(),
  defaultLanguage: z.enum(['en', 'hi']).optional(),
  invoiceLanguage: z.enum(['en', 'hi', 'bilingual']).optional(),
  allowOverselling: z.boolean().optional(),
  defaultLowStockThreshold: z.number().int().min(0).optional(),
});

export const updateBusinessSettingsSchema = z.object({
  invoicePrefix: z.string().optional(),
  purchasePrefix: z.string().optional(),
  quotationPrefix: z.string().optional(),
  thermalPrinterWidth: z.enum(['58mm', '80mm', 'A4']).optional(),
  termsAndConditions: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankIfsc: z.string().optional().nullable(),
  bankBranch: z.string().optional().nullable(),
  upiId: z.string().optional().nullable(),
  upiQrImageUrl: z.string().optional().nullable(),
  whatsAppEnabled: z.boolean().optional(),
  whatsAppPhoneNumberId: z.string().optional().nullable(),
  whatsAppAccessToken: z.string().optional().nullable(),
  whatsAppBusinessAccountId: z.string().optional().nullable(),
  whatsAppAlertRecipientPhone: z.string().optional().nullable(),
  cloudinaryCloudName: z.string().optional().nullable(),
  cloudinaryApiKey: z.string().optional().nullable(),
  cloudinaryApiSecret: z.string().optional().nullable(),
});

export const testWhatsAppNotificationSchema = z.object({
  recipientPhone: z.string().min(10, 'Recipient phone must be at least 10 digits'),
});
