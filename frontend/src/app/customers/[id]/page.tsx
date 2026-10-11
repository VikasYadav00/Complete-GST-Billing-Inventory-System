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

export default function CustomerStatementPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Payment modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [payError, setPayError] = useState('');

  // Edit party modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    customerType: 'RETAIL' as 'RETAIL' | 'WHOLESALE',
    companyName: '',
    name: '',
    phone: '',
    email: '',
    gstin: '',
    creditLimit: '',
    address: '',
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const openEditModal = () => {
    if (!data?.customer) return;
    const c = data.customer;
    setEditForm({
      customerType: c.customerType || 'RETAIL',
      companyName: c.companyName || '',
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      gstin: c.gstin || '',
      creditLimit: c.creditLimit ? String(c.creditLimit) : '',
      address: c.billingAddress || c.address || '',
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      setEditError('Party/Customer name and phone number are required');
      return;
    }
    if (editForm.customerType === 'WHOLESALE' && !editForm.companyName.trim()) {
      setEditError('Firm / Company Name is required for Wholesale Parties');
      return;
    }

    setIsSubmittingEdit(true);
    setEditError('');
    try {
      const payload: any = {
        customerType: editForm.customerType,
        companyName: editForm.companyName.trim() || null,
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim() || null,
        gstin: editForm.gstin.trim() ? editForm.gstin.trim().toUpperCase() : null,
        creditLimit: editForm.creditLimit ? Number(editForm.creditLimit) : null,
        billingAddress: editForm.address.trim() || null,
      };

      await api.put(`/customers/${customerId}`, payload);
      setShowEditModal(false);
      setSuccessToast('Party details updated successfully!');
      setTimeout(() => setSuccessToast(''), 4000);
      await loadStatement();
    } catch (err: any) {
      const errData = err?.response?.data;
      if (errData?.errors && Array.isArray(errData.errors)) {
        setEditError(errData.errors.map((e: any) => `${e.field ? `${e.field}: ` : ''}${e.message}`).join(', '));
      } else {
        setEditError(errData?.message || 'Failed to update party details');
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const loadStatement = useCallback(async () => {
    if (!customerId) return;
    setIsLoading(true);
    setError('');
    try {
      const { data: res } = await api.get(`/customers/${customerId}/statement`, {
        params: {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      setData(res.data);
      if (res.data?.currentBalance) {
        setPayAmount(String(res.data.currentBalance));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load customer statement');
    } finally {
      setIsLoading(false);
    }
  }, [customerId, startDate, endDate]);

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
      await api.post('/payments/customer', {
        customerId,
        amount: amt,
        paymentMethod: payMethod,
        transactionReference: payRef || undefined,
        notes: payNotes || `Account payment received for ${data?.customer?.name}`,
      });
      setShowPayModal(false);
      setPayNotes('');
      setPayRef('');
      await loadStatement();
    } catch (err: any) {
      setPayError(err?.response?.data?.message || 'Failed to record payment');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleWhatsAppReminder = () => {
    if (!data?.customer) return;
    const phone = data.customer.phone?.replace(/\D/g, '') || '';
    const text = encodeURIComponent(
      `Hello ${data.customer.name},\nThis is a friendly reminder from *Sharma Agro & Retail Enterprises*.\n` +
      `Your current outstanding balance is *${formatINR(data.currentBalance)}*.\n` +
      `You can make payment via UPI at *sharmaagro@sbi*.\n` +
      `Thank you for your valued partnership!`
    );
    window.open(`https://wa.me/${phone ? (phone.startsWith('91') ? phone : `91${phone}`) : ''}?text=${text}`, '_blank');
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/customers/${customerId}`);
      router.push('/customers');
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || 'Failed to delete party');
      setIsDeleting(false);
    }
  };

  if (isLoading && !data) {
    return (
      <AppShell title="Customer Statement" subtitle="Loading customer ledger…">
        <div className="space-y-4">
          <div className="card p-6 h-36 skeleton" />
          <div className="card p-6 h-64 skeleton" />
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell title="Customer Statement" subtitle="Error">
        <div className="card p-8 text-center max-w-md mx-auto">
          <p className="text-3xl mb-2">⚠️</p>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Customer Not Found</h2>
          <p className="text-slate-500 text-sm mb-4">{error || 'The requested customer does not exist.'}</p>
          <Link href="/customers" className="btn-primary inline-flex">← Back to Customers</Link>
        </div>
      </AppShell>
    );
  }

  const { customer, currentBalance, statement = [], totalBilled, totalPaid } = data;

  return (
    <AppShell
      title={`${customer.companyName || customer.name} — Statement`}
      subtitle={`Account Ledger & Transaction History (${statement.length} entries)`}
    >
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Link href="/customers" className="btn-secondary btn-sm">← Back to Customers</Link>
          <span className={`badge ${currentBalance > 0 ? 'badge-danger' : 'badge-success'}`}>
            {currentBalance > 0 ? `Dues: ${formatINR(currentBalance)}` : 'All Clear ✓'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentBalance > 0 && (
            <button
              onClick={handleWhatsAppReminder}
              className="btn-secondary btn-sm text-emerald-700 hover:bg-emerald-50 border-emerald-300"
            >
              💬 WhatsApp Reminder
            </button>
          )}

          <button
            id="btn-edit-customer-details"
            onClick={openEditModal}
            className="btn-secondary btn-sm text-slate-700 hover:text-brand-700 hover:border-brand-300 font-semibold flex items-center gap-1"
            title="Edit phone number, email, firm, or GST details"
          >
            ✏️ Edit Details
          </button>

          <button
            id="btn-receive-customer-pay"
            onClick={() => setShowPayModal(true)}
            className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
          >
            💳 Receive Payment
          </button>

          <button
            id="btn-delete-customer-profile"
            onClick={() => { setShowDeleteModal(true); setDeleteError(''); }}
            className="btn-secondary btn-sm text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            🗑️ Delete Party
          </button>
        </div>
      </div>

      {successToast && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center justify-between animate-fade-in">
          <span>✓ {successToast}</span>
          <button onClick={() => setSuccessToast('')} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Customer Info Card & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{customer.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">📞 {customer.phone} {customer.email && `| ✉️ ${customer.email}`}</p>
              {customer.gstin && (
                <p className="text-xs font-mono bg-slate-50 border border-slate-200 inline-block px-2 py-0.5 rounded mt-2">
                  GSTIN: <span className="font-bold">{customer.gstin}</span>
                </p>
              )}
              {(customer.billingAddress || customer.address) && (
                <p className="text-xs text-slate-600 mt-2">📍 {customer.billingAddress || customer.address}</p>
              )}
            </div>
            <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-lg">
              {customer.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <p className="stat-label">Total Invoiced</p>
          <p className="stat-value text-slate-900 mt-1">{formatINR(totalBilled)}</p>
          <p className="text-xs text-slate-500 mt-1">Total goods billed</p>
        </div>

        <div className="card p-5">
          <p className="stat-label">Outstanding Balance</p>
          <p className={`stat-value mt-1 ${currentBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {formatINR(currentBalance)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Paid: {formatINR(totalPaid)}</p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 text-sm">Account Ledger Statement</h3>
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              className="form-input text-xs py-1 px-2 w-36"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="From Date"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              className="form-input text-xs py-1 px-2 w-36"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="To Date"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="btn-secondary btn-sm text-xs py-1 px-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Ref / Invoice #</th>
                <th>Payment Mode</th>
                <th>Notes</th>
                <th className="text-right">Debit (+)</th>
                <th className="text-right">Credit (-)</th>
                <th className="text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {statement.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <p className="text-3xl mb-2">📜</p>
                      <p className="text-sm">No ledger entries recorded for this period.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                statement.map((item: any, idx: number) => (
                  <tr key={idx} className={item.type === 'PAYMENT' ? 'bg-emerald-50/30' : ''}>
                    <td className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <span className={`badge ${item.type === 'INVOICE' ? 'badge-info' : 'badge-success'}`}>
                        {item.type === 'INVOICE' ? '🧾 Invoice' : '💳 Payment'}
                      </span>
                    </td>
                    <td className="font-mono text-xs font-semibold">
                      {item.type === 'INVOICE' ? (
                        <span className="text-brand-600">{item.referenceNumber}</span>
                      ) : (
                        item.referenceNumber
                      )}
                    </td>
                    <td className="text-xs text-slate-600">{item.paymentMethod || '—'}</td>
                    <td className="text-xs text-slate-500 max-w-[200px] truncate">{item.notes || '—'}</td>
                    <td className="text-right font-medium text-slate-900">
                      {item.debit > 0 ? formatINR(item.debit) : '—'}
                    </td>
                    <td className="text-right font-medium text-emerald-600">
                      {item.credit > 0 ? formatINR(item.credit) : '—'}
                    </td>
                    <td className="text-right font-bold font-mono text-slate-900">
                      {formatINR(item.runningBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Receive Payment</h3>
                <p className="text-xs text-slate-500">Crediting {customer.name} Account</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="btn-icon">✕</button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              {payError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  {payError}
                </div>
              )}

              <div className="p-3 bg-blue-50 rounded-lg text-xs space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span>Current Outstanding:</span>
                  <span className="font-bold text-red-600">{formatINR(currentBalance)}</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="cust-pay-amt">Amount Received (₹) *</label>
                <input
                  id="cust-pay-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method *</label>
                <select
                  className="form-select"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="BANK_TRANSFER">Bank NEFT / RTGS</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Reference / UTR / Cheque #</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. UPI Ref / Bank UTR"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. October sowing installment"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="btn-primary flex-1 justify-center"
                >
                  {isSubmittingPay ? 'Recording…' : 'Save Payment'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="btn-secondary"
                >
                  Cancel
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
                  Delete {customer.customerType === 'WHOLESALE' ? 'Wholesale Party (थोक पार्टी)' : 'Customer (ग्राहक)'}?
                </h3>
                <p className="text-xs text-slate-500">
                  {customer.companyName ? `${customer.companyName} (${customer.name})` : customer.name}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete this {customer.customerType === 'WHOLESALE' ? 'wholesale party' : 'customer'}?
              They will be removed from your active parties list and billing search.
            </p>

            {Number(currentBalance) > 0 && (
              <div className="p-3 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                ⚠️ <strong>Outstanding Balance:</strong> This party currently has an unpaid balance of{' '}
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
                id="btn-confirm-delete-party-statement"
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>🗑️ Delete Party</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Party Details Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Party Details (पार्टी विवरण सुधारें)
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

              {/* Party Type Selector */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setEditForm(f => ({ ...f, customerType: 'RETAIL' }))}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    editForm.customerType === 'RETAIL' ? 'bg-white text-brand-700 shadow-sm font-bold' : 'text-slate-600'
                  }`}
                >
                  <span>👤</span> Retail Customer (खुदरा)
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm(f => ({ ...f, customerType: 'WHOLESALE' }))}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    editForm.customerType === 'WHOLESALE' ? 'bg-purple-600 text-white shadow-sm font-bold' : 'text-slate-600'
                  }`}
                >
                  <span>🏢</span> Wholesale Party (थोक)
                </button>
              </div>

              {editForm.customerType === 'WHOLESALE' && (
                <div className="form-group bg-purple-50/60 p-3 rounded-xl border border-purple-200">
                  <label className="form-label text-purple-900 font-semibold">Firm / Company Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input bg-white border-purple-300 focus:border-purple-600"
                    placeholder="e.g. Kisan Khad Beej Bhandar"
                    value={editForm.companyName}
                    onChange={e => setEditForm(f => ({ ...f, companyName: e.target.value }))}
                  />
                  <p className="text-[10px] text-purple-700 mt-1">Shop, Agency, or Business name</p>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  {editForm.customerType === 'WHOLESALE' ? 'Proprietor / Contact Person Name *' : 'Customer Name *'}
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder={editForm.customerType === 'WHOLESALE' ? 'e.g. Ramesh Kumar' : 'e.g. Amit Sharma'}
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
                  <label className="form-label">Email Address (Optional)</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="client@example.com"
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
                  <label className="form-label">Credit Limit (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    className="form-input"
                    placeholder="e.g. 50000"
                    value={editForm.creditLimit}
                    onChange={e => setEditForm(f => ({ ...f, creditLimit: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea
                  rows={2}
                  className="form-input resize-none"
                  placeholder="Village / Town / Shop Address"
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
    </AppShell>
  );
}
