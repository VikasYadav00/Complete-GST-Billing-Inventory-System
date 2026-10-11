const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const s1 = await prisma.sale.findUnique({
    where: { id: 'bab11a51-9c3c-4143-a9ec-086f021e3c26' },
    include: { customer: true, items: true },
  });
  console.log('SALE 1 (bab11a51):', JSON.stringify({
    invoiceNumber: s1?.invoiceNumber,
    customerId: s1?.customerId,
    customer: s1?.customer,
    paymentMethod: s1?.paymentMethod,
    paymentStatus: s1?.paymentStatus,
    grandTotal: s1?.grandTotal,
    paidAmount: s1?.paidAmount,
    balanceAmount: s1?.balanceAmount,
    items: s1?.items?.map(i => ({ name: i.productName, qty: i.quantity, unitPrice: i.unitPrice, taxable: i.taxableAmount, gstRate: i.gstRate, total: i.totalAmount })),
  }, null, 2));

  const s2 = await prisma.sale.findUnique({
    where: { id: 'dacccbca-3f88-4c97-9a8d-2f67f1dbb48e' },
    include: { customer: true, items: true },
  });
  console.log('SALE 2 (dacccbca):', JSON.stringify({
    invoiceNumber: s2?.invoiceNumber,
    customerId: s2?.customerId,
    customer: s2?.customer,
    paymentMethod: s2?.paymentMethod,
    paymentStatus: s2?.paymentStatus,
    grandTotal: s2?.grandTotal,
    paidAmount: s2?.paidAmount,
    balanceAmount: s2?.balanceAmount,
    items: s2?.items?.map(i => ({ name: i.productName, qty: i.quantity, unitPrice: i.unitPrice, taxable: i.taxableAmount, gstRate: i.gstRate, total: i.totalAmount })),
  }, null, 2));

  // Also check all sales with balanceAmount > 0
  const unpaidSales = await prisma.sale.findMany({
    where: { balanceAmount: { gt: 0 } },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('RECENT UNPAID SALES:', unpaidSales.map(s => ({
    id: s.id,
    inv: s.invoiceNumber,
    customerId: s.customerId,
    custName: s.customer?.name,
    custBal: s.customer?.currentBalance,
    method: s.paymentMethod,
    grandTotal: s.grandTotal,
    paid: s.paidAmount,
    balance: s.balanceAmount,
  })));
}

check().finally(() => prisma.$disconnect());
