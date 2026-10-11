'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { useI18n } from '@/contexts/I18nContext';
import { useDebounce } from '@/hooks/useDebounce';

function formatINR(n: number | string | undefined | null) {
  if (n === undefined || n === null) return '₹0.00';
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CustomersPage() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | 'WHOLESALE' | 'RETAIL'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingParty, setEditingParty] = useState<any | null>(null);

  const [form, setForm] = useState({
    customerType: 'RETAIL' as 'RETAIL' | 'WHOLESALE',
    companyName: '',
    name: '',
    phone: '',
    email: '',
    gstin: '',
    creditLimit: '',
    address: '',
    state: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [partyToDelete, setPartyToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const debouncedSearch = useDebounce(search, 350);

  const openEditParty = (c: any) => {
    setEditingParty(c);
    setForm({
      customerType: c.customerType || 'RETAIL',
      companyName: c.companyName || '',
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      gstin: c.gstin || '',
      creditLimit: c.creditLimit ? String(c.creditLimit) : '',
      address: c.billingAddress || c.address || '',
      state: c.state || '',
    });
    setFormError('');
    setShowForm(true);
  };

  const openAddParty = () => {
    setEditingParty(null);
    setForm({
      customerType: selectedType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
      companyName: '',
      name: '',
      phone: '',
      email: '',
      gstin: '',
      creditLimit: '',
      address: '',
      state: '',
    });
    setFormError('');
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (!partyToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/customers/${partyToDelete.id}`);
      const deletedName = partyToDelete.companyName || partyToDelete.name;
      setPartyToDelete(null);
      setSuccessMsg(`Party "${deletedName}" has been deleted.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      load();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || 'Failed to delete party');
    } finally {
      setIsDeleting(false);
    }
  };

  // Read URL query parameter for type if present on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const paramType = new URLSearchParams(window.location.search).get('type')?.toUpperCase();
      if (paramType === 'WHOLESALE' || paramType === 'RETAIL') {
        setSelectedType(paramType as any);
      }
    }
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page,
        limit: 20,
        search: debouncedSearch || undefined,
      };
      if (selectedType !== 'ALL') {
        params.type = selectedType;
      }
      const { data } = await api.get('/customers', { params });
      setCustomers(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch {} finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, selectedType]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setFormError('Customer/Contact Person name and phone are required');
      return;
    }
    if (form.customerType === 'WHOLESALE' && !form.companyName.trim()) {
      setFormError('Firm / Company Name is required for Wholesale Parties');
      return;
    }

    setIsSaving(true);
    setFormError('');
    try {
      const payload: any = {
        customerType: form.customerType,
        companyName: form.companyName.trim() || (editingParty ? null : undefined),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || (editingParty ? null : undefined),
        gstin: form.gstin.trim() ? form.gstin.trim().toUpperCase() : (editingParty ? null : undefined),
        creditLimit: form.creditLimit ? Number(form.creditLimit) : (editingParty ? null : undefined),
        billingAddress: form.address.trim() || (editingParty ? null : undefined),
      };

      if (editingParty) {
        await api.put(`/customers/${editingParty.id}`, payload);
        setSuccessMsg(`Party "${payload.companyName || payload.name}" updated successfully.`);
      } else {
        await api.post('/customers', payload);
        setSuccessMsg(`Party "${payload.companyName || payload.name}" added successfully.`);
      }

      setShowForm(false);
      setEditingParty(null);
      setForm({
        customerType: selectedType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
        companyName: '',
        name: '',
        phone: '',
        email: '',
        gstin: '',
        creditLimit: '',
        address: '',
        state: '',
      });
      setTimeout(() => setSuccessMsg(''), 4000);
      load();
    } catch (err: any) {
      const errData = err?.response?.data;
      if (errData?.errors && Array.isArray(errData.errors)) {
        setFormError(errData.errors.map((e: any) => `${e.field ? `${e.field}: ` : ''}${e.message}`).join(', '));
      } else {
        setFormError(errData?.message || (editingParty ? 'Failed to update party' : 'Failed to add party'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell title="Sales Parties & Customers" subtitle="Manage your wholesale dealers and retail clients">
      {/* 3 Categories Visual Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* 1. Purchase Parties (Suppliers) */}
        <Link
          href="/suppliers"
          className="card p-4 hover:shadow-md transition-all border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/30 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">🏭</span>
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Procurement</span>
          </div>
          <h3 className="font-bold text-slate-900 mt-2 text-base group-hover:text-amber-700">Purchase Parties (सप्लायर)</h3>
          <p className="text-xs text-slate-500 mt-1">Jinse aap maal khareedte hain (Vendors & Suppliers)</p>
          <p className="text-xs font-semibold text-amber-700 mt-3 flex items-center gap-1">Manage Suppliers →</p>
        </Link>

        {/* 2. Wholesale Parties */}
        <div
          onClick={() => { setSelectedType('WHOLESALE'); setPage(1); }}
          className={`card p-4 cursor-pointer transition-all border-l-4 border-l-purple-600 ${
            selectedType === 'WHOLESALE' ? 'ring-2 ring-purple-500 bg-purple-50/50 shadow-md' : 'hover:shadow-md bg-gradient-to-br from-white to-purple-50/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">🏢</span>
            <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">B2B Wholesale</span>
          </div>
          <h3 className="font-bold text-slate-900 mt-2 text-base">Wholesale Sales Parties (थोक ग्राहक)</h3>
          <p className="text-xs text-slate-500 mt-1">Jinhe aap wholesale mein maal bechte hain (Dealers & Shops)</p>
          <p className="text-xs font-semibold text-purple-700 mt-3 flex items-center gap-1">
            {selectedType === 'WHOLESALE' ? '✓ Filter Active' : 'Filter Wholesale Parties →'}
          </p>
        </div>

        {/* 3. Retail Customers */}
        <div
          onClick={() => { setSelectedType('RETAIL'); setPage(1); }}
          className={`card p-4 cursor-pointer transition-all border-l-4 border-l-brand-600 ${
            selectedType === 'RETAIL' ? 'ring-2 ring-brand-500 bg-brand-50/50 shadow-md' : 'hover:shadow-md bg-gradient-to-br from-white to-blue-50/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">👤</span>
            <span className="text-xs font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-full">B2C Retail</span>
          </div>
          <h3 className="font-bold text-slate-900 mt-2 text-base">Retail Customers (खुदरा ग्राहक)</h3>
          <p className="text-xs text-slate-500 mt-1">Jinhe aap retail mein maal bechte hain (Counter & Walk-in)</p>
          <p className="text-xs font-semibold text-brand-700 mt-3 flex items-center gap-1">
            {selectedType === 'RETAIL' ? '✓ Filter Active' : 'Filter Retail Customers →'}
          </p>
        </div>
      </div>

      {/* Tabs and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => { setSelectedType('ALL'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              selectedType === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            👥 All Sales Parties
          </button>
          <button
            onClick={() => { setSelectedType('WHOLESALE'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              selectedType === 'WHOLESALE' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🏢</span> Wholesale (थोक)
          </button>
          <button
            onClick={() => { setSelectedType('RETAIL'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              selectedType === 'RETAIL' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>👤</span> Retail (खुदरा)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              id="customer-search"
              type="text"
              className="form-input pl-9 text-xs"
              placeholder="Search name, firm, phone, GSTIN…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button
            id="btn-add-customer"
            onClick={openAddParty}
            className="btn-primary btn-sm flex items-center gap-1 flex-shrink-0"
          >
            <span>➕</span> Add Party / Customer
          </button>
        </div>
      </div>

      {/* Add / Edit Customer / Wholesale Party Slide-over */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl animate-slide-in p-6">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingParty ? '✏️ Edit Party (पार्टी विवरण सुधारें)' : 'Add Sales Party'}
                </h2>
                <p className="text-xs text-slate-500">
                  {editingParty
                    ? `Update phone, email, firm or GST details for ${editingParty.companyName || editingParty.name}`
                    : 'Record a new retail client or wholesale dealership'}
                </p>
              </div>
              <button onClick={() => setShowForm(false)} className="btn-icon">✕</button>
            </div>

            {/* Party Type Selector */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, customerType: 'RETAIL' }))}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  form.customerType === 'RETAIL' ? 'bg-white text-brand-700 shadow-sm font-bold' : 'text-slate-600'
                }`}
              >
                <span>👤</span> Retail Customer (खुदरा)
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, customerType: 'WHOLESALE' }))}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  form.customerType === 'WHOLESALE' ? 'bg-purple-600 text-white shadow-sm font-bold' : 'text-slate-600'
                }`}
              >
                <span>🏢</span> Wholesale Party (थोक)
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  ⚠ {formError}
                </div>
              )}

              {form.customerType === 'WHOLESALE' && (
                <div className="form-group bg-purple-50/60 p-3 rounded-xl border border-purple-200">
                  <label className="form-label text-purple-900 font-semibold">Firm / Company Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input bg-white border-purple-300 focus:border-purple-600"
                    placeholder="e.g. Kisan Khad Beej Bhandar"
                    value={form.companyName}
                    onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  />
                  <p className="text-[10px] text-purple-700 mt-1">Shop, Agency, or Business name</p>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  {form.customerType === 'WHOLESALE' ? 'Proprietor / Contact Person Name *' : 'Customer Name *'}
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder={form.customerType === 'WHOLESALE' ? 'e.g. Ramesh Kumar' : 'e.g. Amit Sharma'}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    className="form-input font-mono"
                    placeholder="10-digit mobile"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email (Optional)</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="mail@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">GSTIN (Optional)</label>
                  <input
                    type="text"
                    className="form-input font-mono uppercase"
                    placeholder="15-digit GSTIN"
                    value={form.gstin}
                    onChange={e => setForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                    maxLength={15}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Credit Limit (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="e.g. 50000"
                    value={form.creditLimit}
                    onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea
                  rows={2}
                  className="form-input resize-none"
                  placeholder="Village / Town / Shop Address"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button type="submit" className="btn-primary flex-1 py-2.5" disabled={isSaving}>
                  {isSaving
                    ? 'Saving…'
                    : editingParty
                    ? '💾 Update Party (बदलाव सेव करें)'
                    : `+ Save ${form.customerType === 'WHOLESALE' ? 'Wholesale Party' : 'Customer'}`}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center justify-between animate-fade-in">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Parties Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Party / Name</th>
                <th>Type</th>
                <th>Phone</th>
                <th>GSTIN</th>
                <th>Credit Limit</th>
                <th>Balance Due (बकाया)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j}><div className="skeleton h-4 w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state py-8">
                      <p className="text-4xl mb-2">👥</p>
                      <p className="text-sm font-medium text-slate-700">
                        {selectedType === 'WHOLESALE'
                          ? 'No wholesale parties found.'
                          : selectedType === 'RETAIL'
                          ? 'No retail customers found.'
                          : 'No sales parties yet.'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">
                        Add your wholesale dealerships or retail clients to manage ledgers and billing.
                      </p>
                      <button
                        onClick={openAddParty}
                        className="btn-primary btn-sm"
                      >
                        + Add {selectedType === 'WHOLESALE' ? 'Wholesale Party' : 'Customer'}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map(c => {
                  const isWholesale = c.customerType === 'WHOLESALE';
                  const balance = Number(c.currentBalance || c.balanceAmount || 0);

                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              isWholesale
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-brand-100 text-brand-700'
                            }`}
                          >
                            {isWholesale ? '🏢' : c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 leading-tight">
                              {c.companyName || c.name}
                            </p>
                            {c.companyName && (
                              <p className="text-xs text-slate-500">Prop: {c.name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge text-[11px] font-semibold ${
                            isWholesale
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {isWholesale ? '🏢 Wholesale' : '👤 Retail'}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-slate-600">{c.phone}</td>
                      <td className="font-mono text-xs">{c.gstin || <span className="text-slate-300">—</span>}</td>
                      <td className="text-xs text-slate-600">
                        {c.creditLimit ? formatINR(c.creditLimit) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className={balance > 0 ? 'text-red-600 font-bold text-xs' : 'text-slate-400 text-xs'}>
                        {balance > 0 ? formatINR(balance) : '₹0.00 (Clear)'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditParty(c)}
                            className="btn-secondary btn-sm py-1 px-2 text-xs flex items-center gap-1 font-semibold text-slate-700 hover:text-brand-700 hover:border-brand-300"
                            title="Edit Party Details (फोन, ईमेल, नाम बदलें)"
                            id={`btn-edit-party-${c.id}`}
                          >
                            ✏️ Edit
                          </button>
                          <Link
                            href={`/customers/${c.id}`}
                            className="btn-secondary btn-sm py-1 px-2 text-xs flex items-center gap-1"
                            title="View Statement & Ledger"
                          >
                            👁 Statement
                          </Link>
                          <Link
                            href={`/sales/pos?customerId=${c.id}`}
                            className={`btn-sm py-1 px-2 text-xs flex items-center gap-1 font-semibold ${
                              isWholesale
                                ? 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                                : 'bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100'
                            }`}
                            title="Open POS Terminal to bill this party"
                          >
                            🧾 Bill
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setPartyToDelete(c);
                              setDeleteError('');
                            }}
                            className="btn-icon text-xs text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded"
                            title="Delete Party (हटाएं)"
                            id={`btn-delete-party-${c.id}`}
                          >
                            🗑️
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
        {Math.ceil(total / 20) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary btn-sm"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / 20)}
                className="btn-secondary btn-sm"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {partyToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-lg font-bold">
                🗑️
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete {partyToDelete.customerType === 'WHOLESALE' ? 'Wholesale Party (थोक पार्टी)' : 'Customer (ग्राहक)'}?
                </h3>
                <p className="text-xs text-slate-500">
                  {partyToDelete.companyName ? `${partyToDelete.companyName} (${partyToDelete.name})` : partyToDelete.name}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete this {partyToDelete.customerType === 'WHOLESALE' ? 'wholesale party' : 'customer'}?
              They will be removed from your active parties list and billing search.
            </p>

            {Number(partyToDelete.currentBalance || partyToDelete.balanceAmount || 0) > 0 && (
              <div className="p-3 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                ⚠️ <strong>Outstanding Balance:</strong> This party currently has an unpaid balance of{' '}
                <span className="font-bold text-red-700">{formatINR(partyToDelete.currentBalance || partyToDelete.balanceAmount)}</span>.
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
                onClick={() => setPartyToDelete(null)}
                disabled={isDeleting}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-party"
                onClick={confirmDelete}
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
    </AppShell>
  );
}
