'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';

function formatINR(n: number | string | undefined | null) {
  if (n === undefined || n === null) return '₹0.00';
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', gstin: '', address: '', state: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [supplierToDelete, setSupplierToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const openEditSupplier = (s: any) => {
    setEditingSupplier(s);
    setForm({
      name: s.name || '',
      phone: s.phone || '',
      email: s.email || '',
      gstin: s.gstin || '',
      address: s.address || '',
      state: s.state || '',
    });
    setFormError('');
    setShowForm(true);
  };

  const openAddSupplier = () => {
    setEditingSupplier(null);
    setForm({ name: '', phone: '', email: '', gstin: '', address: '', state: '' });
    setFormError('');
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (!supplierToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/purchases/suppliers/${supplierToDelete.id}`);
      const sName = supplierToDelete.companyName || supplierToDelete.name;
      setSupplierToDelete(null);
      setSuccessMsg(`Supplier "${sName}" deleted successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      load();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || 'Failed to delete supplier');
    } finally {
      setIsDeleting(false);
    }
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/purchases/suppliers', { params: { page, limit: 20, search: search || undefined } });
      setSuppliers(data.data);
      setTotal(data.pagination?.total || 0);
    } catch {} finally { setIsLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const INDIAN_STATES = [
    'Uttar Pradesh', 'Delhi', 'Bihar', 'Madhya Pradesh', 'Rajasthan', 'Haryana',
    'Punjab', 'Maharashtra', 'Gujarat', 'West Bengal', 'Karnataka', 'Tamil Nadu',
    'Telangana', 'Andhra Pradesh', 'Kerala', 'Odisha', 'Jharkhand', 'Chhattisgarh',
    'Uttarakhand', 'Himachal Pradesh', 'Assam', 'Goa', 'Jammu and Kashmir'
  ];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) { setFormError('Supplier name and phone are required'); return; }
    setIsSaving(true); setFormError('');
    try {
      const payload: any = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || (editingSupplier ? null : undefined),
        gstin: form.gstin.trim() ? form.gstin.trim().toUpperCase() : (editingSupplier ? null : undefined),
        state: form.state.trim() || (editingSupplier ? null : undefined),
        address: form.address.trim() || (editingSupplier ? null : undefined),
      };

      if (editingSupplier) {
        await api.put(`/purchases/suppliers/${editingSupplier.id}`, payload);
        setSuccessMsg(`Supplier "${payload.name}" updated successfully.`);
      } else {
        await api.post('/purchases/suppliers', payload);
        setSuccessMsg(`Supplier "${payload.name}" added successfully.`);
      }

      setShowForm(false);
      setEditingSupplier(null);
      setForm({ name: '', phone: '', email: '', gstin: '', address: '', state: '' });
      setTimeout(() => setSuccessMsg(''), 4000);
      load();
    } catch (err: any) {
      const errData = err?.response?.data;
      if (errData?.errors && Array.isArray(errData.errors)) {
        setFormError(errData.errors.map((e: any) => `${e.field ? `${e.field}: ` : ''}${e.message}`).join(', '));
      } else {
        setFormError(errData?.message || (editingSupplier ? 'Failed to update supplier' : 'Failed to add supplier'));
      }
    } finally { setIsSaving(false); }
  };

  return (
    <AppShell title="Suppliers" subtitle={`${total} suppliers`}>
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input id="supplier-search" type="text" className="form-input pl-9" placeholder="Search suppliers…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button id="btn-add-supplier" onClick={openAddSupplier} className="btn-primary btn-sm ml-auto">+ Add Supplier</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl p-6 animate-slide-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{editingSupplier ? '✏️ Edit Supplier (सप्लायर सुधारें)' : 'Add Supplier'}</h2>
                <p className="text-xs text-slate-500">{editingSupplier ? `Update details for ${editingSupplier.name}` : 'Record a new purchase vendor'}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="btn-icon">✕</button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                  <span className="text-red-500 font-bold">⚠</span>
                  <div className="flex-1">{formError}</div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Supplier Name *</label>
                <input type="text" className="form-input" placeholder="e.g. Kisan Agro Agency" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Phone *</label>
                  <input type="tel" className="form-input" placeholder="10-digit mobile" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email (Optional)</label>
                  <input type="email" className="form-input" placeholder="supplier@example.com" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">GSTIN (Optional)</label>
                <input type="text" className="form-input font-mono uppercase" placeholder="e.g. 07AAAAA0000A1Z5" value={form.gstin} onChange={e => setForm(f => ({...f, gstin: e.target.value.toUpperCase()}))} maxLength={15} />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input type="text" list="states-list" className="form-input" placeholder="Select or type state" value={form.state} onChange={e => setForm(f => ({...f, state: e.target.value}))} />
                <datalist id="states-list">
                  {INDIAN_STATES.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea rows={2} className="form-input resize-none" placeholder="Shop / Warehouse address" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={isSaving}>
                  {isSaving ? 'Saving…' : editingSupplier ? '💾 Update Supplier' : '+ Add Supplier'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
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

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Phone</th>
                <th>Email</th>
                <th>GSTIN</th>
                <th>State</th>
                <th>Payable Balance</th>
                <th>Purchases</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(5)].map((_, i) => <tr key={i}>{[...Array(8)].map((_, j) => <td key={j}><div className="skeleton h-4 w-24" /></td>)}</tr>)
              : suppliers.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state"><p className="text-3xl mb-2">🏭</p><p className="text-sm">No suppliers. <button onClick={openAddSupplier} className="text-brand-600 hover:underline">Add first →</button></p></div></td></tr>
              ) : suppliers.map(s => (
                <tr key={s.id}>
                  <td>
                    <Link
                      href={`/suppliers/${s.id}`}
                      className="group block hover:opacity-80"
                      title="Click to view purchase history & ledger statement (पूरा हिसाब देखें)"
                    >
                      <p className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                        {s.companyName || s.name}
                      </p>
                      {s.companyName && <p className="text-xs text-slate-500">Prop: {s.name}</p>}
                    </Link>
                  </td>
                  <td>{s.phone}</td>
                  <td className="text-slate-500 text-xs">{s.email || '—'}</td>
                  <td className="font-mono text-xs">{s.gstin || '—'}</td>
                  <td>{s.state || '—'}</td>
                  <td className="font-semibold text-xs">
                    <span className={Number(s.currentBalance) > 0 ? 'text-amber-700' : 'text-slate-500'}>
                      {formatINR(s.currentBalance || 0)}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/suppliers/${s.id}`}
                      className="badge badge-info hover:bg-sky-200 cursor-pointer transition-all"
                      title="View all purchases from this supplier"
                    >
                      {s._count?.purchases || 0} Bills ↗
                    </Link>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/suppliers/${s.id}`}
                        className="btn-secondary btn-sm py-1 px-2 text-xs text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100 flex items-center gap-1 font-semibold"
                        title="View Full Ledger Statement & Purchase History (पूरा हिसाब व क्या लिया देखें)"
                        id={`btn-view-statement-${s.id}`}
                      >
                        👁 Statement
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEditSupplier(s)}
                        className="btn-secondary btn-sm py-1 px-2 text-xs text-slate-700 hover:text-brand-700 hover:border-brand-300 flex items-center gap-1 font-semibold"
                        title="Edit Supplier (सप्लायर विवरण बदलें)"
                        id={`btn-edit-supplier-${s.id}`}
                      >
                        ✏️ Edit
                      </button>
                      <Link
                        href={`/sales/pos?supplierId=${s.id}`}
                        className="btn-secondary btn-sm py-1 px-2.5 text-xs text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100 flex items-center gap-1 font-semibold"
                        title="Sell products to this supplier"
                      >
                        <span>🧾</span> Sell
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setSupplierToDelete(s);
                          setDeleteError('');
                        }}
                        className="btn-icon text-xs text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded"
                        title="Delete Supplier (हटाएं)"
                        id={`btn-delete-supplier-${s.id}`}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {supplierToDelete && (
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
                  {supplierToDelete.companyName ? `${supplierToDelete.companyName} (${supplierToDelete.name})` : supplierToDelete.name}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete this supplier? They will be removed from your active supplier list and purchase records.
            </p>

            {Number(supplierToDelete.currentBalance || 0) > 0 && (
              <div className="p-3 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                ⚠️ <strong>Payable Balance:</strong> You currently have a payable balance of{' '}
                <span className="font-bold text-red-700">{formatINR(supplierToDelete.currentBalance)}</span> to this supplier.
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
                onClick={() => setSupplierToDelete(null)}
                disabled={isDeleting}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-supplier"
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
                  <>🗑️ Delete Supplier</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
