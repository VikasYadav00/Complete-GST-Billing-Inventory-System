'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { useI18n } from '@/contexts/I18nContext';

function formatINR(n: number | string | undefined | null) {
  if (n === undefined || n === null) return '₹0.00';
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type PaymentTab = 'customer_receipts' | 'customer_dues' | 'supplier_payouts' | 'supplier_dues';

export default function PaymentsPage() {
  const { t } = useI18n();

  // Active Tab: 4 first-class views
  const [activeTab, setActiveTab] = useState<PaymentTab>('customer_receipts');

  // Customer Payments (Receipts) State
  const [customerPayments, setCustomerPayments] = useState<any[]>([]);
  const [totalCustomerPayments, setTotalCustomerPayments] = useState(0);
  const [customerPage, setCustomerPage] = useState(1);

  // Supplier Payments (Payouts) State
  const [supplierPayments, setSupplierPayments] = useState<any[]>([]);
  const [totalSupplierPayments, setTotalSupplierPayments] = useState(0);
  const [supplierPage, setSupplierPage] = useState(1);

  // Customers (for Dues & Modal) State
  const [customers, setCustomers] = useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [custSearch, setCustSearch] = useState('');
  const [custDuesOnlyFilter, setCustDuesOnlyFilter] = useState(true);

  // Suppliers (for Dues & Modal) State
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [suppSearch, setSuppSearch] = useState('');
  const [suppDuesOnlyFilter, setSuppDuesOnlyFilter] = useState(true);

  // Unpaid Invoices (Sales with balanceAmount > 0)
  const [unpaidSales, setUnpaidSales] = useState<any[]>([]);
  const [unpaidSalesLoading, setUnpaidSalesLoading] = useState(true);
  const [custDuesSubTab, setCustDuesSubTab] = useState<'invoices' | 'customers'>('invoices');

  // Unpaid Purchases (Purchases with balanceAmount > 0)
  const [unpaidPurchases, setUnpaidPurchases] = useState<any[]>([]);
  const [unpaidPurchasesLoading, setUnpaidPurchasesLoading] = useState(true);
  const [suppDuesSubTab, setSuppDuesSubTab] = useState<'bills' | 'suppliers'>('bills');
  const [unpaidBillsSearch, setUnpaidBillsSearch] = useState('');

  // General Loading & Dashboard Metrics
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);

  // Modal: Receive Customer Payment
  const [showCustModal, setShowCustModal] = useState(false);
  const [selectedCustId, setSelectedCustId] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [custAmount, setCustAmount] = useState('');
  const [custMethod, setCustMethod] = useState('CASH');
  const [custRef, setCustRef] = useState('');
  const [custNotes, setCustNotes] = useState('');
  const [isSavingCust, setIsSavingCust] = useState(false);
  const [custError, setCustError] = useState('');

  // Modal: Pay Supplier
  const [showSuppModal, setShowSuppModal] = useState(false);
  const [selectedSuppId, setSelectedSuppId] = useState('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [suppAmount, setSuppAmount] = useState('');
  const [suppMethod, setSuppMethod] = useState('BANK_TRANSFER');
  const [suppRef, setSuppRef] = useState('');
  const [suppNotes, setSuppNotes] = useState('');
  const [isSavingSupp, setIsSavingSupp] = useState(false);
  const [suppError, setSuppError] = useState('');

  // Search in Receipts & Payouts
  const [receiptSearch, setReceiptSearch] = useState('');
  const [payoutSearch, setPayoutSearch] = useState('');

  // 1. Load Customer Payments (Receipts)
  const loadCustomerPayments = useCallback(async () => {
    try {
      const { data } = await api.get('/payments/customer', { params: { page: customerPage, limit: 20 } });
      setCustomerPayments(data.data || []);
      setTotalCustomerPayments(data.pagination?.total || 0);
    } catch (e) {
      console.error('Failed to load customer payments:', e);
    }
  }, [customerPage]);

  // 2. Load Supplier Payments (Payouts)
  const loadSupplierPayments = useCallback(async () => {
    try {
      const { data } = await api.get('/payments/supplier', { params: { page: supplierPage, limit: 20 } });
      setSupplierPayments(data.data || []);
      setTotalSupplierPayments(data.pagination?.total || 0);
    } catch (e) {
      console.error('Failed to load supplier payments:', e);
    }
  }, [supplierPage]);

  // 3. Load Customers for Dues & Modals
  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const { data } = await api.get('/customers', { params: { limit: 100 } });
      setCustomers(data.data || []);
    } catch (e) {
      console.error('Failed to load customers:', e);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  // 4. Load Unpaid & Partially Paid Sales Invoices
  const loadUnpaidSales = useCallback(async () => {
    setUnpaidSalesLoading(true);
    try {
      const { data } = await api.get('/sales', {
        params: { paymentStatus: 'UNPAID,PARTIALLY_PAID', limit: 100 },
      });
      setUnpaidSales(data.data || []);
    } catch (e) {
      console.error('Failed to load unpaid sales:', e);
    } finally {
      setUnpaidSalesLoading(false);
    }
  }, []);

  // 5. Load Suppliers for Dues & Modals
  const loadSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    try {
      const { data } = await api.get('/purchases/suppliers', { params: { limit: 100 } });
      setSuppliers(data.data || []);
    } catch (e) {
      console.error('Failed to load suppliers:', e);
    } finally {
      setSuppliersLoading(false);
    }
  }, []);

  // 5b. Load Unpaid & Partially Paid Purchases
  const loadUnpaidPurchases = useCallback(async () => {
    setUnpaidPurchasesLoading(true);
    try {
      const { data } = await api.get('/purchases/purchases', {
        params: { paymentStatus: 'UNPAID,PARTIALLY_PAID', hasBalance: true, limit: 100 },
      });
      setUnpaidPurchases(data.data || []);
    } catch (e) {
      console.error('Failed to load unpaid purchases:', e);
    } finally {
      setUnpaidPurchasesLoading(false);
    }
  }, []);

  // 6. Load dashboard overview metrics
  const loadMetrics = useCallback(async () => {
    try {
      const { data } = await api.get('/reports/dashboard');
      setMetrics(data.data || {});
    } catch (e) {
      console.error('Failed to load metrics:', e);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      loadCustomerPayments(),
      loadSupplierPayments(),
      loadCustomers(),
      loadUnpaidSales(),
      loadSuppliers(),
      loadUnpaidPurchases(),
      loadMetrics(),
    ]).finally(() => {
      setIsLoading(false);
    });
  }, [loadCustomerPayments, loadSupplierPayments, loadCustomers, loadUnpaidSales, loadSuppliers, loadUnpaidPurchases, loadMetrics]);

  // Filtered Customers with Dues
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const bal = Number(c.currentBalance || 0);
      if (custDuesOnlyFilter && bal <= 0) return false;

      if (custSearch.trim()) {
        const q = custSearch.toLowerCase();
        const matchesName = c.name?.toLowerCase().includes(q);
        const matchesPhone = c.phone?.toLowerCase().includes(q);
        const matchesGstin = c.gstin?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesGstin) return false;
      }
      return true;
    });
  }, [customers, custSearch, custDuesOnlyFilter]);

  // Filtered Unpaid Invoices
  const filteredUnpaidSales = useMemo(() => {
    if (!custSearch.trim()) return unpaidSales;
    const q = custSearch.toLowerCase();
    return unpaidSales.filter(s =>
      s.invoiceNumber?.toLowerCase().includes(q) ||
      s.customer?.name?.toLowerCase().includes(q) ||
      s.customer?.phone?.toLowerCase().includes(q)
    );
  }, [unpaidSales, custSearch]);

  // Filtered Suppliers with Dues
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const bal = Number(s.currentBalance || 0);
      if (suppDuesOnlyFilter && bal <= 0) return false;

      if (suppSearch.trim()) {
        const q = suppSearch.toLowerCase();
        const matchesName = s.name?.toLowerCase().includes(q);
        const matchesPhone = s.phone?.toLowerCase().includes(q);
        const matchesGstin = s.gstin?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesGstin) return false;
      }
      return true;
    });
  }, [suppliers, suppSearch, suppDuesOnlyFilter]);

  // Filtered Receipts
  const filteredReceipts = useMemo(() => {
    if (!receiptSearch.trim()) return customerPayments;
    const q = receiptSearch.toLowerCase();
    return customerPayments.filter(p =>
      p.paymentNumber?.toLowerCase().includes(q) ||
      p.customer?.name?.toLowerCase().includes(q) ||
      p.transactionReference?.toLowerCase().includes(q)
    );
  }, [customerPayments, receiptSearch]);

  // Filtered Payouts
  const filteredPayouts = useMemo(() => {
    if (!payoutSearch.trim()) return supplierPayments;
    const q = payoutSearch.toLowerCase();
    return supplierPayments.filter(p =>
      p.paymentNumber?.toLowerCase().includes(q) ||
      p.supplier?.name?.toLowerCase().includes(q) ||
      p.transactionReference?.toLowerCase().includes(q)
    );
  }, [supplierPayments, payoutSearch]);

  // Totals & Dues Calculations
  const totalCustomerDuesSum = useMemo(() => {
    return customers.reduce((acc, c) => acc + Math.max(0, Number(c.currentBalance || 0)), 0);
  }, [customers]);

  const totalUnpaidSalesDueSum = useMemo(() => {
    return unpaidSales.reduce((acc, s) => acc + Math.max(0, Number(s.balanceAmount || 0)), 0);
  }, [unpaidSales]);

  const effectiveCustomerOutstandingDues = useMemo(() => {
    return Math.max(
      totalCustomerDuesSum,
      totalUnpaidSalesDueSum,
      Number(metrics?.customerOutstandingDues || 0)
    );
  }, [totalCustomerDuesSum, totalUnpaidSalesDueSum, metrics?.customerOutstandingDues]);

  const customersWithDuesCount = useMemo(() => {
    return customers.filter(c => Number(c.currentBalance || 0) > 0).length;
  }, [customers]);

  const totalSupplierDuesSum = useMemo(() => {
    return suppliers.reduce((acc, s) => acc + Math.max(0, Number(s.currentBalance || 0)), 0);
  }, [suppliers]);

  const totalUnpaidPurchasesDueSum = useMemo(() => {
    return unpaidPurchases.reduce((acc, p) => acc + Math.max(0, Number(p.balanceAmount || 0)), 0);
  }, [unpaidPurchases]);

  const effectiveSupplierOutstandingDues = useMemo(() => {
    return Math.max(
      totalSupplierDuesSum,
      totalUnpaidPurchasesDueSum,
      Number(metrics?.supplierOutstandingDues || 0)
    );
  }, [totalSupplierDuesSum, totalUnpaidPurchasesDueSum, metrics?.supplierOutstandingDues]);

  const filteredUnpaidPurchases = useMemo(() => {
    if (!unpaidBillsSearch.trim()) return unpaidPurchases;
    const q = unpaidBillsSearch.toLowerCase();
    return unpaidPurchases.filter(p =>
      p.supplierInvoiceNumber?.toLowerCase().includes(q) ||
      p.purchaseNumber?.toLowerCase().includes(q) ||
      p.supplier?.name?.toLowerCase().includes(q) ||
      p.supplier?.phone?.toLowerCase().includes(q)
    );
  }, [unpaidPurchases, unpaidBillsSearch]);

  const suppliersWithDuesCount = useMemo(() => {
    return suppliers.filter(s => Number(s.currentBalance || 0) > 0).length;
  }, [suppliers]);

  // Open Receive Payment modal pre-filled for a specific customer or invoice
  const handleOpenReceiveCust = (custId?: string, balance?: number | string, saleId?: string) => {
    setCustError('');
    setSelectedCustId(custId || '');
    setSelectedSaleId(saleId || '');
    if (balance && Number(balance) > 0) {
      setCustAmount(String(balance));
    } else {
      setCustAmount('');
    }
    setCustMethod('CASH');
    setCustRef('');
    setCustNotes('');
    setShowCustModal(true);
  };

  // Open Pay Supplier modal pre-filled for a specific supplier or purchase bill
  const handleOpenPaySupp = (suppId?: string, balance?: number | string, purchaseId?: string) => {
    setSuppError('');
    setSelectedSuppId(suppId || '');
    setSelectedPurchaseId(purchaseId || '');
    if (balance && Number(balance) > 0) {
      setSuppAmount(String(balance));
    } else {
      setSuppAmount('');
    }
    setSuppMethod('BANK_TRANSFER');
    setSuppRef('');
    setSuppNotes('');
    setShowSuppModal(true);
  };

  // Submit Customer Payment
  const handleRecordCustomerPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustId) {
      setCustError('Please select a customer');
      return;
    }
    const amt = parseFloat(custAmount);
    if (isNaN(amt) || amt <= 0) {
      setCustError('Please enter a valid positive payment amount');
      return;
    }

    setIsSavingCust(true);
    setCustError('');
    try {
      await api.post('/payments/customer', {
        customerId: selectedCustId,
        amount: amt,
        paymentMethod: custMethod,
        transactionReference: custRef || undefined,
        notes: custNotes || undefined,
        specificSaleId: selectedSaleId || undefined,
      });
      setShowCustModal(false);
      setSelectedCustId('');
      setSelectedSaleId('');
      setCustAmount('');
      setCustRef('');
      setCustNotes('');
      await Promise.all([loadCustomerPayments(), loadCustomers(), loadUnpaidSales(), loadMetrics()]);
    } catch (err: any) {
      setCustError(err?.response?.data?.message || 'Failed to record customer payment');
    } finally {
      setIsSavingCust(false);
    }
  };

  // Submit Supplier Payment
  const handleRecordSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSuppId) {
      setSuppError('Please select a supplier');
      return;
    }
    const amt = parseFloat(suppAmount);
    if (isNaN(amt) || amt <= 0) {
      setSuppError('Please enter a valid positive payment amount');
      return;
    }

    setIsSavingSupp(true);
    setSuppError('');
    try {
      await api.post('/payments/supplier', {
        supplierId: selectedSuppId,
        amount: amt,
        paymentMethod: suppMethod,
        transactionReference: suppRef || undefined,
        notes: suppNotes || undefined,
        specificPurchaseId: selectedPurchaseId || undefined,
      });
      setShowSuppModal(false);
      setSelectedSuppId('');
      setSelectedPurchaseId('');
      setSuppAmount('');
      setSuppRef('');
      setSuppNotes('');
      await Promise.all([loadSupplierPayments(), loadSuppliers(), loadUnpaidPurchases(), loadMetrics()]);
    } catch (err: any) {
      setSuppError(err?.response?.data?.message || 'Failed to record supplier payment');
    } finally {
      setIsSavingSupp(false);
    }
  };

  const selectedCustomerObj = customers.find(c => c.id === selectedCustId);
  const selectedSupplierObj = suppliers.find(s => s.id === selectedSuppId);
  const selectedSaleObj = unpaidSales.find(s => s.id === selectedSaleId);
  const selectedPurchaseObj = unpaidPurchases.find(p => p.id === selectedPurchaseId);

  // Helper for WhatsApp payment reminder
  const getWhatsAppReminderUrl = (phone: string, name: string, dueAmount: number | string) => {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const text = encodeURIComponent(
      `नमस्ते ${name} जी,\nआपके खाते का बकाया ₹${Number(dueAmount).toLocaleString('en-IN')} का भुगतान अपेक्षित है। कृपया UPI या नकद द्वारा यथाशीघ्र भुगतान करें।\nधन्यवाद - Sharma Agro & Retail Enterprises`
    );
    return `https://wa.me/${fullPhone}?text=${text}`;
  };

  return (
    <AppShell
      title="Payments & Cash Flow"
      subtitle="Track customer receipts, customer dues, supplier payouts & vendor payables"
    >

      {/* ========================================================================= */}
      {/* 4 INTERACTIVE METRIC CARDS (Click any card to open its respective view!)  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Customer Receipts */}
        <div
          id="card-customer-receipts"
          onClick={() => setActiveTab('customer_receipts')}
          className={`card p-4 cursor-pointer transition-all border-2 text-left hover:shadow-md ${
            activeTab === 'customer_receipts'
              ? 'bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-400/30'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Customer Receipts</p>
            {activeTab === 'customer_receipts' && (
              <span className="text-[10px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded">Active</span>
            )}
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">
            {formatINR(customerPayments.reduce((s, p) => s + Number(p.amount || 0), 0))}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-emerald-100/60 text-xs">
            <span className="text-slate-500">{totalCustomerPayments} receipts</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <span>View List</span>
              <span>↓</span>
            </span>
          </div>
        </div>

        {/* Card 2: Customer Outstanding Dues */}
        <div
          id="card-customer-dues"
          onClick={() => setActiveTab('customer_dues')}
          className={`card p-4 cursor-pointer transition-all border-2 text-left hover:shadow-md ${
            activeTab === 'customer_dues'
              ? 'bg-blue-50 border-blue-500 shadow-md ring-2 ring-blue-400/30'
              : 'bg-white border-slate-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Customer Outstanding Dues</p>
            {activeTab === 'customer_dues' && (
              <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded">Active</span>
            )}
          </div>
          <p className="text-2xl font-extrabold text-blue-700 mt-1">
            {formatINR(effectiveCustomerOutstandingDues)}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-100/60 text-xs">
            <span className="text-slate-500">
              {unpaidSales.length > 0 ? `${unpaidSales.length} unpaid bill(s)` : `${customersWithDuesCount} customer(s)`}
            </span>
            <span className="text-blue-700 font-semibold flex items-center gap-1">
              <span>View List</span>
              <span>↓</span>
            </span>
          </div>
        </div>

        {/* Card 3: Supplier Payouts */}
        <div
          id="card-supplier-payouts"
          onClick={() => setActiveTab('supplier_payouts')}
          className={`card p-4 cursor-pointer transition-all border-2 text-left hover:shadow-md ${
            activeTab === 'supplier_payouts'
              ? 'bg-amber-50 border-amber-500 shadow-md ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Supplier Payouts</p>
            {activeTab === 'supplier_payouts' && (
              <span className="text-[10px] font-bold bg-amber-600 text-white px-1.5 py-0.5 rounded">Active</span>
            )}
          </div>
          <p className="text-2xl font-extrabold text-amber-700 mt-1">
            {formatINR(supplierPayments.reduce((s, p) => s + Number(p.amount || 0), 0))}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-100/60 text-xs">
            <span className="text-slate-500">{totalSupplierPayments} payouts</span>
            <span className="text-amber-700 font-semibold flex items-center gap-1">
              <span>View List</span>
              <span>↓</span>
            </span>
          </div>
        </div>

        {/* Card 4: Supplier Dues (Payables) */}
        <div
          id="card-supplier-dues"
          onClick={() => setActiveTab('supplier_dues')}
          className={`card p-4 cursor-pointer transition-all border-2 text-left hover:shadow-md ${
            activeTab === 'supplier_dues'
              ? 'bg-purple-50 border-purple-500 shadow-md ring-2 ring-purple-400/30'
              : 'bg-white border-slate-200 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Supplier Dues (Payable)</p>
            {activeTab === 'supplier_dues' && (
              <span className="text-[10px] font-bold bg-purple-600 text-white px-1.5 py-0.5 rounded">Active</span>
            )}
          </div>
          <p className="text-2xl font-extrabold text-purple-700 mt-1">
            {formatINR(effectiveSupplierOutstandingDues)}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-100/60 text-xs">
            <span className="text-slate-500">
              {unpaidPurchases.length > 0
                ? `${unpaidPurchases.length} unpaid bill(s)`
                : `${suppliersWithDuesCount} vendor(s)`}
            </span>
            <span className="text-purple-700 font-semibold flex items-center gap-1">
              <span>View List</span>
              <span>↓</span>
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4 TAB SWITCHERS & GLOBAL ACTION BUTTONS                                   */}
      {/* ========================================================================= */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap rounded-xl bg-slate-100 border border-slate-200 p-1 shadow-2xs gap-1">
          {/* Tab 1: Customer Receipts */}
          <button
            id="tab-btn-customer-receipts"
            onClick={() => setActiveTab('customer_receipts')}
            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'customer_receipts'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>💰</span>
            <span>Customer Receipts</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold">
              {totalCustomerPayments}
            </span>
          </button>

          {/* Tab 2: Customer Outstanding Dues */}
          <button
            id="tab-btn-customer-dues"
            onClick={() => setActiveTab('customer_dues')}
            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'customer_dues'
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>⚠️</span>
            <span>Customer Dues</span>
            <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full font-bold">
              {unpaidSales.length > 0 ? unpaidSales.length : customersWithDuesCount}
            </span>
          </button>

          {/* Tab 3: Supplier Payouts */}
          <button
            id="tab-btn-supplier-payouts"
            onClick={() => setActiveTab('supplier_payouts')}
            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'supplier_payouts'
                ? 'bg-white text-amber-700 shadow-sm border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🏭</span>
            <span>Supplier Payouts</span>
            <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">
              {totalSupplierPayments}
            </span>
          </button>

          {/* Tab 4: Supplier Dues */}
          <button
            id="tab-btn-supplier-dues"
            onClick={() => setActiveTab('supplier_dues')}
            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'supplier_dues'
                ? 'bg-white text-purple-700 shadow-sm border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>⏳</span>
            <span>Supplier Dues</span>
            <span className="text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full font-bold">
              {suppliersWithDuesCount}
            </span>
          </button>
        </div>

        {/* Action Button */}
        <div className="flex gap-2">
          {activeTab === 'customer_receipts' || activeTab === 'customer_dues' ? (
            <button
              id="btn-open-cust-pay"
              onClick={() => handleOpenReceiveCust()}
              className="btn-primary btn-sm flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 border-emerald-600 shadow-xs"
            >
              <span>➕</span>
              <span>Receive Customer Payment</span>
            </button>
          ) : (
            <button
              id="btn-open-supp-pay"
              onClick={() => handleOpenPaySupp()}
              className="btn-primary btn-sm flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 border-amber-600 shadow-xs"
            >
              <span>➕</span>
              <span>Record Supplier Payout</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: CUSTOMER RECEIPTS TABLE                                           */}
      {/* ========================================================================= */}
      {activeTab === 'customer_receipts' && (
        <div className="space-y-4">
          <div className="card p-3 bg-white flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 max-w-sm w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                className="form-input pl-9 text-xs sm:text-sm w-full"
                placeholder="Search payment #, customer, reference…"
                value={receiptSearch}
                onChange={e => setReceiptSearch(e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-500">
              Showing <strong>{filteredReceipts.length}</strong> recorded receipts
            </p>
          </div>

          <div className="card overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Payment Method</th>
                    <th>Reference / UTR</th>
                    <th>Notes</th>
                    <th className="text-right">Amount Received</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(7)].map((_, j) => (
                          <td key={j}><div className="skeleton h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state py-12 text-center">
                          <p className="text-4xl mb-2">💵</p>
                          <p className="text-slate-800 font-semibold">No customer payments found</p>
                          <p className="text-xs text-slate-400 mt-1">Receive payments from customers against invoices or on-account</p>
                          <button
                            onClick={() => handleOpenReceiveCust()}
                            className="btn-primary btn-sm mt-3 bg-emerald-600 hover:bg-emerald-700"
                          >
                            + Receive First Payment
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredReceipts.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="font-mono text-xs font-semibold text-brand-600">
                          {pay.paymentNumber}
                        </td>
                        <td className="text-slate-500 text-xs whitespace-nowrap">
                          {new Date(pay.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td>
                          {pay.customer ? (
                            <Link href={`/customers/${pay.customer.id}`} className="font-semibold text-slate-900 hover:text-brand-600">
                              {pay.customer.name}
                            </Link>
                          ) : (
                            <span className="text-slate-500">Walk-in</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${
                            pay.paymentMethod === 'UPI' ? 'badge-success' :
                            pay.paymentMethod === 'CASH' ? 'badge-info' :
                            pay.paymentMethod === 'CARD' ? 'badge-warning' : 'badge-neutral'
                          }`}>
                            {pay.paymentMethod}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-slate-500">
                          {pay.transactionReference || '—'}
                        </td>
                        <td className="text-xs text-slate-500 max-w-xs truncate">
                          {pay.notes || '—'}
                        </td>
                        <td className="text-right font-bold text-emerald-700">
                          {formatINR(pay.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {Math.ceil(totalCustomerPayments / 20) > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">Page {customerPage} of {Math.ceil(totalCustomerPayments / 20)}</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCustomerPage(p => Math.max(1, p - 1))}
                    disabled={customerPage === 1}
                    className="btn-secondary btn-sm"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setCustomerPage(p => p + 1)}
                    disabled={customerPage >= Math.ceil(totalCustomerPayments / 20)}
                    className="btn-secondary btn-sm"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: CUSTOMER OUTSTANDING DUES TABLE (बकाया खाता)                       */}
      {/* ========================================================================= */}
      {activeTab === 'customer_dues' && (
        <div className="space-y-4">
          {/* Sub-tab navigation: Unpaid Bills vs Customer Accounts */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setCustDuesSubTab('invoices')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                  custDuesSubTab === 'invoices'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📄</span>
                <span>Unpaid & Credit Invoices</span>
                <span className="bg-blue-100 text-blue-800 text-[11px] px-1.5 py-0.5 rounded-full font-bold">
                  {unpaidSales.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCustDuesSubTab('customers')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                  custDuesSubTab === 'customers'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>👥</span>
                <span>Customer Ledger Accounts</span>
                <span className="bg-blue-100 text-blue-800 text-[11px] px-1.5 py-0.5 rounded-full font-bold">
                  {customersWithDuesCount}
                </span>
              </button>
            </div>

            <div className="relative flex-1 max-w-sm w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                className="form-input pl-9 text-xs sm:text-sm w-full"
                placeholder={custDuesSubTab === 'invoices' ? 'Search invoice #, customer name, phone…' : 'Search customer name, phone, GSTIN…'}
                value={custSearch}
                onChange={e => setCustSearch(e.target.value)}
              />
            </div>
          </div>

          {/* SUB-VIEW 1: UNPAID BILLS TABLE */}
          {custDuesSubTab === 'invoices' && (
            <div className="card overflow-hidden">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Payment Status</th>
                      <th className="text-right">Grand Total</th>
                      <th className="text-right">Paid</th>
                      <th className="text-right">Balance Due (बकाया)</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidSalesLoading ? (
                      [...Array(4)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(8)].map((_, j) => (
                            <td key={j}><div className="skeleton h-4 w-20" /></td>
                          ))}
                        </tr>
                      ))
                    ) : filteredUnpaidSales.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <div className="empty-state py-12 text-center">
                            <p className="text-4xl mb-2">🎉</p>
                            <p className="text-slate-800 font-semibold">No unpaid sales invoices!</p>
                            <p className="text-xs text-slate-400 mt-1">
                              All sales invoices are fully paid. Any credit sale with pending dues will appear here automatically.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredUnpaidSales.map(sale => {
                        const bal = Number(sale.balanceAmount || 0);
                        return (
                          <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                            <td>
                              <Link
                                href={`/sales/${sale.id}/print`}
                                target="_blank"
                                className="font-mono text-xs font-bold text-brand-600 hover:text-brand-800 hover:underline flex items-center gap-1"
                              >
                                <span>📄</span>
                                <span>{sale.invoiceNumber}</span>
                              </Link>
                              <span className="text-[10px] text-slate-400 block font-mono">{sale.paymentMethod || 'CREDIT'}</span>
                            </td>
                            <td className="text-xs text-slate-600">
                              {new Date(sale.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td>
                              <p className="font-semibold text-slate-900 text-xs">{sale.customer?.name || 'Walk-in / Counter'}</p>
                              {sale.customer?.phone && (
                                <span className="text-[11px] font-mono text-slate-500">{sale.customer.phone}</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${sale.paymentStatus === 'UNPAID' ? 'badge-danger' : 'badge-warning'}`}>
                                {sale.paymentStatus === 'UNPAID' ? 'Unpaid' : 'Partially Paid'}
                              </span>
                            </td>
                            <td className="text-right font-medium text-slate-700 text-xs">
                              {formatINR(sale.grandTotal)}
                            </td>
                            <td className="text-right text-emerald-700 text-xs font-medium">
                              {formatINR(sale.paidAmount)}
                            </td>
                            <td className="text-right">
                              <span className="inline-block font-mono text-xs font-bold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                                {formatINR(bal)}
                              </span>
                            </td>
                            <td className="text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenReceiveCust(sale.customerId, bal, sale.id)}
                                  className="btn-primary btn-xs bg-emerald-600 hover:bg-emerald-700 border-0 flex items-center gap-1"
                                  title="Receive payment for this bill"
                                >
                                  <span>⚡</span>
                                  <span>Collect</span>
                                </button>
                                <button
                                  onClick={() => window.open(`/sales/${sale.id}/print`, '_blank')}
                                  className="btn-secondary btn-xs flex items-center gap-1"
                                  title="View and print invoice"
                                >
                                  <span>🖨</span>
                                  <span>Bill</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-600">
                <p>Showing <strong>{filteredUnpaidSales.length}</strong> unpaid invoice(s)</p>
                <p>Total Unpaid Bill Dues: <strong className="text-red-600 font-bold">{formatINR(totalUnpaidSalesDueSum)}</strong></p>
              </div>
            </div>
          )}

          {/* SUB-VIEW 2: CUSTOMER ACCOUNTS TABLE */}
          {custDuesSubTab === 'customers' && (
            <div className="card overflow-hidden">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Phone</th>
                      <th>GSTIN / State</th>
                      <th>Credit Limit</th>
                      <th className="text-right">Outstanding Dues (बकाया)</th>
                      <th className="text-center">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customersLoading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(6)].map((_, j) => (
                            <td key={j}><div className="skeleton h-4 w-24" /></td>
                          ))}
                        </tr>
                      ))
                    ) : filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={6}>
                          <div className="empty-state py-12 text-center">
                            <p className="text-4xl mb-2">🎉</p>
                            <p className="text-slate-800 font-semibold">No outstanding customer dues found</p>
                            <p className="text-xs text-slate-400 mt-1">
                              All customer accounts are clear with zero pending balances!
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map(c => {
                        const balance = Number(c.currentBalance || 0);
                        const hasDue = balance > 0;

                        return (
                          <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                            <td>
                              <Link href={`/customers/${c.id}`} className="font-semibold text-slate-900 hover:text-brand-600 block">
                                {c.name}
                              </Link>
                              <span className="text-xs text-slate-400">{c.city || c.billingAddress || 'Local Customer'}</span>
                            </td>
                            <td>
                              <a href={`tel:${c.phone}`} className="text-xs font-mono text-slate-700 hover:text-brand-600">
                                {c.phone}
                              </a>
                            </td>
                            <td>
                              <span className="font-mono text-xs text-slate-600 block">{c.gstin || 'Unregistered'}</span>
                              <span className="text-[11px] text-slate-400">{c.state || 'Delhi (07)'}</span>
                            </td>
                            <td className="text-xs text-slate-500">
                              {c.creditLimit ? formatINR(c.creditLimit) : 'No Limit'}
                            </td>
                            <td className="text-right">
                              <span
                                className={`inline-block font-mono text-sm font-extrabold px-2.5 py-1 rounded-lg ${
                                  hasDue
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {formatINR(balance)}
                              </span>
                            </td>
                            <td className="text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {hasDue && (
                                  <>
                                    <button
                                      onClick={() => handleOpenReceiveCust(c.id, balance)}
                                      className="btn-primary btn-xs bg-emerald-600 hover:bg-emerald-700 border-0 flex items-center gap-1"
                                      title="Receive payment for this customer"
                                    >
                                      <span>➕</span>
                                      <span>Collect</span>
                                    </button>
                                    {c.phone && (
                                      <a
                                        href={getWhatsAppReminderUrl(c.phone, c.name, balance)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-secondary btn-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 flex items-center gap-1"
                                        title="Send WhatsApp payment reminder"
                                      >
                                        <span>💬</span>
                                        <span>WhatsApp</span>
                                      </a>
                                    )}
                                  </>
                                )}
                                <Link
                                  href={`/customers/${c.id}`}
                                  className="btn-secondary btn-xs"
                                  title="View customer ledger statement"
                                >
                                  Ledger →
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-600">
                <p>Showing <strong>{filteredCustomers.length}</strong> customer accounts</p>
                <p>Customer Balances Total: <strong className="text-red-600 font-bold">{formatINR(totalCustomerDuesSum)}</strong></p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: SUPPLIER PAYOUTS TABLE (आपूर्तिकर्ता भुगतान)                        */}
      {/* ========================================================================= */}
      {activeTab === 'supplier_payouts' && (
        <div className="space-y-4">
          <div className="card p-3 bg-white flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 max-w-sm w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                className="form-input pl-9 text-xs sm:text-sm w-full"
                placeholder="Search payment #, supplier, reference…"
                value={payoutSearch}
                onChange={e => setPayoutSearch(e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-500">
              Showing <strong>{filteredPayouts.length}</strong> recorded payouts
            </p>
          </div>

          <div className="card overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Payment Method</th>
                    <th>Reference / UTR</th>
                    <th>Notes</th>
                    <th className="text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(7)].map((_, j) => (
                          <td key={j}><div className="skeleton h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredPayouts.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state py-12 text-center">
                          <p className="text-4xl mb-2">🏭</p>
                          <p className="text-slate-800 font-semibold">No supplier payouts recorded yet</p>
                          <p className="text-xs text-slate-400 mt-1">Record outward payments made to vendors for purchase orders</p>
                          <button
                            onClick={() => handleOpenPaySupp()}
                            className="btn-primary btn-sm mt-3 bg-amber-600 hover:bg-amber-700"
                          >
                            + Record First Payout
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPayouts.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="font-mono text-xs font-semibold text-brand-600">
                          {pay.paymentNumber}
                        </td>
                        <td className="text-slate-500 text-xs whitespace-nowrap">
                          {new Date(pay.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td>
                          <span className="font-semibold text-slate-900 block">
                            {pay.supplier?.name || 'Supplier'}
                          </span>
                          {pay.supplier?.companyName && (
                            <span className="text-xs text-slate-400">{pay.supplier.companyName}</span>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-info">
                            {pay.paymentMethod}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-slate-500">
                          {pay.transactionReference || '—'}
                        </td>
                        <td className="text-xs text-slate-500 max-w-xs truncate">
                          {pay.notes || '—'}
                        </td>
                        <td className="text-right font-bold text-slate-900">
                          {formatINR(pay.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {Math.ceil(totalSupplierPayments / 20) > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">Page {supplierPage} of {Math.ceil(totalSupplierPayments / 20)}</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setSupplierPage(p => Math.max(1, p - 1))}
                    disabled={supplierPage === 1}
                    className="btn-secondary btn-sm"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setSupplierPage(p => p + 1)}
                    disabled={supplierPage >= Math.ceil(totalSupplierPayments / 20)}
                    className="btn-secondary btn-sm"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: SUPPLIER DUES TABLE (सप्लायर देनदारी / बकाया)                     */}
      {/* ========================================================================= */}
      {activeTab === 'supplier_dues' && (
        <div className="space-y-4">
          {/* Sub-tab navigation: Unpaid Purchase Bills vs Supplier Accounts */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setSuppDuesSubTab('bills')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                  suppDuesSubTab === 'bills'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📦</span>
                <span>Unpaid & Pending Purchase Bills</span>
                <span className="bg-purple-100 text-purple-800 text-[11px] px-1.5 py-0.5 rounded-full font-bold">
                  {unpaidPurchases.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSuppDuesSubTab('suppliers')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                  suppDuesSubTab === 'suppliers'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🏭</span>
                <span>Supplier Ledger Accounts</span>
                <span className="bg-purple-100 text-purple-800 text-[11px] px-1.5 py-0.5 rounded-full font-bold">
                  {suppliersWithDuesCount}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input
                  type="text"
                  className="form-input pl-9 text-xs sm:text-sm w-full"
                  placeholder={
                    suppDuesSubTab === 'bills'
                      ? 'Search bill #, supplier name, phone…'
                      : 'Search supplier name, company, GSTIN…'
                  }
                  value={suppDuesSubTab === 'bills' ? unpaidBillsSearch : suppSearch}
                  onChange={(e) =>
                    suppDuesSubTab === 'bills'
                      ? setUnpaidBillsSearch(e.target.value)
                      : setSuppSearch(e.target.value)
                  }
                />
              </div>

              {suppDuesSubTab === 'suppliers' && (
                <button
                  type="button"
                  onClick={() => setSuppDuesOnlyFilter(!suppDuesOnlyFilter)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all border whitespace-nowrap ${
                    suppDuesOnlyFilter
                      ? 'bg-purple-50 text-purple-800 border-purple-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {suppDuesOnlyFilter ? '✓ Only with Dues' : 'All Vendors'}
                </button>
              )}
            </div>
          </div>

          {/* SUB-TAB 1: UNPAID & PENDING PURCHASE BILLS */}
          {suppDuesSubTab === 'bills' && (
            <div className="card overflow-hidden">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Bill / Invoice #</th>
                      <th>Purchase Date</th>
                      <th>Dues Date (देय तिथि)</th>
                      <th>Supplier / Vendor</th>
                      <th className="text-right">Total Bill</th>
                      <th className="text-right">Paid Amount</th>
                      <th className="text-right">Balance Due</th>
                      <th>Status</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidPurchasesLoading ? (
                      [...Array(4)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(9)].map((_, j) => (
                            <td key={j}><div className="skeleton h-4 w-20" /></td>
                          ))}
                        </tr>
                      ))
                    ) : filteredUnpaidPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          <div className="empty-state py-12 text-center">
                            <p className="text-4xl mb-2">🎉</p>
                            <p className="text-slate-800 font-semibold">No unpaid purchase bills found</p>
                            <p className="text-xs text-slate-400 mt-1">All vendor purchases have been paid in full with zero pending dues!</p>
                            <Link href="/purchases" className="btn-primary btn-sm mt-3 inline-block">
                              + Record New Purchase
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredUnpaidPurchases.map((pur) => {
                        const total = Number(pur.totalAmount || 0);
                        const paid = Number(pur.paidAmount || 0);
                        const due = Number(pur.balanceAmount || 0);
                        const isOverdue = pur.expectedDate && new Date(pur.expectedDate) < new Date();

                        return (
                          <tr key={pur.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="font-mono text-xs font-bold text-purple-700">
                              {pur.supplierInvoiceNumber || pur.purchaseNumber}
                            </td>
                            <td className="text-slate-500 text-xs whitespace-nowrap">
                              {new Date(pur.purchaseDate).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td>
                              {pur.expectedDate ? (
                                <span
                                  className={`inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded font-bold ${
                                    isOverdue
                                      ? 'bg-red-100 text-red-700 border border-red-200'
                                      : 'bg-purple-50 text-purple-700 border border-purple-200'
                                  }`}
                                >
                                  <span>📅</span>
                                  <span>
                                    {new Date(pur.expectedDate).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </span>
                                  {isOverdue && <span className="text-[10px] text-red-600 font-semibold">(Overdue)</span>}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                            <td>
                              <span className="font-semibold text-slate-900 block">
                                {pur.supplier?.name || 'Supplier'}
                              </span>
                              {pur.supplier?.phone && (
                                <span className="text-xs text-slate-400">{pur.supplier.phone}</span>
                              )}
                            </td>
                            <td className="text-right font-mono font-medium text-slate-700">
                              {formatINR(total)}
                            </td>
                            <td className="text-right font-mono text-emerald-700 font-medium">
                              {formatINR(paid)}
                            </td>
                            <td className="text-right">
                              <span className="font-mono font-extrabold text-sm text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                {formatINR(due)}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  pur.paymentStatus === 'PARTIALLY_PAID'
                                    ? 'badge-warning'
                                    : 'badge-danger'
                                }`}
                              >
                                {pur.paymentStatus === 'PARTIALLY_PAID' ? 'PARTIAL' : pur.paymentStatus}
                              </span>
                            </td>
                            <td className="text-center">
                              <button
                                onClick={() => handleOpenPaySupp(pur.supplierId, due, pur.id)}
                                className="btn-primary btn-xs bg-purple-700 hover:bg-purple-800 border-0 flex items-center gap-1 mx-auto"
                                title="Pay this purchase bill"
                              >
                                <span>⚡</span>
                                <span>Pay Bill</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-600">
                <p>Showing <strong>{filteredUnpaidPurchases.length}</strong> unpaid purchase bill(s)</p>
                <p>Total Dues on Bills: <strong className="text-purple-700 font-bold">{formatINR(totalUnpaidPurchasesDueSum)}</strong></p>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: SUPPLIER LEDGER ACCOUNTS */}
          {suppDuesSubTab === 'suppliers' && (
            <div className="card overflow-hidden">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Supplier / Vendor</th>
                      <th>Phone</th>
                      <th>GSTIN / State</th>
                      <th>Purchases</th>
                      <th className="text-right">Amount Payable to Supplier</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliersLoading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(6)].map((_, j) => (
                            <td key={j}><div className="skeleton h-4 w-24" /></td>
                          ))}
                        </tr>
                      ))
                    ) : filteredSuppliers.length === 0 ? (
                      <tr>
                        <td colSpan={6}>
                          <div className="empty-state py-12 text-center">
                            <p className="text-4xl mb-2">🎉</p>
                            <p className="text-slate-800 font-semibold">No pending supplier payables</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {suppDuesOnlyFilter
                                ? 'All supplier purchase bills are paid with zero pending dues!'
                                : 'No suppliers match your search.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredSuppliers.map(s => {
                        const balance = Number(s.currentBalance || 0);
                        const hasDue = balance > 0;

                        return (
                          <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                            <td>
                              <p className="font-semibold text-slate-900 block">{s.name}</p>
                              {s.companyName && <span className="text-xs text-slate-400">{s.companyName}</span>}
                            </td>
                            <td>
                              <a href={`tel:${s.phone}`} className="text-xs font-mono text-slate-700 hover:text-brand-600">
                                {s.phone}
                              </a>
                            </td>
                            <td>
                              <span className="font-mono text-xs text-slate-600 block">{s.gstin || 'Unregistered'}</span>
                              <span className="text-[11px] text-slate-400">{s.state || '—'}</span>
                            </td>
                            <td>
                              <span className="badge badge-info">{s._count?.purchases || 0} bills</span>
                            </td>
                            <td className="text-right">
                              <span
                                className={`inline-block font-mono text-sm font-extrabold px-2.5 py-1 rounded-lg ${
                                  hasDue
                                    ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {formatINR(balance)}
                              </span>
                            </td>
                            <td className="text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {hasDue && (
                                  <button
                                    onClick={() => handleOpenPaySupp(s.id, balance)}
                                    className="btn-primary btn-xs bg-amber-600 hover:bg-amber-700 border-0 flex items-center gap-1"
                                    title="Pay supplier"
                                  >
                                    <span>💸</span>
                                    <span>Pay Supplier</span>
                                  </button>
                                )}
                                <Link
                                  href="/purchases"
                                  className="btn-secondary btn-xs"
                                  title="View supplier purchase orders"
                                >
                                  Orders →
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-600">
                <p>Showing <strong>{filteredSuppliers.length}</strong> suppliers</p>
                <p>Total Payable to Vendors: <strong className="text-purple-700 font-bold">{formatINR(totalSupplierDuesSum)}</strong></p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECEIVE CUSTOMER PAYMENT                                           */}
      {/* ========================================================================= */}
      {showCustModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="card max-w-md w-full p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Receive Customer Payment</h3>
                <p className="text-xs text-slate-500">Record customer inward payment against balance</p>
              </div>
              <button onClick={() => setShowCustModal(false)} className="btn-icon">✕</button>
            </div>

            <form onSubmit={handleRecordCustomerPayment} className="space-y-4">
              {custError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  {custError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label font-semibold text-slate-800">Customer *</label>
                <select
                  id="select-customer-payment"
                  className="form-select w-full"
                  value={selectedCustId}
                  onChange={(e) => {
                    setSelectedCustId(e.target.value);
                    const c = customers.find(x => x.id === e.target.value);
                    if (c?.currentBalance && Number(c.currentBalance) > 0) {
                      setCustAmount(String(c.currentBalance));
                    }
                  }}
                  required
                >
                  <option value="">Select a customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {Number(c.currentBalance) > 0 ? `(Pending Dues: ₹${Number(c.currentBalance).toLocaleString('en-IN')})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSaleObj && (
                <div className="p-3 bg-amber-50 rounded-xl text-xs space-y-1.5 text-amber-900 border border-amber-200">
                  <div className="flex justify-between items-center font-bold">
                    <span>🧾 Invoice Allocation:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">{selectedSaleObj.invoiceNumber}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedSaleId('')}
                        className="text-[11px] text-amber-700 hover:underline"
                        title="Remove invoice link and pay towards general account"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-amber-800">
                    <span>Invoice Grand Total:</span>
                    <span>{formatINR(selectedSaleObj.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center font-semibold">
                    <span>Balance Pending on Invoice:</span>
                    <span className="text-red-700 font-bold">{formatINR(selectedSaleObj.balanceAmount)}</span>
                  </div>
                </div>
              )}

              {selectedCustomerObj && !selectedSaleObj && (
                <div className="p-3 bg-blue-50/70 rounded-xl text-xs space-y-1.5 text-slate-700 border border-blue-100">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-600">Customer Balance / Dues:</span>
                    <span className="font-bold text-red-600 text-sm">{formatINR(selectedCustomerObj.currentBalance)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Phone:</span>
                    <span>{selectedCustomerObj.phone}</span>
                  </div>
                </div>
              )}

              {/* Optional: If customer has unpaid invoices and no invoice is linked, let user choose */}
              {selectedCustId && !selectedSaleId && (() => {
                const custUnpaidSales = unpaidSales.filter(s => s.customerId === selectedCustId);
                if (custUnpaidSales.length > 0) {
                  return (
                    <div className="form-group">
                      <label className="form-label text-xs font-semibold text-slate-700">Link to Specific Bill (Optional)</label>
                      <select
                        className="form-select w-full text-xs"
                        value={selectedSaleId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedSaleId(val);
                          const sale = custUnpaidSales.find(s => s.id === val);
                          if (sale?.balanceAmount) {
                            setCustAmount(String(sale.balanceAmount));
                          }
                        }}
                      >
                        <option value="">General Account (Settles ledger balance)</option>
                        {custUnpaidSales.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.invoiceNumber} — Due: ₹{Number(s.balanceAmount).toLocaleString('en-IN')} (Total: ₹{Number(s.grandTotal).toLocaleString('en-IN')})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="form-group">
                <label className="form-label font-semibold text-slate-800" htmlFor="cust-amt">Amount Received (₹) *</label>
                <input
                  id="cust-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input text-base font-semibold"
                  placeholder="0.00"
                  value={custAmount}
                  onChange={(e) => setCustAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label font-semibold text-slate-800">Payment Method *</label>
                <select
                  className="form-select w-full"
                  value={custMethod}
                  onChange={(e) => setCustMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="BANK_TRANSFER">Bank NEFT / RTGS</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label font-semibold text-slate-800">Reference / UTR #</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. UPI Ref / Cheque No"
                  value={custRef}
                  onChange={(e) => setCustRef(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label font-semibold text-slate-800">Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional payment notes"
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingCust}
                  className="btn-primary flex-1 justify-center bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
                >
                  {isSavingCust ? 'Recording…' : 'Save Payment Receipt'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PAY SUPPLIER (RECORD PAYOUT)                                       */}
      {/* ========================================================================= */}
      {showSuppModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="card max-w-md w-full p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Record Supplier Payout</h3>
                <p className="text-xs text-slate-500">Outward payment to vendor against purchase dues</p>
              </div>
              <button onClick={() => setShowSuppModal(false)} className="btn-icon">✕</button>
            </div>

            <form onSubmit={handleRecordSupplierPayment} className="space-y-4">
              {suppError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  {suppError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label font-semibold text-slate-800">Supplier *</label>
                <select
                  id="select-supplier-payment"
                  className="form-select w-full"
                  value={selectedSuppId}
                  onChange={(e) => {
                    setSelectedSuppId(e.target.value);
                    const s = suppliers.find(x => x.id === e.target.value);
                    if (s?.currentBalance && Number(s.currentBalance) > 0) {
                      setSuppAmount(String(s.currentBalance));
                    }
                  }}
                  required
                >
                  <option value="">Select a supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {Number(s.currentBalance) > 0 ? `(Payable: ₹${Number(s.currentBalance).toLocaleString('en-IN')})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPurchaseObj && (
                <div className="p-3 bg-purple-50 rounded-xl text-xs space-y-1.5 text-purple-900 border border-purple-200">
                  <div className="flex justify-between items-center font-bold">
                    <span>🧾 Purchase Bill Allocation:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-purple-100 px-1.5 py-0.5 rounded">
                        {selectedPurchaseObj.supplierInvoiceNumber || selectedPurchaseObj.purchaseNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedPurchaseId('')}
                        className="text-[11px] text-purple-700 hover:underline"
                        title="Remove bill link and pay towards general account"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-purple-800">
                    <span>Bill Grand Total:</span>
                    <span>{formatINR(selectedPurchaseObj.totalAmount)}</span>
                  </div>
                  {selectedPurchaseObj.expectedDate && (
                    <div className="flex justify-between items-center text-purple-800">
                      <span>Dues Date (देय तिथि):</span>
                      <span className="font-semibold">
                        {new Date(selectedPurchaseObj.expectedDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center font-semibold">
                    <span>Balance Due on Bill:</span>
                    <span className="text-red-700 font-bold">{formatINR(selectedPurchaseObj.balanceAmount)}</span>
                  </div>
                </div>
              )}

              {selectedSupplierObj && !selectedPurchaseObj && (
                <div className="p-3 bg-purple-50/70 rounded-xl text-xs space-y-1.5 text-slate-700 border border-purple-100">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-600">Amount Payable to Supplier:</span>
                    <span className="font-bold text-purple-700 text-sm">{formatINR(selectedSupplierObj.currentBalance)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Phone:</span>
                    <span>{selectedSupplierObj.phone}</span>
                  </div>
                </div>
              )}

              {/* Optional: If supplier has unpaid bills and no bill is linked, let user choose */}
              {selectedSuppId && !selectedPurchaseId && (() => {
                const suppUnpaidPurchases = unpaidPurchases.filter(p => p.supplierId === selectedSuppId);
                if (suppUnpaidPurchases.length > 0) {
                  return (
                    <div className="form-group">
                      <label className="form-label text-xs font-semibold text-slate-700">Link to Specific Bill (Optional)</label>
                      <select
                        className="form-select w-full text-xs"
                        value={selectedPurchaseId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedPurchaseId(val);
                          const pur = suppUnpaidPurchases.find(p => p.id === val);
                          if (pur?.balanceAmount) {
                            setSuppAmount(String(pur.balanceAmount));
                          }
                        }}
                      >
                        <option value="">General Account (Settles vendor balance)</option>
                        {suppUnpaidPurchases.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.supplierInvoiceNumber || p.purchaseNumber} — Due: ₹{Number(p.balanceAmount).toLocaleString('en-IN')} (Total: ₹{Number(p.totalAmount).toLocaleString('en-IN')})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="form-group">
                <label className="form-label font-semibold text-slate-800" htmlFor="supp-amt">Amount Paid (₹) *</label>
                <input
                  id="supp-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input text-base font-semibold"
                  placeholder="0.00"
                  value={suppAmount}
                  onChange={(e) => setSuppAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label font-semibold text-slate-800">Payment Method *</label>
                <select
                  className="form-select w-full"
                  value={suppMethod}
                  onChange={(e) => setSuppMethod(e.target.value)}
                >
                  <option value="BANK_TRANSFER">Bank NEFT / RTGS</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CARD">Corporate Card</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label font-semibold text-slate-800">Reference / UTR / Cheque #</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Bank UTR / Cheque No"
                  value={suppRef}
                  onChange={(e) => setSuppRef(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label font-semibold text-slate-800">Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional payment notes"
                  value={suppNotes}
                  onChange={(e) => setSuppNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingSupp}
                  className="btn-primary flex-1 justify-center bg-amber-600 hover:bg-amber-700 border-amber-600"
                >
                  {isSavingSupp ? 'Recording…' : 'Save Supplier Payout'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSuppModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
