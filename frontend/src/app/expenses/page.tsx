'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', categoryId: '', amount: '', paymentMethod: 'CASH', expenseDate: new Date().toISOString().split('T')[0], notes: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/expenses', { params: { page, limit: 20, categoryId: selectedCategoryId || undefined } });
      setExpenses(data.data);
      setTotal(data.pagination?.total || 0);
    } catch {} finally { setIsLoading(false); }
  }, [page, selectedCategoryId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/expenses/categories').then(r => setCategories(r.data.data || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.amount) { setFormError('Title and amount are required'); return; }
    setIsSaving(true); setFormError('');
    try {
      const payload: any = {
        title: form.title.trim(),
        reference: form.title.trim(),
        amount: Number(form.amount),
        categoryId: form.categoryId || undefined,
        paymentMethod: form.paymentMethod || 'CASH',
        notes: form.notes?.trim() || undefined,
        expenseDate: form.expenseDate ? new Date(form.expenseDate).toISOString() : new Date().toISOString(),
      };
      await api.post('/expenses', payload);
      setShowForm(false);
      setForm({ title: '', categoryId: '', amount: '', paymentMethod: 'CASH', expenseDate: new Date().toISOString().split('T')[0], notes: '' });
      load();
    } catch (err: any) { setFormError(err?.response?.data?.message || 'Failed to record expense'); }
    finally { setIsSaving(false); }
  };

  const fmt = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <AppShell title="Expenses" subtitle="Business expenses and cost tracking">
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <select id="filter-expense-category" className="form-select w-48" value={selectedCategoryId} onChange={e => { setSelectedCategoryId(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button id="btn-add-expense" onClick={() => setShowForm(true)} className="btn-primary btn-sm ml-auto">+ Add Expense</button>
      </div>

      {/* Expense Form Drawer */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl p-6 animate-slide-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">Record Expense</h2>
              <button onClick={() => setShowForm(false)} className="btn-icon">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">⚠ {formError}</div>}
              <div className="form-group">
                <label className="form-label">Expense Title *</label>
                <input type="text" className="form-input" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="e.g., Office Rent, Electricity Bill" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input type="number" step="0.01" min="0" className="form-input" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={form.expenseDate} onChange={e => setForm(f => ({...f, expenseDate: e.target.value}))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.categoryId} onChange={e => setForm(f => ({...f, categoryId: e.target.value}))}>
                  <option value="">— Uncategorized —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-select" value={form.paymentMethod} onChange={e => setForm(f => ({...f, paymentMethod: e.target.value}))}>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea rows={2} className="form-input resize-none" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={isSaving}>
                  {isSaving ? 'Saving…' : '💸 Record Expense'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="card p-4">
          <p className="stat-label">Total Expenses (Shown)</p>
          <p className="stat-value text-red-600">{fmt(totalExpenses)}</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Number of Records</p>
          <p className="stat-value">{total}</p>
        </div>
        <div className="card p-4 flex items-center justify-center">
          <button onClick={() => setShowForm(true)} className="btn-danger w-full justify-center">+ Add Expense</button>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(6)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => <td key={j}><div className="skeleton h-4 w-24" /></td>)}</tr>
              )) : expenses.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state">
                  <p className="text-3xl mb-2">💸</p>
                  <p className="text-sm">No expenses recorded. <button onClick={() => setShowForm(true)} className="text-brand-600 hover:underline">Add first expense →</button></p>
                </div></td></tr>
              ) : expenses.map(exp => (
                <tr key={exp.id}>
                  <td className="text-xs text-slate-500">{new Date(exp.expenseDate).toLocaleDateString('en-IN')}</td>
                  <td className="font-medium">{exp.title}</td>
                  <td><span className="badge badge-gray">{exp.category?.name || 'Uncategorized'}</span></td>
                  <td className="font-semibold text-red-600">{fmt(exp.amount)}</td>
                  <td><span className="badge badge-info text-xs">{exp.paymentMethod}</span></td>
                  <td>
                    <button
                      onClick={async () => { if (confirm('Delete this expense?')) { await api.delete(`/expenses/${exp.id}`); load(); } }}
                      className="btn-icon text-xs hover:text-red-500"
                    >🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {Math.ceil(total / 20) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">Page {page} of {Math.ceil(total/20)}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="btn-secondary btn-sm">← Prev</button>
              <button onClick={() => setPage(p => p+1)} disabled={page >= Math.ceil(total/20)} className="btn-secondary btn-sm">Next →</button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
