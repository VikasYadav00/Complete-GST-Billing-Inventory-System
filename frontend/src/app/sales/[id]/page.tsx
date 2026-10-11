'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

function formatINR(n: number | string | undefined | null) {
  if (n === undefined || n === null) return '₹0.00';
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const saleId = params?.id as string;

  const [sale, setSale] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Payment modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [payError, setPayError] = useState('');

  // Cancel sale state
  const [isCancelling, setIsCancelling] = useState(false);

  const loadSale = useCallback(async () => {
    if (!saleId) return;
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/sales/${saleId}`);
      setSale(data.data);
      if (data.data?.balanceAmount) {
        setPayAmount(String(data.data.balanceAmount));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load sale details');
    } finally {
      setIsLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    loadSale();
  }, [loadSale]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale?.customerId) {
      setPayError('Walk-in sales without registered customer cannot accept delayed payment allocation.');
      return;
    }
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      setPayError('Please enter a valid positive payment amount.');
      return;
    }
    if (amt > Number(sale.balanceAmount)) {
      setPayError(`Payment cannot exceed outstanding balance of ${formatINR(sale.balanceAmount)}.`);
      return;
    }

    setIsSubmittingPay(true);
    setPayError('');
    try {
      await api.post('/payments/customer', {
        customerId: sale.customerId,
        amount: amt,
        paymentMethod: payMethod,
        transactionReference: payRef || undefined,
        notes: payNotes || `Payment received for ${sale.invoiceNumber}`,
        specificSaleId: sale.id,
      });
      setShowPayModal(false);
      setPayNotes('');
      setPayRef('');
      await loadSale();
    } catch (err: any) {
      setPayError(err?.response?.data?.message || 'Failed to record payment');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleCancelSale = async () => {
    if (!confirm('Are you sure you want to cancel this invoice? This will mark it CANCELLED.')) return;
    setIsCancelling(true);
    try {
      await api.post(`/sales/${sale.id}/cancel`);
      await loadSale();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to cancel invoice');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleWhatsAppShare = () => {
    if (!sale) return;
    const phone = sale.customer?.phone?.replace(/\D/g, '') || '';
    const text = encodeURIComponent(
      `Hello ${sale.customer?.name || 'Customer'},\nThank you for your business! Here are the details of your invoice *${sale.invoiceNumber}*:\n` +
      `Date: ${new Date(sale.invoiceDate).toLocaleDateString('en-IN')}\n` +
      `Total: ${formatINR(sale.grandTotal)}\n` +
      `Paid: ${formatINR(sale.paidAmount)}\n` +
      `Balance Due: ${formatINR(sale.balanceAmount)}\n\n` +
      `Thank you!\nSharma Agro & Retail Enterprises`
    );
    window.open(`https://wa.me/${phone ? (phone.startsWith('91') ? phone : `91${phone}`) : ''}?text=${text}`, '_blank');
  };

  if (isLoading) {
    return (
      <AppShell title="Invoice Details" subtitle="Loading invoice…">
        <div className="space-y-4">
          <div className="card p-6 h-32 skeleton" />
          <div className="card p-6 h-64 skeleton" />
        </div>
      </AppShell>
    );
  }

  if (error || !sale) {
    return (
      <AppShell title="Invoice Details" subtitle="Error">
        <div className="card p-8 text-center max-w-md mx-auto">
          <p className="text-3xl mb-2">⚠️</p>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Invoice Not Found</h2>
          <p className="text-slate-500 text-sm mb-4">{error || 'The requested invoice does not exist.'}</p>
          <Link href="/sales" className="btn-primary inline-flex">← Back to Invoices</Link>
        </div>
      </AppShell>
    );
  }

  const isInterState = Boolean(sale.isInterState || Number(sale.igstAmount) > 0);
  const balanceDue = Number(sale.balanceAmount);

  return (
    <AppShell
      title={`Invoice ${sale.invoiceNumber}`}
      subtitle={`Created on ${new Date(sale.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
    >
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Link href="/sales" className="btn-secondary btn-sm">← Back to Invoices</Link>
          <span className={`badge ${sale.status === 'FINAL' ? 'badge-success' : 'badge-danger'}`}>
            {sale.status}
          </span>
          <span className={`badge ${sale.paymentStatus === 'PAID' ? 'badge-success' : sale.paymentStatus === 'PARTIAL' ? 'badge-warning' : 'badge-danger'}`}>
            {sale.paymentStatus}
          </span>
          {sale.isGstInvoice && <span className="badge badge-info">GST Tax Invoice</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {balanceDue > 0 && sale.status !== 'CANCELLED' && (
            <button
              id="btn-record-payment"
              onClick={() => setShowPayModal(true)}
              className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
            >
              💳 Record Payment
            </button>
          )}

          <button
            id="btn-whatsapp-share"
            onClick={handleWhatsAppShare}
            className="btn-secondary btn-sm text-emerald-700 hover:bg-emerald-50 border-emerald-200"
            title="Share via WhatsApp"
          >
            💬 WhatsApp
          </button>

          <Link
            id="btn-print-invoice"
            href={`/sales/${sale.id}/print`}
            target="_blank"
            className="btn-primary btn-sm"
          >
            🖨 Print / PDF
          </Link>

          {user?.role === 'OWNER' && sale.status !== 'CANCELLED' && (
            <button
              id="btn-cancel-invoice"
              onClick={handleCancelSale}
              disabled={isCancelling}
              className="btn-secondary btn-sm text-red-600 hover:bg-red-50 hover:border-red-200"
            >
              {isCancelling ? 'Cancelling…' : '✕ Cancel Invoice'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Customer / Supplier Information Card */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h3 className="font-semibold text-slate-800 text-sm">
              {sale.supplier ? '🏢 Supplier (Buyer)' : 'Customer Details'}
            </h3>
            <span className="text-xs text-slate-400">Bill To</span>
          </div>
          {sale.supplier ? (
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-bold text-slate-900 text-base">{sale.supplier.companyName || sale.supplier.name}</p>
                {sale.supplier.companyName && (
                  <p className="text-xs text-slate-500 font-medium">Prop: {sale.supplier.name}</p>
                )}
              </div>
              <p className="text-slate-600 flex items-center gap-2">
                <span>📞</span> {sale.supplier.phone}
              </p>
              {sale.supplier.email && (
                <p className="text-slate-600 flex items-center gap-2">
                  <span>✉️</span> {sale.supplier.email}
                </p>
              )}
              {sale.supplier.gstin && (
                <p className="text-slate-700 font-mono text-xs bg-slate-50 p-1.5 rounded border border-slate-200">
                  GSTIN: <span className="font-bold">{sale.supplier.gstin}</span>
                </p>
              )}
              {sale.supplier.address && (
                <p className="text-slate-500 text-xs mt-1">
                  📍 {sale.supplier.address}
                </p>
              )}
              <div className="pt-2">
                <Link href={`/purchases?supplierId=${sale.supplier.id}`} className="text-xs text-purple-600 hover:underline">
                  View Supplier Purchase Records →
                </Link>
              </div>
            </div>
          ) : sale.customer ? (
            <div className="space-y-2 text-sm">
              <p className="font-bold text-slate-900 text-base">{sale.customer.name}</p>
              <p className="text-slate-600 flex items-center gap-2">
                <span>📞</span> {sale.customer.phone}
              </p>
              {sale.customer.email && (
                <p className="text-slate-600 flex items-center gap-2">
                  <span>✉️</span> {sale.customer.email}
                </p>
              )}
              {sale.customer.gstin && (
                <p className="text-slate-700 font-mono text-xs bg-slate-50 p-1.5 rounded border border-slate-200">
                  GSTIN: <span className="font-bold">{sale.customer.gstin}</span>
                </p>
              )}
              {(sale.customer.billingAddress || sale.customer.address) && (
                <p className="text-slate-500 text-xs mt-1">
                  📍 {sale.customer.billingAddress || sale.customer.address}
                </p>
              )}
              <div className="pt-2">
                <Link href={`/customers/${sale.customer.id}`} className="text-xs text-brand-600 hover:underline">
                  View Customer Statement & Ledger →
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-sm">
              <p className="font-semibold text-slate-700">Walk-in Customer</p>
              <p className="text-xs text-slate-400 mt-1">Standard counter sale</p>
            </div>
          )}
        </div>

        {/* Invoice Meta */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h3 className="font-semibold text-slate-800 text-sm">Invoice Information</h3>
            <span className="text-xs text-slate-400">Tax Specs</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Invoice Number</span>
              <span className="font-mono font-bold text-brand-700">{sale.invoiceNumber}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Invoice Date</span>
              <span className="font-medium text-slate-800">{new Date(sale.invoiceDate).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Supply Type</span>
              <span className="font-semibold text-slate-800">{isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Payment Method</span>
              <span className="font-semibold text-slate-800">{sale.paymentMethod || 'CASH'}</span>
            </div>
            {sale.notes && (
              <div className="mt-2 p-2 bg-slate-50 rounded text-slate-600">
                <span className="font-semibold">Notes:</span> {sale.notes}
              </div>
            )}
          </div>
        </div>

        {/* Summary Card */}
        <div className="card p-5 bg-gradient-to-br from-slate-50 to-blue-50/40 border-blue-100">
          <div className="flex items-center justify-between mb-3 border-b border-blue-100/60 pb-2">
            <h3 className="font-semibold text-slate-800 text-sm">Financial Summary</h3>
            <span className="text-xs text-slate-500 font-mono">INR</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Taxable Value</span>
              <span>{formatINR(sale.taxableAmount)}</span>
            </div>
            {!isInterState ? (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>CGST</span>
                  <span>{formatINR(sale.cgstAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>SGST</span>
                  <span>{formatINR(sale.sgstAmount)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-slate-600">
                <span>IGST</span>
                <span>{formatINR(sale.igstAmount)}</span>
              </div>
            )}
            {Number(sale.roundOff) !== 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Round Off</span>
                <span>{formatINR(sale.roundOff)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
              <span>Grand Total</span>
              <span className="text-brand-700">{formatINR(sale.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-medium pt-1">
              <span>Paid Amount</span>
              <span>{formatINR(sale.paidAmount)}</span>
            </div>
            <div className={`flex justify-between font-bold pt-1 ${balanceDue > 0 ? 'text-red-600' : 'text-slate-500'}`}>
              <span>Balance Due</span>
              <span>{formatINR(balanceDue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Breakdown Table */}
      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Line Items & Tax Breakdown</h3>
          <span className="text-xs text-slate-500">{sale.items?.length || 0} Products</span>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product Description</th>
                <th>HSN</th>
                <th>Qty</th>
                <th>Rate (₹)</th>
                <th>Taxable (₹)</th>
                <th>GST Rate</th>
                {!isInterState ? (
                  <>
                    <th>CGST (₹)</th>
                    <th>SGST (₹)</th>
                  </>
                ) : (
                  <th>IGST (₹)</th>
                )}
                <th className="text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {sale.items?.map((item: any, idx: number) => (
                <tr key={item.id || idx}>
                  <td className="text-slate-400 font-mono text-xs">{idx + 1}</td>
                  <td>
                    <div>
                      <p className="font-semibold text-slate-900">{item.productName || item.product?.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.sku || item.product?.sku}</p>
                    </div>
                  </td>
                  <td className="font-mono text-xs text-slate-500">{item.hsnCode || '—'}</td>
                  <td className="font-medium">
                    {Number(item.quantity)} <span className="text-xs text-slate-400">{item.unit}</span>
                  </td>
                  <td>{formatINR(item.unitPrice)}</td>
                  <td className="font-medium">{formatINR(item.taxableAmount)}</td>
                  <td>
                    <span className="badge badge-info text-xs">{Number(item.gstRate)}%</span>
                  </td>
                  {!isInterState ? (
                    <>
                      <td className="text-xs text-slate-600">{formatINR(item.cgstAmount)}</td>
                      <td className="text-xs text-slate-600">{formatINR(item.sgstAmount)}</td>
                    </>
                  ) : (
                    <td className="text-xs text-slate-600">{formatINR(item.igstAmount)}</td>
                  )}
                  <td className="text-right font-bold text-slate-900">{formatINR(item.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Allocations Ledger */}
      {sale.allocations && sale.allocations.length > 0 && (
        <div className="card mb-6">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Payment History</h3>
            <span className="text-xs text-slate-500">{sale.allocations.length} Payments Recorded</span>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Payment #</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th className="text-right">Allocated Amount</th>
                </tr>
              </thead>
              <tbody>
                {sale.allocations.map((alloc: any) => (
                  <tr key={alloc.id}>
                    <td className="font-mono text-xs text-brand-600">{alloc.payment?.paymentNumber || '—'}</td>
                    <td className="text-slate-500 text-xs">
                      {alloc.payment?.paymentDate ? new Date(alloc.payment.paymentDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td>
                      <span className="badge badge-info">{alloc.payment?.paymentMethod || 'CASH'}</span>
                    </td>
                    <td className="font-mono text-xs text-slate-500">{alloc.payment?.transactionReference || '—'}</td>
                    <td className="text-right font-semibold text-emerald-600">{formatINR(alloc.allocatedAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Slide-over / Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Record Payment</h3>
                <p className="text-xs text-slate-500">For Invoice {sale.invoiceNumber}</p>
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
                  <span>Customer:</span>
                  <span className="font-semibold">{sale.customer?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Due:</span>
                  <span className="font-bold text-red-600">{formatINR(sale.balanceAmount)}</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pay-amt">Amount Received (₹) *</label>
                <input
                  id="pay-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(sale.balanceAmount)}
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
                <label className="form-label">Reference / UTR #</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. UPI Ref / Cheque No"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional notes"
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
                  {isSubmittingPay ? 'Recording…' : 'Confirm & Save Payment'}
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
    </AppShell>
  );
}
