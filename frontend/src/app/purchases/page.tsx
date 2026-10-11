'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { useI18n } from '@/contexts/I18nContext';

interface PurchaseItemRow {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  gstRate: number;
}

export default function PurchasesPage() {
  const { t } = useI18n();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const getDefaultDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  };

  const initialFormState = {
    supplierId: '',
    invoiceNumber: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    expectedDate: getDefaultDueDate(),
    paymentMode: 'UNPAID' as 'PAID' | 'PARTIAL' | 'UNPAID',
    paidAmount: '',
    paymentMethod: 'BANK_TRANSFER',
    notes: '',
    items: [
      { productId: '', productName: '', quantity: 1, unitCost: 0, gstRate: 18 } as PurchaseItemRow,
    ],
  };

  const [form, setForm] = useState(initialFormState);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/purchases/purchases', { params: { page, limit: 20 } });
      setPurchases(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (e) {
      console.error('Failed to load purchases:', e);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get('/purchases/suppliers', { params: { limit: 100 } })
      .then((r) => setSuppliers(r.data.data || []))
      .catch(() => {});
    api
      .get('/products', { params: { limit: 200 } })
      .then((r) => setProducts(r.data.data || []))
      .catch(() => {});
  }, []);

  const updateItem = (idx: number, field: string, val: any) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: val };
      if (field === 'productId') {
        const p = products.find((prod) => prod.id === val);
        if (p) {
          items[idx].productName = p.name;
          items[idx].unitCost = Number(p.purchasePrice || 0);
          items[idx].gstRate = Number(p.gstRate || 18);
        }
      }
      return { ...f, items };
    });
  };

  // Calculated Totals from items
  const calculatedTotals = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    form.items.forEach((it) => {
      const qty = Number(it.quantity) || 0;
      const cost = Number(it.unitCost) || 0;
      const rate = Number(it.gstRate) || 0;
      const lineTaxable = qty * cost;
      const lineTax = (lineTaxable * rate) / 100;
      subtotal += lineTaxable;
      totalTax += lineTax;
    });

    const totalAmount = Math.round(subtotal + totalTax);

    let effectivePaid = 0;
    if (form.paymentMode === 'PAID') {
      effectivePaid = totalAmount;
    } else if (form.paymentMode === 'PARTIAL') {
      const entered = parseFloat(form.paidAmount);
      effectivePaid = isNaN(entered) ? 0 : Math.min(totalAmount, Math.max(0, entered));
    } else {
      effectivePaid = 0;
    }

    const balanceDue = Math.max(0, totalAmount - effectivePaid);

    return {
      subtotal,
      totalTax,
      totalAmount,
      effectivePaid,
      balanceDue,
    };
  }, [form.items, form.paymentMode, form.paidAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplierId) {
      setFormError('Please select a supplier');
      return;
    }
    if (form.items.some((i) => !i.productId)) {
      setFormError('Please select products for all rows');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const pDate = form.purchaseDate
        ? new Date(form.purchaseDate).toISOString()
        : new Date().toISOString();

      const expDate =
        calculatedTotals.balanceDue > 0 && form.expectedDate
          ? new Date(form.expectedDate).toISOString()
          : undefined;

      await api.post('/purchases/purchases', {
        supplierId: form.supplierId,
        supplierInvoiceNumber: form.invoiceNumber || undefined,
        invoiceNumber: form.invoiceNumber || undefined,
        purchaseDate: pDate,
        expectedDate: expDate,
        paidAmount: calculatedTotals.effectivePaid,
        paymentMethod: calculatedTotals.effectivePaid > 0 ? form.paymentMethod : 'BANK_TRANSFER',
        notes: form.notes || undefined,
        items: form.items.map((i) => {
          const qty = Number(i.quantity) || 1;
          return {
            productId: i.productId,
            orderedQuantity: qty,
            quantity: qty,
            receivedQuantity: qty,
            unitCost: Number(i.unitCost) || 0,
            gstRate: Number(i.gstRate) || 0,
          };
        }),
      });

      setShowForm(false);
      setForm(initialFormState);
      load();
    } catch (err: any) {
      const errData = err?.response?.data;
      let msg = errData?.message || 'Failed to create purchase';
      if (errData?.errors && Array.isArray(errData.errors)) {
        msg = errData.errors
          .map((e: any) => `${e.field ? e.field + ': ' : ''}${e.message}`)
          .join(', ');
      }
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const fmt = (n: any) =>
    `₹${Number(n || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <AppShell
      title="Purchases & Procurement"
      subtitle="Record purchase orders, stock receiving, supplier payments & dues"
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-5 items-start sm:items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">
            Total recorded purchases:{' '}
            <strong className="text-slate-800 font-bold">{total}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/payments"
            className="btn-secondary btn-sm flex items-center gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50"
          >
            <span>💳</span>
            <span>View Supplier Dues</span>
          </Link>
          <button
            id="btn-add-purchase"
            onClick={() => {
              setFormError('');
              setForm(initialFormState);
              setShowForm(true);
            }}
            className="btn-primary btn-sm flex items-center gap-1"
          >
            <span>+</span>
            <span>New Purchase</span>
          </button>
        </div>
      </div>

      {/* MODAL: NEW PURCHASE */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-3xl h-full overflow-y-auto shadow-2xl p-6 sm:p-8 animate-slide-in flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Record New Purchase</h2>
                  <p className="text-xs text-slate-500">
                    Add purchase bill, allocate stock, and track supplier payment / dues
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-icon text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                  ⚠️ {formError}
                </div>
              )}

              <form id="purchase-form" onSubmit={handleSubmit} className="space-y-6">
                {/* 1. Header Information */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50/80 rounded-xl border border-slate-200/60">
                  <div className="form-group">
                    <label className="form-label font-semibold text-slate-800">Supplier *</label>
                    <select
                      className="form-select w-full text-xs sm:text-sm"
                      value={form.supplierId}
                      onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
                      required
                    >
                      <option value="">— Select supplier —</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.companyName ? `(${s.companyName})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label font-semibold text-slate-800">
                      Supplier Invoice / Bill #
                    </label>
                    <input
                      type="text"
                      className="form-input text-xs sm:text-sm font-mono"
                      value={form.invoiceNumber}
                      onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                      placeholder="e.g., INV-2026-904"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label font-semibold text-slate-800">
                      Purchase Date
                    </label>
                    <input
                      type="date"
                      className="form-input text-xs sm:text-sm"
                      value={form.purchaseDate}
                      onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {/* 2. Items List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Purchase Items</h3>
                      <p className="text-[11px] text-slate-400">
                        Select products, quantity, unit cost, and GST rate
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          items: [
                            ...f.items,
                            {
                              productId: '',
                              productName: '',
                              quantity: 1,
                              unitCost: 0,
                              gstRate: 18,
                            },
                          ],
                        }))
                      }
                      className="btn-secondary btn-xs font-semibold"
                    >
                      + Add Item Row
                    </button>
                  </div>

                  <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-500 uppercase px-1">
                    <div className="col-span-4">Product *</div>
                    <div className="col-span-2">Qty *</div>
                    <div className="col-span-3">Unit Cost (₹) *</div>
                    <div className="col-span-2">GST Rate %</div>
                    <div className="col-span-1 text-center"></div>
                  </div>

                  <div className="space-y-2">
                    {form.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center p-3 bg-slate-50 rounded-xl border border-slate-200/60"
                      >
                        <div className="col-span-4">
                          <select
                            className="form-select text-xs w-full"
                            value={item.productId}
                            onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                            required
                          >
                            <option value="">Select product…</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="form-input text-xs"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                            required
                          />
                        </div>

                        <div className="col-span-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-input text-xs font-mono font-semibold"
                            placeholder="Cost ₹"
                            value={item.unitCost}
                            onChange={(e) => updateItem(idx, 'unitCost', e.target.value)}
                            required
                          />
                        </div>

                        <div className="col-span-2">
                          <select
                            className="form-select text-xs font-mono"
                            value={item.gstRate}
                            onChange={(e) => updateItem(idx, 'gstRate', e.target.value)}
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </div>

                        <div className="col-span-1 text-center">
                          {form.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  items: f.items.filter((_, i) => i !== idx),
                                }))
                              }
                              className="btn-icon text-xs text-red-500 hover:bg-red-50"
                              title="Delete row"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Payment & Dues Allocation Section */}
                <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl border border-blue-200/60 space-y-4">
                  <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <span>💰</span>
                        <span>Payment & Dues Allocation</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Specify how much is paid now vs outstanding dues to supplier
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block">Total Bill Amount</span>
                      <span className="text-base font-extrabold text-blue-900 font-mono">
                        {fmt(calculatedTotals.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Mode Selector */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-2">
                      Payment Status (भुगतान स्थिति)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, paymentMode: 'UNPAID', paidAmount: '' }))}
                        className={`p-2.5 rounded-xl text-xs font-bold text-center border-2 transition-all ${
                          form.paymentMode === 'UNPAID'
                            ? 'bg-purple-100/80 border-purple-600 text-purple-900 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-purple-300'
                        }`}
                      >
                        <p className="font-extrabold">🔴 Credit / Unpaid</p>
                        <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                          Full amount in dues
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            paymentMode: 'PARTIAL',
                            paidAmount: f.paidAmount || String(Math.round(calculatedTotals.totalAmount / 2)),
                          }))
                        }
                        className={`p-2.5 rounded-xl text-xs font-bold text-center border-2 transition-all ${
                          form.paymentMode === 'PARTIAL'
                            ? 'bg-amber-100/80 border-amber-600 text-amber-900 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
                        }`}
                      >
                        <p className="font-extrabold">🟡 Partial Payment</p>
                        <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                          Part paid, part dues
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, paymentMode: 'PAID', paidAmount: '' }))}
                        className={`p-2.5 rounded-xl text-xs font-bold text-center border-2 transition-all ${
                          form.paymentMode === 'PAID'
                            ? 'bg-emerald-100/80 border-emerald-600 text-emerald-900 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300'
                        }`}
                      >
                        <p className="font-extrabold">🟢 Full Paid</p>
                        <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                          Zero dues (Paid 100%)
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Payment Inputs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {form.paymentMode === 'PARTIAL' && (
                      <div className="form-group">
                        <label className="form-label font-semibold text-slate-800">
                          Amount Paid to Supplier Now (₹) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={calculatedTotals.totalAmount}
                          className="form-input font-bold font-mono text-emerald-700 text-sm"
                          placeholder="0.00"
                          value={form.paidAmount}
                          onChange={(e) => setForm((f) => ({ ...f, paidAmount: e.target.value }))}
                          required
                        />
                      </div>
                    )}

                    {calculatedTotals.effectivePaid > 0 && (
                      <div className="form-group">
                        <label className="form-label font-semibold text-slate-800">
                          Payment Method *
                        </label>
                        <select
                          className="form-select w-full text-xs"
                          value={form.paymentMethod}
                          onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                        >
                          <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
                          <option value="UPI">UPI / QR Code</option>
                          <option value="CASH">Cash</option>
                          <option value="CHEQUE">Cheque</option>
                        </select>
                      </div>
                    )}

                    {calculatedTotals.balanceDue > 0 && (
                      <div className="form-group">
                        <label className="form-label font-semibold text-purple-900 flex items-center justify-between">
                          <span>Dues Date (भुगतान देय तिथि) *</span>
                          <span className="text-[10px] text-purple-700 font-normal">
                            Expected payment date
                          </span>
                        </label>
                        <input
                          type="date"
                          className="form-input text-xs font-semibold border-purple-300 bg-purple-50/40 text-purple-900"
                          value={form.expectedDate}
                          onChange={(e) => setForm((f) => ({ ...f, expectedDate: e.target.value }))}
                          required={calculatedTotals.balanceDue > 0}
                        />
                      </div>
                    )}
                  </div>

                  {/* Live Dues Summary Banner */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-white rounded-xl border border-slate-200 text-center">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500">Total Bill</p>
                      <p className="font-mono font-extrabold text-slate-900 text-xs sm:text-sm mt-0.5">
                        {fmt(calculatedTotals.totalAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-emerald-600">Amount Paid</p>
                      <p className="font-mono font-extrabold text-emerald-700 text-xs sm:text-sm mt-0.5">
                        {fmt(calculatedTotals.effectivePaid)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-purple-700">
                        Supplier Dues (बाकी)
                      </p>
                      <p
                        className={`font-mono font-extrabold text-xs sm:text-sm mt-0.5 ${
                          calculatedTotals.balanceDue > 0 ? 'text-purple-800' : 'text-slate-400'
                        }`}
                      >
                        {fmt(calculatedTotals.balanceDue)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Notes */}
                <div className="form-group">
                  <label className="form-label font-semibold text-slate-800">
                    Notes / Remarks
                  </label>
                  <textarea
                    rows={2}
                    className="form-input text-xs resize-none"
                    placeholder="Optional notes or supplier payment terms…"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex gap-3">
              <button
                type="submit"
                form="purchase-form"
                className="btn-primary flex-1 justify-center bg-blue-600 hover:bg-blue-700"
                disabled={isSaving}
              >
                {isSaving ? 'Recording Purchase…' : '📦 Record Purchase & Stock'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PURCHASES LIST TABLE */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Supplier / Vendor</th>
                <th>Bill / Invoice #</th>
                <th className="text-right">Total Amount</th>
                <th className="text-right">Paid Amount</th>
                <th className="text-right">Balance Due</th>
                <th>Dues Date</th>
                <th>Payment Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((_, j) => (
                      <td key={j}>
                        <div className="skeleton h-4 w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state py-12 text-center">
                      <p className="text-4xl mb-2">🛒</p>
                      <p className="text-slate-800 font-semibold">No purchase bills recorded yet</p>
                      <button
                        onClick={() => {
                          setFormError('');
                          setForm(initialFormState);
                          setShowForm(true);
                        }}
                        className="btn-primary btn-sm mt-3"
                      >
                        + Record First Purchase
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                purchases.map((p) => {
                  const totalAmt = Number(p.totalAmount || 0);
                  const paidAmt = Number(p.paidAmount || 0);
                  const balAmt = Number(p.balanceAmount || 0);
                  const hasDue = balAmt > 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(p.purchaseDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        <span className="font-semibold text-slate-900 block">
                          {p.supplier?.name || '—'}
                        </span>
                        {p.supplier?.companyName && (
                          <span className="text-xs text-slate-400">{p.supplier.companyName}</span>
                        )}
                      </td>
                      <td className="font-mono text-xs text-brand-600 font-semibold">
                        {p.supplierInvoiceNumber || p.purchaseNumber || '—'}
                      </td>
                      <td className="text-right font-mono font-semibold text-slate-900">
                        {fmt(totalAmt)}
                      </td>
                      <td className="text-right font-mono text-emerald-700 font-semibold">
                        {fmt(paidAmt)}
                      </td>
                      <td className="text-right">
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                            hasDue
                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                              : 'text-slate-400'
                          }`}
                        >
                          {fmt(balAmt)}
                        </span>
                      </td>
                      <td className="text-xs">
                        {p.expectedDate ? (
                          <span
                            className={`font-medium ${
                              hasDue && new Date(p.expectedDate) < new Date()
                                ? 'text-red-600 font-bold'
                                : 'text-slate-600'
                            }`}
                          >
                            {new Date(p.expectedDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            p.paymentStatus === 'PAID'
                              ? 'badge-success'
                              : p.paymentStatus === 'PARTIALLY_PAID'
                              ? 'badge-warning'
                              : 'badge-danger'
                          }`}
                        >
                          {p.paymentStatus === 'PARTIALLY_PAID' ? 'PARTIAL' : p.paymentStatus}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {hasDue && (
                            <Link
                              href="/payments"
                              className="btn-primary btn-xs bg-purple-700 hover:bg-purple-800 border-0 flex items-center gap-1"
                              title="Go to Payments to pay this purchase bill"
                            >
                              <span>💸</span>
                              <span>Pay</span>
                            </Link>
                          )}
                          <span className="text-slate-400 text-xs">
                            {p.items?.length || 0} item(s)
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {Math.ceil(total / 20) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Page {page} of {Math.ceil(total / 20)}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary btn-sm"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / 20)}
                className="btn-secondary btn-sm"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
