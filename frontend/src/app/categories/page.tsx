'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { useI18n } from '@/contexts/I18nContext';
import { useDebounce } from '@/hooks/useDebounce';

interface Category {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  _count?: {
    products: number;
  };
  children?: any[];
  createdAt?: string;
}

export default function CategoriesPage() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Drawer / Modal state
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [drawerError, setDrawerError] = useState('');

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.get('/categories');
      setCategories(data.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setDrawerError('');
    setShowDrawer(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setDrawerError('');
    setShowDrawer(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setDrawerError('Category name is required');
      return;
    }

    setIsSaving(true);
    setDrawerError('');
    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
      } else {
        await api.post('/categories', {
          name: name.trim(),
          description: description.trim() || undefined,
        });
      }
      setShowDrawer(false);
      setName('');
      setDescription('');
      setEditingCategory(null);
      await loadCategories();
    } catch (err: any) {
      setDrawerError(err?.response?.data?.message || 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    const count = cat._count?.products || 0;
    const confirmMsg = count > 0
      ? `This category contains ${count} product(s). Are you sure you want to deactivate it?`
      : `Are you sure you want to deactivate category "${cat.name}"?`;

    if (!confirm(confirmMsg)) return;

    setDeletingId(cat.id);
    try {
      await api.delete(`/categories/${cat.id}`);
      await loadCategories();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete category');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredCategories = categories.filter((c) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

  const totalProducts = categories.reduce((sum, c) => sum + (c._count?.products || 0), 0);

  return (
    <AppShell
      title="Product Categories"
      subtitle={`${categories.length} categories organizing ${totalProducts} products`}
    >
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-6">
        <div className="relative flex-1 max-w-sm w-full">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            id="category-search"
            type="text"
            className="form-input pl-9"
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          id="btn-add-category"
          onClick={handleOpenAdd}
          className="btn-primary btn-sm flex items-center gap-1.5 ml-auto"
        >
          <span>➕</span> Add Category
        </button>
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border border-red-200 text-red-700 text-sm mb-6">
          ⚠ {error}
        </div>
      )}

      {/* Categories Cards Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 bg-blue-50/50 border-blue-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Categories</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{categories.length}</p>
        </div>
        <div className="card p-4 bg-emerald-50/50 border-emerald-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Assigned Items</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{totalProducts}</p>
        </div>
        <div className="card p-4 bg-purple-50/50 border-purple-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Categories</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">
            {categories.filter((c) => c.isActive !== false).length}
          </p>
        </div>
        <div className="card p-4 bg-amber-50/50 border-amber-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick Action</p>
          <button
            onClick={handleOpenAdd}
            className="mt-1 text-sm font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
          >
            + Create New Category →
          </button>
        </div>
      </div>

      {/* Main Categories Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Category Name</th>
                <th>Description</th>
                <th>Products Count</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j}>
                        <div className="skeleton h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <p className="text-3xl mb-2">🗂</p>
                      <p className="text-sm font-medium text-slate-700">No categories found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {search ? 'Try clearing your search query' : 'Create your first product category to organize your inventory'}
                      </p>
                      <button onClick={handleOpenAdd} className="btn-primary btn-sm mt-3">
                        + Add First Category
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat, idx) => (
                  <tr key={cat.id}>
                    <td className="text-slate-400 font-mono text-xs">{idx + 1}</td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {cat.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-900">{cat.name}</span>
                      </div>
                    </td>
                    <td className="text-slate-500 text-xs max-w-xs truncate">
                      {cat.description || '—'}
                    </td>
                    <td>
                      <Link
                        href={`/products?category=${encodeURIComponent(cat.id)}`}
                        className="badge badge-info hover:bg-blue-100 transition-colors"
                        title="View products in this category"
                      >
                        📦 {cat._count?.products || 0} Products
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${cat.isActive !== false ? 'badge-success' : 'badge-danger'}`}>
                        {cat.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(cat)}
                          className="btn-icon text-xs text-slate-600 hover:text-brand-600"
                          title="Edit Category"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(cat)}
                          disabled={deletingId === cat.id}
                          className="btn-icon text-xs text-slate-400 hover:text-red-600"
                          title="Deactivate Category"
                        >
                          {deletingId === cat.id ? '…' : '🗑️'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Category Modal / Slide-over */}
      {showDrawer && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button onClick={() => setShowDrawer(false)} className="btn-icon">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {drawerError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  {drawerError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="cat-name">Category Name *</label>
                <input
                  id="cat-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Fertilizers, Pesticides, Seeds…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="cat-desc">Description</label>
                <textarea
                  id="cat-desc"
                  rows={3}
                  className="form-input resize-none"
                  placeholder="Short description of products grouped in this category"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-primary flex-1 justify-center"
                >
                  {isSaving ? 'Saving…' : (editingCategory ? 'Update Category' : '+ Create Category')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDrawer(false)}
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
