import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthService } from '../src/services/auth.service.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for RetailPro...');

  // 1. Clean existing demo business if it exists
  const existingUser = await prisma.user.findFirst({
    where: { email: 'owner@retailpro.com' },
  });

  if (existingUser) {
    console.log('🧹 Cleaning existing demo business to re-seed cleanly...');
    await prisma.business.delete({ where: { id: existingUser.businessId } });
  }

  // 2. Register main business and owner
  console.log('🏢 Creating Business and Owner...');
  const { user: ownerUser } = await AuthService.registerBusiness({
    businessName: 'Sharma Agro & Retail Enterprises',
    ownerName: 'Vikas Sharma',
    email: 'owner@retailpro.com',
    password: 'Password123!',
    phone: '9876543210',
    state: 'Delhi',
    stateCode: '07',
    gstin: '07AAAAA0000A1Z5',
  });
  const businessId = ownerUser.businessId;

  // Update business profile with full details
  await prisma.business.update({
    where: { id: businessId },
    data: {
      legalName: 'Sharma Agro & Retail Enterprises Pvt Ltd',
      tagline: 'Leading Retailer of Fertilizers, Seeds & Farm Equipment',
      addressLine1: 'Shop #14, Kisan Mandi Complex, GT Karnal Road',
      city: 'Delhi',
      pincode: '110036',
    },
  });

  // Update business settings with bank & WhatsApp
  await prisma.businessSettings.update({
    where: { businessId: businessId },
    data: {
      bankName: 'State Bank of India',
      bankAccountNumber: '38192837461',
      bankIfsc: 'SBIN0001234',
      bankBranch: 'Alipur Branch, Delhi',
      upiId: 'sharmaagro@sbi',
      thermalPrinterWidth: '80mm',
      termsAndConditions: '1. Goods once sold will not be returned without bill.\n2. Subject to Delhi jurisdiction only.\n3. Verify stock quantity before leaving the premises.',
      whatsAppAlertRecipientPhone: '919876543210',
    },
  });

  // 3. Create Manager, Cashier, and Inventory Staff
  console.log('👥 Creating Staff Accounts...');
  const roles = await prisma.role.findMany({ where: { businessId } });
  const roleMap = new Map(roles.map((r) => [r.name, r.id]));

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const managerRole = roleMap.get('MANAGER')!;
  const cashierRole = roleMap.get('BILLING_STAFF')!;
  const inventoryRole = roleMap.get('INVENTORY_STAFF')!;

  await prisma.user.createMany({
    data: [
      {
        businessId,
        name: 'Amit Verma (Manager)',
        email: 'manager@retailpro.com',
        phone: '9876543211',
        passwordHash,
        roleId: managerRole,
      },
      {
        businessId,
        name: 'Pooja Gupta (Cashier)',
        email: 'cashier@retailpro.com',
        phone: '9876543212',
        passwordHash,
        roleId: cashierRole,
      },
      {
        businessId,
        name: 'Rajesh Kumar (Inventory Staff)',
        email: 'inventory@retailpro.com',
        phone: '9876543213',
        passwordHash,
        roleId: inventoryRole,
      },
    ],
  });

  // 4. Categories
  console.log('📂 Creating Categories...');
  const catFertilizers = await prisma.category.create({
    data: { businessId, name: 'Fertilizers & Chemicals', description: 'Chemical and organic crop nutrients' },
  });
  const catSeeds = await prisma.category.create({
    data: { businessId, name: 'Seeds & Saplings', description: 'Certified hybrid farm seeds' },
  });
  const catEquipment = await prisma.category.create({
    data: { businessId, name: 'Farm Tools & Equipment', description: 'Sprayers, pumps, and farming machinery' },
  });
  const catPesticides = await prisma.category.create({
    data: { businessId, name: 'Pesticides & Crop Protection', description: 'Insecticides, herbicides, and fungicides' },
  });

  // 5. Suppliers
  console.log('🏭 Creating Suppliers...');
  const suppIffco = await prisma.supplier.create({
    data: {
      businessId,
      name: 'IFFCO Fertilizers Ltd.',
      companyName: 'Indian Farmers Fertiliser Cooperative Ltd',
      phone: '9811002233',
      email: 'sales@iffco-delhi.in',
      gstin: '07AAACI0001A1Z0',
      state: 'Delhi',
      stateCode: '07',
      address: 'IFFCO Sadan, C-1, District Centre, Saket, New Delhi',
    },
  });

  const suppBayer = await prisma.supplier.create({
    data: {
      businessId,
      name: 'Bayer CropScience Ltd.',
      companyName: 'Bayer India Group',
      phone: '9822334455',
      email: 'order@bayercrop.in',
      gstin: '27AAACB0002B1Z9',
      state: 'Maharashtra',
      stateCode: '27',
      address: 'Bayer House, Central Avenue, Hiranandani, Mumbai',
    },
  });

  const suppKisanSeeds = await prisma.supplier.create({
    data: {
      businessId,
      name: 'Kisan Certified Seeds Corp',
      companyName: 'Kisan Seeds Pvt Ltd',
      phone: '9833445566',
      email: 'info@kisanseeds.com',
      gstin: '09AAACK0004D1Z7',
      state: 'Uttar Pradesh',
      stateCode: '09',
      address: 'Seed Market Yard, GT Road, Meerut',
    },
  });

  // 6. Customers
  console.log('👤 Creating Customers...');
  const custRamesh = await prisma.customer.create({
    data: {
      businessId,
      name: 'Rameshwar Dayal',
      phone: '9810123456',
      email: 'rameshwar.farmer@gmail.com',
      state: 'Delhi',
      stateCode: '07',
      billingAddress: 'Village Narela, Outer Delhi',
      currentBalance: 2500, // outstanding balance
    },
  });

  const custSuresh = await prisma.customer.create({
    data: {
      businessId,
      name: 'Suresh Yadav (Kisan Samiti)',
      phone: '9820234567',
      gstin: '07AAACY1234A1Z1',
      state: 'Delhi',
      stateCode: '07',
      billingAddress: 'Alipur Kisan Bhawan, Delhi',
      currentBalance: 0,
    },
  });

  const custHarpal = await prisma.customer.create({
    data: {
      businessId,
      name: 'Harpal Agro Farms',
      phone: '9830345678',
      gstin: '03AAACH5678B1Z2',
      state: 'Punjab',
      stateCode: '03',
      billingAddress: 'GT Road, Sirhind, Punjab',
      currentBalance: 6400,
    },
  });

  const custWalkIn = await prisma.customer.create({
    data: {
      businessId,
      name: 'Walk-in Farmer',
      phone: '9840456789',
      state: 'Delhi',
      stateCode: '07',
      currentBalance: 0,
    },
  });

  // 7. Products
  console.log('📦 Creating Products & Initial Stock...');
  const productsData = [
    {
      name: 'Neem Coated Urea (45 kg)',
      sku: 'FERT-UREA-45K',
      barcode: '890123456001',
      categoryId: catFertilizers.id,
      hsnCode: '3102',
      unit: 'BAG',
      costPrice: 242.0,
      sellingPrice: 268.0,
      gstRate: 5.0,
      minStockThreshold: 25,
      currentStock: 140,
    },
    {
      name: 'DAP Fertilizer 18:46:00 (50 kg)',
      sku: 'FERT-DAP-50K',
      barcode: '890123456002',
      categoryId: catFertilizers.id,
      hsnCode: '3105',
      unit: 'BAG',
      costPrice: 1200.0,
      sellingPrice: 1350.0,
      gstRate: 5.0,
      minStockThreshold: 15,
      currentStock: 80,
    },
    {
      name: 'NPK 19:19:19 Water Soluble (1 kg)',
      sku: 'FERT-NPK-1K',
      barcode: '890123456003',
      categoryId: catFertilizers.id,
      hsnCode: '3105',
      unit: 'PACKET',
      costPrice: 135.0,
      sellingPrice: 195.0,
      gstRate: 18.0,
      minStockThreshold: 10,
      currentStock: 45,
    },
    {
      name: 'HD-2967 Certified Wheat Seed (40 kg)',
      sku: 'SEED-WHEAT-HD2967',
      barcode: '890123456004',
      categoryId: catSeeds.id,
      hsnCode: '1209',
      unit: 'BAG',
      costPrice: 1480.0,
      sellingPrice: 1850.0,
      gstRate: 0.0,
      minStockThreshold: 10,
      currentStock: 30,
    },
    {
      name: 'Pioneer Hybrid Mustard Seed 45S46 (1 kg)',
      sku: 'SEED-MUST-45S46',
      barcode: '890123456005',
      categoryId: catSeeds.id,
      hsnCode: '1209',
      unit: 'PACKET',
      costPrice: 310.0,
      sellingPrice: 420.0,
      gstRate: 0.0,
      minStockThreshold: 15,
      currentStock: 6, // Low stock trigger!
    },
    {
      name: 'Roundup Glyphosate Herbicide (1 Ltr)',
      sku: 'PEST-ROUNDUP-1L',
      barcode: '890123456006',
      categoryId: catPesticides.id,
      hsnCode: '3808',
      unit: 'BOTTLE',
      costPrice: 380.0,
      sellingPrice: 510.0,
      gstRate: 18.0,
      minStockThreshold: 10,
      currentStock: 4, // Low stock trigger!
    },
    {
      name: 'Chlorpyrifos 20% EC Insecticide (1 Ltr)',
      sku: 'PEST-CHLOR-1L',
      barcode: '890123456007',
      categoryId: catPesticides.id,
      hsnCode: '3808',
      unit: 'BOTTLE',
      costPrice: 280.0,
      sellingPrice: 385.0,
      gstRate: 18.0,
      minStockThreshold: 10,
      currentStock: 22,
    },
    {
      name: 'Aspee Knapsack 16L Battery Sprayer',
      sku: 'EQP-SPRAYER-16L',
      barcode: '890123456008',
      categoryId: catEquipment.id,
      hsnCode: '8424',
      unit: 'PIECE',
      costPrice: 1850.0,
      sellingPrice: 2490.0,
      gstRate: 12.0,
      minStockThreshold: 5,
      currentStock: 12,
    },
    {
      name: 'Neem Oil Organic Bio-Pesticide (1 Ltr)',
      sku: 'PEST-NEEM-1L',
      barcode: '890123456009',
      categoryId: catPesticides.id,
      hsnCode: '3808',
      unit: 'BOTTLE',
      costPrice: 210.0,
      sellingPrice: 310.0,
      gstRate: 5.0,
      minStockThreshold: 8,
      currentStock: 28,
    },
    {
      name: 'Pure Earth Organic Vermicompost (25 kg)',
      sku: 'FERT-VERMI-25K',
      barcode: '890123456010',
      categoryId: catFertilizers.id,
      hsnCode: '3101',
      unit: 'BAG',
      costPrice: 175.0,
      sellingPrice: 250.0,
      gstRate: 5.0,
      minStockThreshold: 20,
      currentStock: 55,
    },
  ];

  const createdProducts: any[] = [];
  for (const p of productsData) {
    const prod = await prisma.product.create({
      data: {
        businessId,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        categoryId: p.categoryId,
        hsnCode: p.hsnCode,
        unit: p.unit,
        purchasePrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        gstRate: p.gstRate,
        lowStockThreshold: p.minStockThreshold,
        openingStock: p.currentStock,
        currentStock: p.currentStock,
      },
    });

    // Stock balance
    await prisma.stockBalance.create({
      data: {
        businessId,
        productId: prod.id,
        quantity: p.currentStock,
        weightedAvgCost: p.costPrice,
      },
    });

    // Initial stock movement
    await prisma.inventoryMovement.create({
      data: {
        businessId,
        productId: prod.id,
        movementType: 'OPENING_STOCK',
        quantityChange: p.currentStock,
        previousStock: 0,
        resultingStock: p.currentStock,
        unitCost: p.costPrice,
        reason: 'Initial opening stock setup',
        userId: ownerUser.id,
      },
    });

    createdProducts.push(prod);
  }

  // 8. Sample Purchases
  console.log('🛒 Creating Sample Purchases...');
  const purchase1 = await prisma.purchase.create({
    data: {
      businessId,
      supplierId: suppIffco.id,
      purchaseNumber: 'PO-2026-0001',
      supplierInvoiceNumber: 'IFFCO-DEL-9842',
      purchaseDate: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      subtotal: 48400.0,
      taxableAmount: 48400.0,
      cgstAmount: 1210.0,
      sgstAmount: 1210.0,
      igstAmount: 0,
      totalTax: 2420.0,
      roundOff: 0,
      totalAmount: 50820.0,
      paidAmount: 50820.0,
      balanceAmount: 0,
      status: 'RECEIVED',
      paymentStatus: 'PAID',
      notes: 'Monsoon bulk procurement from IFFCO',
      items: {
        create: [
          {
            productId: createdProducts[0].id, // Urea
            orderedQuantity: 100,
            receivedQuantity: 100,
            unitCost: 242.0,
            gstRate: 5.0,
            taxableAmount: 24200.0,
            cgstAmount: 605.0,
            sgstAmount: 605.0,
            igstAmount: 0,
            totalAmount: 25410.0,
          },
          {
            productId: createdProducts[1].id, // DAP
            orderedQuantity: 20,
            receivedQuantity: 20,
            unitCost: 1200.0,
            gstRate: 5.0,
            taxableAmount: 24000.0,
            cgstAmount: 600.0,
            sgstAmount: 600.0,
            igstAmount: 0,
            totalAmount: 25200.0,
          },
        ],
      },
    },
  });

  // 9. Sample Sales Invoices
  console.log('🧾 Creating Sample Sales Invoices...');
  // Sale 1: Intra-state Paid Sale to Suresh Yadav (Kisan Samiti)
  const sale1 = await prisma.sale.create({
    data: {
      businessId,
      customerId: custSuresh.id,
      createdById: ownerUser.id,
      invoiceNumber: 'INV-2026-0001',
      invoiceDate: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      isGstInvoice: true,
      subtotal: 6750.0,
      taxableAmount: 6750.0,
      cgstAmount: 168.75,
      sgstAmount: 168.75,
      igstAmount: 0,
      totalTax: 337.5,
      roundOff: -0.5,
      grandTotal: 7087.0,
      paidAmount: 7087.0,
      balanceAmount: 0,
      paymentMethod: 'UPI',
      status: 'FINAL',
      paymentStatus: 'PAID',
      notes: 'Fertilizer delivery for society sowing',
      items: {
        create: [
          {
            productId: createdProducts[1].id, // DAP
            productName: createdProducts[1].name,
            sku: createdProducts[1].sku,
            hsnCode: createdProducts[1].hsnCode,
            unit: createdProducts[1].unit,
            quantity: 5,
            unitPrice: 1350.0,
            costPrice: 1200.0,
            discountPercent: 0,
            discountAmount: 0,
            taxableAmount: 6750.0,
            gstRate: 5.0,
            cgstAmount: 168.75,
            sgstAmount: 168.75,
            igstAmount: 0,
            totalAmount: 7087.5,
          },
        ],
      },
    },
  });

  // Create payment record for Sale 1
  await prisma.payment.create({
    data: {
      businessId,
      customerId: custSuresh.id,
      createdById: ownerUser.id,
      paymentType: 'CUSTOMER_PAYMENT',
      paymentNumber: 'PAY-2026-0001',
      paymentDate: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      amount: 7087.0,
      paymentMethod: 'UPI',
      transactionReference: 'UPI/628192837190',
      allocations: {
        create: {
          saleId: sale1.id,
          allocatedAmount: 7087.0,
        },
      },
    },
  });

  // Sale 2: Walk-in Cash Sale (Paid)
  const sale2 = await prisma.sale.create({
    data: {
      businessId,
      customerId: custWalkIn.id,
      createdById: ownerUser.id,
      invoiceNumber: 'INV-2026-0002',
      invoiceDate: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      isGstInvoice: true,
      subtotal: 2875.0,
      taxableAmount: 2589.0,
      cgstAmount: 150.0,
      sgstAmount: 150.0,
      igstAmount: 0,
      totalTax: 300.0,
      roundOff: 0.0,
      grandTotal: 2889.0,
      paidAmount: 2889.0,
      balanceAmount: 0,
      paymentMethod: 'CASH',
      status: 'FINAL',
      paymentStatus: 'PAID',
      items: {
        create: [
          {
            productId: createdProducts[7].id, // Sprayer 12%
            productName: createdProducts[7].name,
            sku: createdProducts[7].sku,
            hsnCode: createdProducts[7].hsnCode,
            unit: createdProducts[7].unit,
            quantity: 1,
            unitPrice: 2490.0,
            costPrice: 1850.0,
            discountPercent: 0,
            discountAmount: 0,
            taxableAmount: 2223.21,
            gstRate: 12.0,
            cgstAmount: 133.39,
            sgstAmount: 133.39,
            igstAmount: 0,
            totalAmount: 2490.0,
          },
          {
            productId: createdProducts[6].id, // Chlorpyrifos 18%
            productName: createdProducts[6].name,
            sku: createdProducts[6].sku,
            hsnCode: createdProducts[6].hsnCode,
            unit: createdProducts[6].unit,
            quantity: 1,
            unitPrice: 385.0,
            costPrice: 280.0,
            discountPercent: 0,
            discountAmount: 0,
            taxableAmount: 326.27,
            gstRate: 18.0,
            cgstAmount: 29.36,
            sgstAmount: 29.36,
            igstAmount: 0,
            totalAmount: 385.0,
          },
        ],
      },
    },
  });

  // Sale 3: Credit Sale with Outstanding Balance (Partial / Rameshwar Dayal)
  const sale3 = await prisma.sale.create({
    data: {
      businessId,
      customerId: custRamesh.id,
      createdById: ownerUser.id,
      invoiceNumber: 'INV-2026-0003',
      invoiceDate: new Date(),
      isGstInvoice: true,
      subtotal: 4850.0,
      taxableAmount: 4850.0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTax: 0,
      roundOff: 0,
      grandTotal: 4850.0,
      paidAmount: 2350.0,
      balanceAmount: 2500.0,
      paymentMethod: 'CASH',
      status: 'FINAL',
      paymentStatus: 'PARTIAL',
      notes: 'Wheat seed 2 bags + mustard seed 2 pkts. ₹2500 balance due next week.',
      items: {
        create: [
          {
            productId: createdProducts[3].id, // Wheat seed (0% GST)
            productName: createdProducts[3].name,
            sku: createdProducts[3].sku,
            hsnCode: createdProducts[3].hsnCode,
            unit: createdProducts[3].unit,
            quantity: 2,
            unitPrice: 1850.0,
            costPrice: 1480.0,
            discountPercent: 0,
            discountAmount: 0,
            taxableAmount: 3700.0,
            gstRate: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            totalAmount: 3700.0,
          },
          {
            productId: createdProducts[4].id, // Mustard seed (0% GST)
            productName: createdProducts[4].name,
            sku: createdProducts[4].sku,
            hsnCode: createdProducts[4].hsnCode,
            unit: createdProducts[4].unit,
            quantity: 2,
            unitPrice: 420.0,
            costPrice: 310.0,
            discountPercent: 0,
            discountAmount: 0,
            taxableAmount: 840.0,
            gstRate: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            totalAmount: 840.0,
          },
        ],
      },
    },
  });

  // Sale 4: Inter-State IGST Sale to Harpal Agro Farms (Punjab - Unpaid/Credit)
  const sale4 = await prisma.sale.create({
    data: {
      businessId,
      customerId: custHarpal.id,
      createdById: ownerUser.id,
      invoiceNumber: 'INV-2026-0004',
      invoiceDate: new Date(),
      isGstInvoice: true,
      placeOfSupply: '03',
      isInterState: true,
      subtotal: 6400.0,
      taxableAmount: 5423.73,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 976.27,
      totalTax: 976.27,
      roundOff: 0,
      grandTotal: 6400.0,
      paidAmount: 0,
      balanceAmount: 6400.0,
      paymentMethod: 'CREDIT',
      status: 'FINAL',
      paymentStatus: 'UNPAID',
      notes: 'Interstate supply to Punjab (IGST 18%). Payment terms 15 days credit.',
      items: {
        create: [
          {
            productId: createdProducts[5].id, // Roundup Glyphosate 18%
            productName: createdProducts[5].name,
            sku: createdProducts[5].sku,
            hsnCode: createdProducts[5].hsnCode,
            unit: createdProducts[5].unit,
            quantity: 8,
            unitPrice: 510.0,
            costPrice: 380.0,
            discountPercent: 0,
            discountAmount: 0,
            taxableAmount: 3457.63,
            gstRate: 18.0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 622.37,
            totalAmount: 4080.0,
          },
          {
            productId: createdProducts[2].id, // NPK 19:19:19 18%
            productName: createdProducts[2].name,
            sku: createdProducts[2].sku,
            hsnCode: createdProducts[2].hsnCode,
            unit: createdProducts[2].unit,
            quantity: 12,
            unitPrice: 195.0,
            costPrice: 135.0,
            discountPercent: 0,
            discountAmount: 0,
            taxableAmount: 1966.1,
            gstRate: 18.0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 353.9,
            totalAmount: 2320.0,
          },
        ],
      },
    },
  });

  // 10. Sample Expenses
  console.log('💳 Creating Sample Expenses...');
  const expCategories = await prisma.expenseCategory.findMany({ where: { businessId } });
  const expCatMap = new Map(expCategories.map((c) => [c.name, c.id]));

  const rentCatId = expCatMap.get('Rent & Premises') || expCategories[0].id;
  const utilCatId = expCatMap.get('Electricity & Utilities') || expCategories[0].id;
  const transCatId = expCatMap.get('Transportation & Freight') || expCategories[0].id;

  await prisma.expense.createMany({
    data: [
      {
        businessId,
        categoryId: rentCatId,
        amount: 15000.0,
        expenseDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
        paymentMethod: 'BANK_TRANSFER',
        reference: 'RENT-OCT-2026',
        notes: 'Monthly Mandi shop rent for October 2026',
      },
      {
        businessId,
        categoryId: utilCatId,
        amount: 2450.0,
        expenseDate: new Date(Date.now() - 2 * 24 * 3600 * 1000),
        paymentMethod: 'UPI',
        reference: 'BSES-OCT-BILL',
        notes: 'BSES commercial electricity bill payment',
      },
      {
        businessId,
        categoryId: transCatId,
        amount: 3200.0,
        expenseDate: new Date(Date.now() - 6 * 24 * 3600 * 1000),
        paymentMethod: 'CASH',
        reference: 'LOGISTICS-CH-481',
        notes: 'Truck freight charge for IFFCO warehouse haulage',
      },
    ],
  });

  console.log('✅ Database seeded successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo Credentials for RetailPro:');
  console.log('  👑 Owner:           owner@retailpro.com     / Password123!');
  console.log('  👔 Manager:         manager@retailpro.com   / Password123!');
  console.log('  💼 Cashier:         cashier@retailpro.com   / Password123!');
  console.log('  📦 Inventory Staff: inventory@retailpro.com / Password123!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
