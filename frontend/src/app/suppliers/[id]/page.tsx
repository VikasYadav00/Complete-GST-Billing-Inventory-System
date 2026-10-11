'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';

function formatINR(n: number | string | undefined | null) {
  if (n === undefined || n === null) return '₹0.00';
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | Date | undefined | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function SupplierStatementPage() {
  const router = useRouter();
  const params = useParams();
  const supplierId = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'items' | 'statement'>('items');
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Payment modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('BANK_TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [payError, setPayError] = useState('');

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    gstin: '',
    address: '',
    state: '',
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [successToast, setSuccessToast] = useState('');

  const loadStatement = useCallback(async () => {
    if (!supplierId) return;
    setIsLoading(true);
    setError('');
    try {
      const { data: res } = await api.get(`/purchases/suppliers/${supplierId}/statement`, {
        params: {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      setData(res.data);
      if (res.data?.summary?.currentBalance && Number(res.data.summary.currentBalance) > 0) {
        setPayAmount(String(res.data.summary.currentBalance));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load supplier statement');
    } finally {
      setIsLoading(false);
    }
  }, [supplierId, startDate, endDate]);

  useEffect(() => {
    loadStatement();
  }, [loadStatement]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      setPayError('Please enter a valid positive payment amount.');
      return;
    }

    setIsSubmittingPay(true);
    setPayError('');
    try {
      await api.post('/payments/supplier', {
        supplierId,
        amount: amt,
        paymentMethod: payMethod,
        transactionReference: payRef.trim() || undefined,
        notes: payNotes.trim() || `Payment made to ${data?.supplier?.companyName || data?.supplier?.name}`,
      });
      setShowPayModal(false);
      setPayNotes('');
      setPayRef('');
      setSuccessToast(`Payment of ${formatINR(amt)} successfully recorded.`);
      setTimeout(() => setSuccessToast(''), 4000);
      await loadStatement();
    } catch (err: any) {
      setPayError(err?.response?.data?.message || 'Failed to record supplier payment');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const openEditModal = () => {
    if (!data?.supplier) return;
    const s = data.supplier;
    setEditForm({
      name: s.name || '',
      companyName: s.companyName || '',
      phone: s.phone || '',
      email: s.email || '',
      gstin: s.gstin || '',
      address: s.address || '',
      state: s.state || '',
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      setEditError('Supplier contact name and phone number are required');
      return;
    }

    setIsSubmittingEdit(true);
    setEditError('');
    try {
      const payload: any = {
        name: editForm.name.trim(),
        companyName: editForm.companyName.trim() || null,
        phone: editForm.phone.trim(),
        email: editForm.email.trim() || null,
        gstin: editForm.gstin.trim() ? editForm.gstin.trim().toUpperCase() : null,
        address: editForm.address.trim() || null,
        state: editForm.state.trim() || null,
      };

      await api.put(`/purchases/suppliers/${supplierId}`, payload);
      setShowEditModal(false);
      setSuccessToast('Supplier details updated successfully!');
      setTimeout(() => setSuccessToast(''), 4000);
      await loadStatement();
    } catch (err: any) {
      const errData = err?.response?.data;
      if (errData?.errors && Array.isArray(errData.errors)) {
        setEditError(errData.errors.map((e: any) => `${e.field ? `${e.field}: ` : ''}${e.message}`).join(', '));
      } else {
        setEditError(errData?.message || 'Failed to update supplier details');
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/purchases/suppliers/${supplierId}`);
      router.push('/suppliers');
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || 'Failed to delete supplier');
      setIsDeleting(false);
    }
  };

  const handleWhatsAppReminder = () => {
    if (!data?.supplier) return;
    const s = data.supplier;
    const phone = s.phone?.replace(/\D/g, '') || '';
    const balance = data.summary?.currentBalance || 0;
    const text = encodeURIComponent(
      `Namaste ${s.name} (${s.companyName || 'Supplier'}),\n` +
      `Regarding our procurement account:\n` +
      `• Total Purchases: ${formatINR(data.summary?.totalPurchased)}\n` +
      `• Total Paid: ${formatINR(data.summary?.totalPaid)}\n` +
      `• Current Balance Payable: ${formatINR(balance)}\n` +
      `Please let us know if any statement reconciliation is needed. Thank you!`
    );
    window.open(`https://wa.me/91${phone}?text=${text}`, '_blank');
  };

  if (isLoading && !data) {
    return (
      <AppShell title="Supplier Statement" subtitle="Loading purchase party ledger…">
        <div className="space-y-4">
          <div className="card p-6 h-36 skeleton" />
          <div className="card p-6 h-64 skeleton" />
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell title="Supplier Statement" subtitle="Error">
        <div className="card p-8 text-center max-w-md mx-auto">
          <p className="text-3xl mb-2">⚠️</p>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Supplier Not Found</h2>
          <p className="text-slate-500 text-sm mb-4">{error || 'The requested supplier does not exist.'}</p>
          <Link href="/suppliers" className="btn-primary inline-flex">← Back to Suppliers</Link>
        </div>
      </AppShell>
    );
  }

  const { supplier, purchases = [], statement = [], summary } = data;
  const currentBalance = Number(summary?.currentBalance || 0);

  return (
    <AppShell
      title={`${supplier.companyName || supplier.name} — Purchase History & Statement`}
      subtitle={`Complete procurement ledger: items received, dates, and balance summary`}
    >
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Link href="/suppliers" className="btn-secondary btn-sm">← Back to Suppliers</Link>
          <span className={`badge ${currentBalance > 0 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'badge-success'}`}>
            {currentBalance > 0 ? `Payable Dues (देय बकाया): ${formatINR(currentBalance)}` : 'Account Settled ✓'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-pay-supplier"
            onClick={() => {
              setPayAmount(currentBalance > 0 ? String(currentBalance) : '');
              setShowPayModal(true);
            }}
            className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-700 border-emerald-600 flex items-center gap-1"
          >
            💳 Pay Supplier (भुगतान करें)
          </button>

          <Link
            href="/purchases"
            className="btn-secondary btn-sm text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100 font-semibold flex items-center gap-1"
            title="Record new purchase order or invoice from this supplier"
          >
            🛒 + New Purchase (माल खरीदें)
          </Link>

          <button
            id="btn-edit-supplier-details"
            onClick={openEditModal}
            className="btn-secondary btn-sm text-slate-700 hover:text-brand-700 hover:border-brand-300 font-semibold flex items-center gap-1"
            title="Edit phone, email, GSTIN, or address"
          >
            ✏️ Edit Details
          </button>

          {supplier.phone && (
            <button
              onClick={handleWhatsAppReminder}
              className="btn-secondary btn-sm text-emerald-700 hover:bg-emerald-50 border-emerald-300 flex items-center gap-1"
              title="Send account statement via WhatsApp"
            >
              💬 WhatsApp
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="btn-secondary btn-sm flex items-center gap-1"
            title="Print Statement"
          >
            🖨️ Print
          </button>

          <button
            id="btn-delete-supplier-profile"
            onClick={() => { setShowDeleteModal(true); setDeleteError(''); }}
            className="btn-secondary btn-sm text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            title="Delete this purchase party"
          >
            🗑️
          </button>
        </div>
      </div>

      {successToast && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center justify-between animate-fade-in">
          <span>✓ {successToast}</span>
          <button onClick={() => setSuccessToast('')} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Supplier Profile Card & Key Financial Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-5 lg:col-span-2 border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/20">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🏭</span>
                <h2 className="text-lg font-bold text-slate-900">
                  {supplier.companyName || supplier.name}
                </h2>
              </div>
              {supplier.companyName && (
                <p className="text-xs text-slate-600 font-medium mt-0.5">Proprietor / Contact: {supplier.name}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                📞 <span className="font-mono font-semibold">{supplier.phone}</span>
                {supplier.email && <span> | ✉️ {supplier.email}</span>}
              </p>
              {supplier.gstin && (
                <p className="text-xs font-mono bg-white border border-slate-200 inline-block px-2 py-0.5 rounded mt-2 shadow-2xs">
                  GSTIN: <span className="font-bold text-slate-800">{supplier.gstin}</span>
                </p>
              )}
              {(supplier.address || supplier.state) && (
                <p className="text-xs text-slate-600 mt-2">
                  📍 {[supplier.address, supplier.state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg flex-shrink-0">
              {supplier.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="card p-5 border-l-4 border-l-purple-500 bg-gradient-to-br from-white to-purple-50/20">
          <p className="stat-label text-purple-900 font-semibold">Total Purchased (कुल खरीद)</p>
          <p className="stat-value text-slate-900 mt-1">{formatINR(summary?.totalPurchased)}</p>
          <p className="text-xs text-slate-500 mt-1">{summary?.totalPurchasesCount || 0} purchase bills recorded</p>
        </div>

        <div className="card p-5 border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/20">
          <p className="stat-label text-emerald-900 font-semibold">Total Paid (कुल दिया गया)</p>
          <p className="stat-value text-emerald-700 mt-1">{formatINR(summary?.totalPaid)}</p>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Balance Owed:</span>
            <span className={`font-bold ${currentBalance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {formatINR(currentBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Date Filter Bar & Tab Navigation */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Two Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'items'
                  ? 'bg-white text-purple-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📦</span> Invoices & Items Received (क्या लिया, कब लिया) ({purchases.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('statement')}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'statement'
                  ? 'bg-white text-brand-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📊</span> Complete Ledger / Khata (पूरा हिसाब) ({statement.length})
            </button>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="form-input text-xs py-1.5"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              title="Start Date"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              className="form-input text-xs py-1.5"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              title="End Date"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="btn-secondary btn-sm text-xs py-1.5"
                title="Clear date filter"
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TAB 1: Items & Purchases Received (क्या लिया, कब लिया) */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {purchases.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-4xl mb-3">📦</p>
              <h3 className="text-base font-bold text-slate-800">No purchases found from this supplier</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Record purchase invoices in the Purchases section to see the itemized list here.
              </p>
              <Link href="/purchases" className="btn-primary btn-sm inline-flex items-center gap-1">
                + Go to Purchases
              </Link>
            </div>
          ) : (
            purchases.map((p: any) => {
              const isExpanded = expandedPurchaseId === p.id || purchases.length === 1;
              const isPaid = p.paymentStatus === 'PAID';
              const isPartial = p.paymentStatus === 'PARTIALLY_PAID';

              return (
                <div key={p.id} className="card overflow-hidden transition-all hover:shadow-md border border-slate-200">
                  {/* Purchase Header / Summary Banner */}
                  <div
                    onClick={() => setExpandedPurchaseId(isExpanded && purchases.length > 1 ? null : p.id)}
                    className="p-4 bg-slate-50/80 hover:bg-slate-100/80 cursor-pointer flex flex-wrap items-center justify-between gap-3 border-b border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-base flex-shrink-0">
                        📦
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">
                            {p.purchaseNumber}
                          </h4>
                          {p.supplierInvoiceNumber && (
                            <span className="badge bg-slate-200 text-slate-700 text-[10px] font-mono">
                              Bill: {p.supplierInvoiceNumber}
                            </span>
                          )}
                          <span
                            className={`badge text-[10px] font-semibold ${
                              isPaid
                                ? 'badge-success'
                                : isPartial
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'badge-danger'
                            }`}
                          >
                            {p.paymentStatus || 'UNPAID'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          📅 Date: <span className="font-semibold text-slate-700">{formatDate(p.purchaseDate)}</span>
                          {p.status && <span className="ml-2 font-medium text-slate-600">· Status: {p.status}</span>}
                          <span className="ml-2 text-purple-700 font-semibold">· {p.items?.length || 0} Products</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Bill Amount (कुल बिल)</p>
                        <p className="font-bold text-slate-900 text-base">{formatINR(p.totalAmount)}</p>
                        {Number(p.balanceAmount) > 0 && (
                          <p className="text-[11px] text-red-600 font-semibold">
                            Balance Due: {formatINR(p.balanceAmount)}
                          </p>
                        )}
                      </div>
                      <span className="text-slate-400 text-sm transition-transform">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Expandable Items Table (सामान का पूरा विवरण) */}
                  {isExpanded && (
                    <div className="p-4 bg-white animate-fade-in">
                      <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <span>📋</span> Items Received (सामान की सूची):
                      </h5>
                      <div className="table-container border border-slate-100 rounded-lg overflow-hidden">
                        <table className="table text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-600">
                              <th>#</th>
                              <th>Product (सामान का नाम)</th>
                              <th>Quantity Received (मात्रा)</th>
                              <th>Purchase Rate (खरीद भाव)</th>
                              <th>GST %</th>
                              <th>Total Amount (कुल भाव)</th>
                              <th>Batch / Expiry</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.items?.map((item: any, idx: number) => (
                              <tr key={item.id || idx}>
                                <td className="text-slate-400 font-mono">{idx + 1}</td>
                                <td>
                                  <div>
                                    <p className="font-bold text-slate-900">{item.product?.name || 'Item'}</p>
                                    {item.product?.sku && (
                                      <p className="text-[10px] text-slate-400 font-mono">SKU: {item.product.sku}</p>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <span className="font-bold text-slate-800 bg-purple-50 text-purple-800 px-2 py-0.5 rounded font-mono">
                                    {Number(item.receivedQuantity ?? item.orderedQuantity ?? 0)} {item.product?.unit || 'PCS'}
                                  </span>
                                </td>
                                <td className="font-mono font-medium text-slate-700">
                                  {formatINR(item.unitCost)} / {item.product?.unit || 'PCS'}
                                </td>
                                <td>
                                  <span className="badge bg-slate-100 text-slate-700 text-[10px]">
                                    {Number(item.gstRate || 0)}%
                                  </span>
                                </td>
                                <td className="font-bold font-mono text-slate-900">
                                  {formatINR(item.totalAmount)}
                                </td>
                                <td className="text-[11px] text-slate-500 font-mono">
                                  {item.batchNumber ? `Batch: ${item.batchNumber}` : '—'}
                                  {item.expiryDate && ` (Exp: ${formatDate(item.expiryDate)})`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {p.notes && (
                        <p className="text-xs text-slate-500 mt-2.5 bg-slate-50 p-2 rounded border border-slate-100">
                          📝 <strong>Notes:</strong> {p.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: Complete Ledger Statement (पूरा हिसाब-किताब) */}
      {activeTab === 'statement' && (
        <div className="card">
          <div className="table-container">
            <table className="table text-xs">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transaction Type</th>
                  <th>Reference / Invoice #</th>
                  <th>Purchased Amount (+)</th>
                  <th>Paid Amount (-)</th>
                  <th>Balance Due (देय बकाया)</th>
                  <th>Mode / Notes</th>
                </tr>
              </thead>
              <tbody>
                {statement.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      No financial transactions found for this period.
                    </td>
                  </tr>
                ) : (
                  statement.map((entry: any, i: number) => {
                    const isPurchase = entry.type === 'PURCHASE';

                    return (
                      <tr key={i} className={isPurchase ? 'bg-purple-50/20' : 'bg-emerald-50/20'}>
                        <td className="font-mono text-slate-600 font-medium">
                          {formatDate(entry.date)}
                        </td>
                        <td>
                          <span
                            className={`badge text-[11px] font-semibold flex items-center gap-1 w-max ${
                              isPurchase
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            <span>{isPurchase ? '📦' : '💳'}</span>
                            {isPurchase ? 'Purchase Bill (खरीद)' : 'Payment Paid (भुगतान)'}
                          </span>
                        </td>
                        <td className="font-mono font-medium text-slate-800">
                          {entry.referenceNumber}
                          {entry.supplierInvoiceNumber && (
                            <span className="block text-[10px] text-slate-400">
                              Bill: {entry.supplierInvoiceNumber}
                            </span>
                          )}
                        </td>
                        <td className="font-mono font-semibold text-purple-800">
                          {entry.credit > 0 ? `+ ${formatINR(entry.credit)}` : '—'}
                        </td>
                        <td className="font-mono font-semibold text-emerald-700">
                          {entry.debit > 0 ? `- ${formatINR(entry.debit)}` : '—'}
                        </td>
                        <td className="font-mono font-bold text-slate-900">
                          {formatINR(entry.runningBalance)}
                        </td>
                        <td className="text-slate-500 max-w-xs truncate">
                          {entry.paymentMethod && <span className="badge bg-slate-100 mr-1">{entry.paymentMethod}</span>}
                          {entry.notes || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment to Supplier Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">💳</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pay Supplier (सप्लायर को भुगतान करें)
                  </h3>
                  <p className="text-xs text-slate-500">Record payments made to {supplier.companyName || supplier.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="btn-icon"
              >
                ✕
              </button>
            </div>

            {currentBalance > 0 && (
              <div className="p-3 mb-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                <span>Current Balance Due (वर्तमान देय बकाया):</span>
                <span className="font-bold text-sm text-red-600">{formatINR(currentBalance)}</span>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              {payError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  ⚠ {payError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label font-semibold">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="form-input text-base font-mono font-bold text-slate-900"
                  placeholder="0.00"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method *</label>
                <select
                  className="form-select font-medium"
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                  <option value="CASH">Cash (नकद)</option>
                  <option value="CHEQUE">Cheque (चेक)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Transaction Reference (Optional)</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  placeholder="e.g. UTR12345678 or Cheque #0045"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Cleared payment for October consignment"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  disabled={isSubmittingPay}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="btn-primary min-w-[140px] justify-center bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
                >
                  {isSubmittingPay ? 'Recording…' : '💾 Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Details Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Supplier Details (सप्लायर सुधारें)
                  </h3>
                  <p className="text-xs text-slate-500">Update contact phone, email, firm or GST info</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="btn-icon"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {editError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  ⚠ {editError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Firm / Agency / Company Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. IFFCO Fertilizers Ltd"
                  value={editForm.companyName}
                  onChange={e => setEditForm(f => ({ ...f, companyName: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contact Person Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Rajesh Kumar"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    className="form-input font-mono"
                    placeholder="10-digit mobile"
                    value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email (Optional)</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="vendor@example.com"
                    value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">GSTIN (Optional)</label>
                  <input
                    type="text"
                    className="form-input font-mono uppercase"
                    placeholder="15-character GSTIN"
                    maxLength={15}
                    value={editForm.gstin}
                    onChange={e => setEditForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Uttar Pradesh"
                    value={editForm.state}
                    onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea
                  rows={2}
                  className="form-input resize-none"
                  placeholder="Warehouse / Office address"
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSubmittingEdit}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="btn-primary min-w-[120px] justify-center"
                >
                  {isSubmittingEdit ? 'Saving…' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-lg font-bold">
                🗑️
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete Supplier (सप्लायर हटाएं)?
                </h3>
                <p className="text-xs text-slate-500">
                  {supplier.companyName ? `${supplier.companyName} (${supplier.name})` : supplier.name}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete this purchase party? They will be removed from your active suppliers list.
            </p>

            {currentBalance > 0 && (
              <div className="p-3 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                ⚠️ <strong>Outstanding Balance:</strong> You currently owe this supplier{' '}
                <span className="font-bold text-red-700">{formatINR(currentBalance)}</span>.
              </div>
            )}

            {deleteError && (
              <div className="p-3 mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                ⚠ {deleteError}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {isDeleting ? 'Deleting…' : '🗑️ Delete Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
