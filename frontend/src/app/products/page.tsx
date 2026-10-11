'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { useI18n } from '@/contexts/I18nContext';
import { useDebounce } from '@/hooks/useDebounce';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  brand?: string;
  unit: string;
  sellingPrice: number;
  wholesalePrice?: number;
  purchasePrice: number;
  gstRate: number;
  currentStock: number;
  lowStockThreshold: number;
  isActive: boolean;
  category?: { name: string };
  imageUrl?: string;
  primaryImageUrl?: string;
}

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function ProductsPage() {
  const { t } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const debouncedSearch = useDebounce(search, 400);

  // Load categories for filter dropdown
  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data.data || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/products', {
        params: {
          page,
          limit,
          search: debouncedSearch || undefined,
          categoryId: selectedCategory || undefined,
        },
      });
      setProducts(data.data);
      setTotal(data.pagination?.total || 0);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, selectedCategory]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to archive this product?')) return;
    setIsDeleting(true);
    try {
      await api.delete(`/products/${id}`);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Delete failed');
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const lowStockCount = products.filter(p => Number(p.currentStock) <= p.lowStockThreshold && Number(p.currentStock) > 0).length;
  const outOfStockCount = products.filter(p => Number(p.currentStock) === 0).length;
  const inStockCount = products.filter(p => Number(p.currentStock) > p.lowStockThreshold).length;

  return (
    <AppShell title={t('products.title')} subtitle={`${total} products in your catalogue`}>
      {/* Stock Overview Mini-Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="card p-3 bg-white border border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Products</span>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{total}</p>
        </div>
        <div className="card p-3 bg-emerald-50/50 border border-emerald-200">
          <span className="text-xs text-emerald-700 font-medium">In Stock</span>
          <p className="text-xl font-bold text-emerald-700 mt-0.5">{inStockCount}</p>
        </div>
        <div className="card p-3 bg-amber-50/50 border border-amber-200">
          <span className="text-xs text-amber-800 font-medium">Low Stock Warning</span>
          <p className="text-xl font-bold text-amber-700 mt-0.5">{lowStockCount}</p>
        </div>
        <div className="card p-3 bg-red-50/50 border border-red-200">
          <span className="text-xs text-red-800 font-medium">Out of Stock</span>
          <p className="text-xl font-bold text-red-700 mt-0.5">{outOfStockCount}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            id="product-search"
            type="text"
            className="form-input pl-9"
            placeholder={`${t('common.search')} products, SKU, barcode…`}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          id="product-category-filter"
          className="form-select max-w-xs text-xs"
          value={selectedCategory}
          onChange={e => { setSelectedCategory(e.target.value); setPage(1); }}
        >
          <option value="">All Categories ({categories.length})</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Link
            href="/inventory"
            id="btn-view-inventory"
            className="btn-secondary btn-sm flex items-center gap-1.5"
            title="View Live Inventory & Movements"
          >
            <span>📦</span>
            <span>Stock Ledger →</span>
          </Link>
          <a
            id="btn-export-products"
            href="/api/v1/reports/export/products"
            className="btn-secondary btn-sm"
            download
          >
            📥 {t('common.export')}
          </a>
          <Link id="btn-add-product" href="/products/new" className="btn-primary btn-sm">
            + {t('products.add')}
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Purchase Price</th>
                <th>Retail Price</th>
                <th>Wholesale Price</th>
                <th>GST</th>
                <th>Stock</th>
                <th>Status</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((_, j) => (
                      <td key={j}><div className="skeleton h-4 w-24 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <p className="text-3xl mb-2">📦</p>
                      <p className="text-sm">
                        {search ? 'No products match your search' : 'No products yet. '}
                        {!search && <Link href="/products/new" className="text-brand-600 hover:underline">Add your first product →</Link>}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : products.map((p) => {
                const isLow = Number(p.currentStock) <= p.lowStockThreshold && Number(p.currentStock) > 0;
                const isOut = Number(p.currentStock) === 0;
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 text-sm overflow-hidden border border-slate-200">
                          {p.primaryImageUrl || p.imageUrl ? (
                            <img
                              src={p.primaryImageUrl || p.imageUrl}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            '📦'
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 text-sm leading-tight">{p.name}</p>
                          {p.brand && <p className="text-xs text-slate-400">{p.brand}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-slate-500">{p.sku}</td>
                    <td>{p.category?.name || '—'}</td>
                    <td className="font-medium">{formatINR(p.purchasePrice)}</td>
                    <td className="font-semibold text-brand-700">{formatINR(p.sellingPrice)}</td>
                    <td className="font-semibold text-purple-700 text-xs">
                      {p.wholesalePrice ? formatINR(p.wholesalePrice) : <span className="text-slate-400 font-normal">—</span>}
                    </td>
                    <td>
                      <span className="badge badge-info">{p.gstRate}%</span>
                    </td>
                    <td>
                      <span className={`font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {Number(p.currentStock)} {p.unit}
                      </span>
                      {isOut && <span className="badge badge-danger ml-1 text-xs">Out</span>}
                      {isLow && <span className="badge badge-warning ml-1 text-xs">Low</span>}
                    </td>
                    <td>
                      <span className={`badge ${p.isActive ? 'badge-success' : 'badge-gray'}`}>
                        {p.isActive ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Link
                          href={`/products/${p.id}`}
                          id={`btn-edit-product-${p.id}`}
                          className="btn-icon text-xs"
                          title="Edit"
                        >
                          ✏️
                        </Link>
                        <button
                          id={`btn-delete-product-${p.id}`}
                          onClick={() => handleDelete(p.id)}
                          className="btn-icon text-xs hover:text-red-500"
                          title="Archive"
                          disabled={isDeleting && deleteId === p.id}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary btn-sm"
              >← Prev</button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary btn-sm"
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
