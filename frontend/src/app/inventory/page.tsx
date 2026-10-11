'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { useI18n } from '@/contexts/I18nContext';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  brand?: string;
  unit: string;
  sellingPrice: number;
  purchasePrice: number;
  currentStock: number;
  lowStockThreshold: number;
  isActive: boolean;
  category?: { id: string; name: string };
}

interface Movement {
  id: string;
  productId: string;
  movementType: string;
  quantityChange: string | number;
  previousStock: string | number;
  resultingStock: string | number;
  unitCost?: string | number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
}

function formatINR(n: number | string) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InventoryPage() {
  const { t } = useI18n();

  // Active View Tab: 'stock' (Current Stock Levels) | 'movements' (Ledger & Audit)
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>('stock');

  // Stock Tab State
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [stockSearch, setStockSearch] = useState('');
  const [stockCategory, setStockCategory] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'HEALTHY' | 'LOW' | 'OUT'>('ALL');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Movements Tab State
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [totalMovements, setTotalMovements] = useState(0);
  const [movementsPage, setMovementsPage] = useState(1);
  const [filterProductId, setFilterProductId] = useState('');
  const [filterMovementType, setFilterMovementType] = useState('');
  const [showInfoBanner, setShowInfoBanner] = useState(true);

  // Manual Adjustment Modal State
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    productId: '',
    quantityChange: '',
    reason: '',
    unitCost: '',
  });
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState('');
  const [adjustSuccess, setAdjustSuccess] = useState('');

  // Load products list for Stock Levels tab & dropdowns
  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const { data } = await api.get('/products', { params: { limit: 100 } });
      const prods: Product[] = data.data || [];
      setProducts(prods);

      // Extract unique categories
      const catMap = new Map<string, string>();
      prods.forEach(p => {
        if (p.category?.id && p.category?.name) {
          catMap.set(p.category.id, p.category.name);
        }
      });
      setCategories(Array.from(catMap.entries()).map(([id, name]) => ({ id, name })));
    } catch (err) {
      console.error('Failed to load products for inventory:', err);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  // Load movements ledger
  const loadMovements = useCallback(async () => {
    setMovementsLoading(true);
    try {
      const { data } = await api.get('/reports/inventory-movements', {
        params: {
          page: movementsPage,
          limit: 20,
          productId: filterProductId || undefined,
          movementType: filterMovementType || undefined,
        },
      });
      setMovements(data.data || []);
      setTotalMovements(data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load stock movements:', err);
    } finally {
      setMovementsLoading(false);
    }
  }, [movementsPage, filterProductId, filterMovementType]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (activeTab === 'movements') {
      loadMovements();
    }
  }, [activeTab, loadMovements]);

  // Inventory KPI statistics
  const stats = useMemo(() => {
    const totalCount = products.length;
    let healthyCount = 0;
    let lowCount = 0;
    let outCount = 0;
    let totalStockUnits = 0;
    let totalStockValue = 0;

    products.forEach(p => {
      const stock = Number(p.currentStock || 0);
      const threshold = Number(p.lowStockThreshold || 0);
      const cost = Number(p.purchasePrice || 0);

      totalStockUnits += stock;
      totalStockValue += stock * cost;

      if (stock === 0) {
        outCount++;
      } else if (stock <= threshold) {
        lowCount++;
      } else {
        healthyCount++;
      }
    });

    return { totalCount, healthyCount, lowCount, outCount, totalStockUnits, totalStockValue };
  }, [products]);

  // Filtered products list for Current Stock tab
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const stock = Number(p.currentStock || 0);
      const threshold = Number(p.lowStockThreshold || 0);

      // Search match
      if (stockSearch.trim()) {
        const q = stockSearch.toLowerCase();
        const matchesName = p.name?.toLowerCase().includes(q);
        const matchesSku = p.sku?.toLowerCase().includes(q);
        const matchesBarcode = p.barcode?.toLowerCase().includes(q);
        const matchesBrand = p.brand?.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesBarcode && !matchesBrand) return false;
      }

      // Category match
      if (stockCategory && p.category?.id !== stockCategory) {
        return false;
      }

      // Status filter
      if (stockStatusFilter === 'HEALTHY' && (stock <= threshold || stock === 0)) return false;
      if (stockStatusFilter === 'LOW' && (stock > threshold || stock === 0)) return false;
      if (stockStatusFilter === 'OUT' && stock !== 0) return false;

      return true;
    });
  }, [products, stockSearch, stockCategory, stockStatusFilter]);

  // Selected product object for adjustment form
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === adjustForm.productId);
  }, [products, adjustForm.productId]);

  // Calculated stock preview in adjustment modal
  const calculatedStockAfter = useMemo(() => {
    if (!selectedProduct) return null;
    const current = Number(selectedProduct.currentStock || 0);
    const change = Number(adjustForm.quantityChange);
    if (isNaN(change)) return current;
    return current + change;
  }, [selectedProduct, adjustForm.quantityChange]);

  // Open adjust modal with preselected product
  const handleOpenAdjust = (prodId?: string) => {
    setAdjustError('');
    setAdjustSuccess('');
    setAdjustForm({
      productId: prodId || (products[0]?.id || ''),
      quantityChange: '',
      reason: '',
      unitCost: '',
    });
    setShowAdjustModal(true);
  };

  // Submit manual stock adjustment
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustForm.productId || !adjustForm.quantityChange || !adjustForm.reason.trim()) {
      setAdjustError('Please fill in Product, Quantity Change, and a clear Reason');
      return;
    }

    const qty = Number(adjustForm.quantityChange);
    if (isNaN(qty) || qty === 0) {
      setAdjustError('Quantity change must be a non-zero number (e.g. +10 or -5)');
      return;
    }

    setIsAdjusting(true);
    setAdjustError('');
    try {
      await api.post('/products/stock/adjust', {
        productId: adjustForm.productId,
        quantityChange: qty,
        reason: adjustForm.reason.trim(),
        unitCost: adjustForm.unitCost ? Number(adjustForm.unitCost) : undefined,
      });

      setAdjustSuccess('Stock updated successfully! Inventory balance updated.');
      loadProducts();
      if (activeTab === 'movements') {
        loadMovements();
      }

      setTimeout(() => {
        setShowAdjustModal(false);
        setAdjustSuccess('');
      }, 1200);
    } catch (err: any) {
      const errData = err?.response?.data;
      if (errData?.errors && Array.isArray(errData.errors)) {
        setAdjustError(errData.errors.map((e: any) => `${e.field ? `${e.field}: ` : ''}${e.message}`).join(', '));
      } else {
        setAdjustError(errData?.message || 'Stock adjustment failed');
      }
    } finally {
      setIsAdjusting(false);
    }
  };

  const MOVEMENT_BADGES: Record<string, { label: string; badge: string; icon: string }> = {
    PURCHASE_RECEIVED: { label: 'Purchase Inward', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '📥' },
    PURCHASE: { label: 'Purchase Inward', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '📥' },
    SALE: { label: 'POS Sale Outward', badge: 'bg-blue-50 text-blue-700 border-blue-200', icon: '🧾' },
    SALES_RETURN: { label: 'Customer Return', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: '↩' },
    PURCHASE_RETURN: { label: 'Supplier Return', badge: 'bg-orange-50 text-orange-700 border-orange-200', icon: '📤' },
    DAMAGE_ADJUSTMENT: { label: 'Damaged Stock', badge: 'bg-rose-50 text-rose-700 border-rose-200', icon: '⚠️' },
    LOSS_ADJUSTMENT: { label: 'Stock Loss / Theft', badge: 'bg-red-50 text-red-700 border-red-200', icon: '❌' },
    MANUAL_ADJUSTMENT: { label: 'Manual Adjustment', badge: 'bg-slate-100 text-slate-700 border-slate-300', icon: '⚖️' },
    OPENING_STOCK: { label: 'Opening Stock', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: '📦' },
  };

  return (
    <AppShell title={t('inventory.title')} subtitle="Live warehouse stock levels, adjustments & movement ledger">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
          <button
            id="tab-current-stock"
            onClick={() => setActiveTab('stock')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'stock'
                ? 'bg-white text-brand-700 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>📦</span>
            <span>Current Stock Levels (उपलब्ध स्टॉक)</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'stock' ? 'bg-brand-50 text-brand-700' : 'bg-slate-200 text-slate-600'}`}>
              {products.length}
            </span>
          </button>

          <button
            id="tab-stock-movements"
            onClick={() => setActiveTab('movements')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'movements'
                ? 'bg-white text-brand-700 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>📜</span>
            <span>Stock Movements Ledger (इतिहास व लेन-देन)</span>
            {totalMovements > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'movements' ? 'bg-brand-50 text-brand-700' : 'bg-slate-200 text-slate-600'}`}>
                {totalMovements}
              </span>
            )}
          </button>
        </div>

        {/* Global Action Button */}
        <button
          id="btn-adjust-stock-top"
          onClick={() => handleOpenAdjust()}
          className="btn-primary flex items-center justify-center gap-2 shadow-sm"
        >
          <span>⚖️</span>
          <span>Adjust Stock / स्टॉक बदलें</span>
        </button>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 border-l-4 border-l-brand-600 bg-white">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Products</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-slate-900">{stats.totalCount}</span>
            <span className="text-xs text-slate-400">Catalogue items</span>
          </div>
          <p className="text-xs text-brand-600 mt-2 font-medium">
            Total Units: <span className="font-bold text-slate-800">{stats.totalStockUnits.toLocaleString('en-IN')}</span>
          </p>
        </div>

        <div className="card p-4 border-l-4 border-l-emerald-500 bg-white">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Healthy Stock</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-emerald-600">{stats.healthyCount}</span>
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">In Stock</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Above reorder threshold</p>
        </div>

        <div className="card p-4 border-l-4 border-l-amber-500 bg-white">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Low Stock Warning</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-amber-600">{stats.lowCount}</span>
            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">Reorder</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">At or below minimum level</p>
        </div>

        <div className="card p-4 border-l-4 border-l-red-500 bg-white">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Out of Stock</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-red-600">{stats.outCount}</span>
            <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full font-medium">0 Units</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Urgent replenishment needed</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CURRENT STOCK LEVELS TABLE (Where I can see how much stock I have) */}
      {/* ========================================================================= */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="card p-4 bg-white flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex flex-1 flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input
                  id="stock-search-input"
                  type="text"
                  className="form-input pl-9 text-sm w-full"
                  placeholder="Search product name, SKU, brand…"
                  value={stockSearch}
                  onChange={e => setStockSearch(e.target.value)}
                />
              </div>

              {/* Category Filter */}
              {categories.length > 0 && (
                <select
                  id="stock-category-filter"
                  className="form-select text-sm max-w-xs"
                  value={stockCategory}
                  onChange={e => setStockCategory(e.target.value)}
                >
                  <option value="">All Categories ({categories.length})</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Status Filter Chips */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-slate-400 font-medium mr-1">Status:</span>
              <button
                type="button"
                onClick={() => setStockStatusFilter('ALL')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  stockStatusFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({products.length})
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter('HEALTHY')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  stockStatusFilter === 'HEALTHY'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                In Stock ({stats.healthyCount})
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter('LOW')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  stockStatusFilter === 'LOW'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Low Stock ({stats.lowCount})
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter('OUT')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  stockStatusFilter === 'OUT'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                Out of Stock ({stats.outCount})
              </button>
            </div>
          </div>

          {/* Current Stock Table */}
          <div className="card overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product & SKU</th>
                    <th>Category</th>
                    <th className="text-right">Current Available Stock</th>
                    <th className="text-right">Min Threshold</th>
                    <th>Stock Health Status</th>
                    <th className="text-right">Valuation (Cost × Qty)</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {productsLoading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(7)].map((_, j) => (
                          <td key={j}><div className="skeleton h-4 w-24" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state py-12 text-center">
                          <p className="text-4xl mb-2">📦</p>
                          <p className="text-slate-800 font-semibold">No products match your filters</p>
                          <p className="text-slate-400 text-sm mt-1">Try clearing your search or category filter</p>
                          {(stockSearch || stockCategory || stockStatusFilter !== 'ALL') && (
                            <button
                              onClick={() => { setStockSearch(''); setStockCategory(''); setStockStatusFilter('ALL'); }}
                              className="btn-secondary btn-sm mt-3"
                            >
                              Reset Filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(p => {
                      const stock = Number(p.currentStock || 0);
                      const threshold = Number(p.lowStockThreshold || 0);
                      const isOut = stock === 0;
                      const isLow = stock <= threshold && stock > 0;
                      const val = stock * Number(p.purchasePrice || 0);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Product Name & SKU */}
                          <td>
                            <div>
                              <p className="font-semibold text-slate-900 text-sm">{p.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {p.sku}
                                </span>
                                {p.brand && <span className="text-xs text-slate-400">{p.brand}</span>}
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td>
                            <span className="badge badge-gray text-xs">
                              {p.category?.name || 'General'}
                            </span>
                          </td>

                          {/* CURRENT AVAILABLE STOCK (Prominently Highlighted) */}
                          <td className="text-right">
                            <div className="inline-flex flex-col items-end">
                              <span
                                className={`text-base font-extrabold px-2.5 py-1 rounded-lg ${
                                  isOut
                                    ? 'bg-red-100 text-red-800 border border-red-200'
                                    : isLow
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {stock} <span className="text-xs font-semibold">{p.unit}</span>
                              </span>
                            </div>
                          </td>

                          {/* Threshold */}
                          <td className="text-right text-xs text-slate-500 font-medium">
                            Min {threshold} {p.unit}
                          </td>

                          {/* Stock Health Status */}
                          <td>
                            {isOut ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                                Out of Stock (0)
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                Low Stock Alert
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                Healthy
                              </span>
                            )}
                          </td>

                          {/* Valuation */}
                          <td className="text-right">
                            <p className="font-semibold text-slate-800 text-sm">{formatINR(val)}</p>
                            <p className="text-xs text-slate-400">@ {formatINR(p.purchasePrice)}/{p.unit}</p>
                          </td>

                          {/* Action Button */}
                          <td className="text-center">
                            <button
                              id={`btn-adjust-${p.id}`}
                              onClick={() => handleOpenAdjust(p.id)}
                              className="btn-secondary btn-xs inline-flex items-center gap-1 hover:border-brand-500 hover:text-brand-600"
                              title="Adjust stock for this product"
                            >
                              <span>⚖️</span>
                              <span>Adjust</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-600">
              <p>
                Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> products
              </p>
              <p>
                Total Inventory Valuation: <strong className="text-slate-900 font-bold">{formatINR(stats.totalStockValue)}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================================== */}
      {/* TAB 2: STOCK MOVEMENTS LEDGER (Explaining Stock Before, Quantity Change, and Stock After) */}
      {/* ======================================================================================== */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          {/* Educational Explanatory Banner (Answers 'What is before and after in inventory section') */}
          {showInfoBanner && (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border border-blue-200 rounded-xl p-4 shadow-sm relative animate-fade-in">
              <button
                onClick={() => setShowInfoBanner(false)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-sm"
                title="Dismiss"
              >
                ✕
              </button>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
                  💡
                </div>
                <div className="flex-1 pr-6">
                  <h4 className="font-bold text-blue-950 text-sm">
                    How Stock Ledger Works: What are &quot;Stock Before&quot; and &quot;Stock After&quot;? / स्टॉक लेजर समझें
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Every inventory movement tracks the precise state of your warehouse stock before and after each event:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <div className="bg-white/90 p-3 rounded-lg border border-blue-100 shadow-2xs">
                      <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs mb-1">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px]">1</span>
                        <span>Stock Before (पहले का स्टॉक)</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        The exact quantity of items physically available in your shop <strong>immediately before</strong> this transaction occurred.
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 italic">
                        (लेन-देन होने से ठीक पहले दुकान में कितना माल मौजूद था)
                      </p>
                    </div>

                    <div className="bg-white/90 p-3 rounded-lg border border-blue-100 shadow-2xs">
                      <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs mb-1">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">2</span>
                        <span>Qty Change (बदलाव / ट्रांजेक्शन)</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Number of units added (<strong className="text-emerald-700">+ Purchases, Inward, Restock</strong>) or deducted (<strong className="text-red-600">- Sales, Damages, Returns</strong>).
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 italic">
                        (कितना माल दुकान में नया आया (+) या बिका/खराब हुआ (-))
                      </p>
                    </div>

                    <div className="bg-white/90 p-3 rounded-lg border border-blue-100 shadow-2xs">
                      <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs mb-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px]">3</span>
                        <span>Stock After (बाद का बचा स्टॉक)</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        The new stock balance remaining in store <strong>after</strong> this transaction finished:
                        <code className="block mt-1 font-mono text-[11px] bg-slate-100 text-slate-800 px-1 py-0.5 rounded">
                          Before + Change = After
                        </code>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 italic">
                        (इस लेन-देन के बाद दुकान में कितना माल बाकी बचा)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Movements Filters */}
          <div className="card p-4 bg-white flex flex-col sm:flex-row gap-3 items-center">
            {/* Filter by Product */}
            <div className="flex-1 w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Filter by Product</label>
              <select
                id="filter-movement-product"
                className="form-select text-sm w-full"
                value={filterProductId}
                onChange={e => { setFilterProductId(e.target.value); setMovementsPage(1); }}
              >
                <option value="">All Products ({products.length})</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            {/* Filter by Movement Type */}
            <div className="w-full sm:w-64">
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Movement Type</label>
              <select
                id="filter-movement-type"
                className="form-select text-sm w-full"
                value={filterMovementType}
                onChange={e => { setFilterMovementType(e.target.value); setMovementsPage(1); }}
              >
                <option value="">All Event Types</option>
                <option value="PURCHASE_RECEIVED">Purchase Inward (+)</option>
                <option value="SALE">POS Sale Outward (-)</option>
                <option value="MANUAL_ADJUSTMENT">Manual Adjustment (⚖)</option>
                <option value="SALES_RETURN">Customer Return (+)</option>
                <option value="PURCHASE_RETURN">Supplier Return (-)</option>
                <option value="DAMAGE_ADJUSTMENT">Damage / Defect (-)</option>
                <option value="LOSS_ADJUSTMENT">Stock Loss / Theft (-)</option>
                <option value="OPENING_STOCK">Opening Stock (+)</option>
              </select>
            </div>

            {(filterProductId || filterMovementType) && (
              <div className="self-end pb-0.5">
                <button
                  onClick={() => { setFilterProductId(''); setFilterMovementType(''); setMovementsPage(1); }}
                  className="btn-secondary btn-sm"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          {/* Movements Ledger Table */}
          <div className="card overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Product</th>
                    <th>Movement Type</th>
                    <th className="text-right">Stock Before (पहले)</th>
                    <th className="text-center">Qty Change (+ / -)</th>
                    <th className="text-right">Stock After (बाद में)</th>
                    <th>Reference & Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {movementsLoading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(7)].map((_, j) => (
                          <td key={j}><div className="skeleton h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state py-12 text-center">
                          <p className="text-4xl mb-2">📋</p>
                          <p className="text-slate-800 font-semibold">No stock movements recorded yet</p>
                          <p className="text-slate-400 text-sm mt-1">
                            Movements are automatically logged whenever a sale, purchase, or manual adjustment takes place.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    movements.map(m => {
                      const qtyChange = Number(m.quantityChange || 0);
                      const isPositive = qtyChange > 0;
                      const before = Number(m.previousStock !== undefined ? m.previousStock : (m as any).stockBefore || 0);
                      const after = Number(m.resultingStock !== undefined ? m.resultingStock : (m as any).stockAfter || 0);
                      const unit = m.product?.unit || 'PCS';
                      const badgeInfo = MOVEMENT_BADGES[m.movementType] || {
                        label: m.movementType.replace(/_/g, ' '),
                        badge: 'bg-slate-100 text-slate-700 border-slate-200',
                        icon: '📦',
                      };

                      const dateStr = m.createdAt || (m as any).movementDate;
                      const formattedDate = dateStr
                        ? new Date(dateStr).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—';

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Date & Time */}
                          <td className="whitespace-nowrap">
                            <span className="text-xs font-medium text-slate-700 block">{formattedDate}</span>
                          </td>

                          {/* Product */}
                          <td>
                            <p className="font-semibold text-slate-900 text-sm">{m.product?.name || 'Unknown Product'}</p>
                            <span className="font-mono text-xs text-slate-400">{m.product?.sku}</span>
                          </td>

                          {/* Movement Type */}
                          <td>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${badgeInfo.badge}`}>
                              <span>{badgeInfo.icon}</span>
                              <span>{badgeInfo.label}</span>
                            </span>
                          </td>

                          {/* Stock Before (पहले) */}
                          <td className="text-right">
                            <div className="inline-flex flex-col items-end">
                              <span className="font-mono text-sm font-semibold text-slate-600">
                                {before} <span className="text-[11px] text-slate-400 font-normal">{unit}</span>
                              </span>
                              <span className="text-[10px] text-slate-400">Before</span>
                            </div>
                          </td>

                          {/* Qty Change */}
                          <td className="text-center">
                            <span
                              className={`inline-block font-mono text-xs font-extrabold px-2.5 py-1 rounded-full ${
                                isPositive
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-red-100 text-red-800 border border-red-300'
                              }`}
                            >
                              {isPositive ? `+${qtyChange}` : qtyChange} {unit}
                            </span>
                          </td>

                          {/* Stock After (बाद में) */}
                          <td className="text-right">
                            <div className="inline-flex flex-col items-end">
                              <span className="font-mono text-sm font-extrabold text-slate-900">
                                {after} <span className="text-[11px] text-slate-500 font-normal">{unit}</span>
                              </span>
                              <span className="text-[10px] text-emerald-600 font-medium">After</span>
                            </div>
                          </td>

                          {/* Reference & Reason */}
                          <td className="max-w-xs">
                            <p className="text-xs font-medium text-slate-800 truncate" title={m.reason || ''}>
                              {m.reason || (m.referenceType ? `${m.referenceType} # ${m.referenceId?.slice(0, 8)}` : '—')}
                            </p>
                            {m.referenceType && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                Ref: {m.referenceType}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {Math.ceil(totalMovements / 20) > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  Showing <strong>{((movementsPage - 1) * 20) + 1}</strong>–<strong>{Math.min(movementsPage * 20, totalMovements)}</strong> of <strong>{totalMovements}</strong> movements
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMovementsPage(p => Math.max(1, p - 1))}
                    disabled={movementsPage === 1}
                    className="btn-secondary btn-sm"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs font-medium self-center text-slate-600 px-2">
                    Page {movementsPage} of {Math.ceil(totalMovements / 20)}
                  </span>
                  <button
                    onClick={() => setMovementsPage(p => p + 1)}
                    disabled={movementsPage >= Math.ceil(totalMovements / 20)}
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
      {/* MANUAL STOCK ADJUSTMENT SLIDE-OVER MODAL                                    */}
      {/* ========================================================================= */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex justify-end animate-fade-in">
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl p-6 flex flex-col animate-slide-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>⚖️</span>
                  <span>Manual Stock Adjustment</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update inventory counts with audited reasons &amp; COGS valuation
                </p>
              </div>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="btn-icon text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAdjustSubmit} className="space-y-4 py-4 flex-1">
              {adjustError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                  <span className="text-red-500 font-bold">⚠</span>
                  <div className="flex-1">{adjustError}</div>
                </div>
              )}

              {adjustSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✅</span>
                  <div className="flex-1">{adjustSuccess}</div>
                </div>
              )}

              {/* Product Selection */}
              <div className="form-group">
                <label className="form-label font-semibold text-slate-800">Select Product *</label>
                <select
                  id="adjust-modal-product-select"
                  className="form-select w-full"
                  value={adjustForm.productId}
                  onChange={e => setAdjustForm(f => ({ ...f, productId: e.target.value }))}
                  required
                >
                  <option value="">Select a product to adjust</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (SKU: {p.sku}) — Available: {Number(p.currentStock)} {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Before & After Preview Card */}
              {selectedProduct && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Live Stock Calculation Preview</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500 font-medium block">Current (Before)</span>
                      <span className="text-lg font-bold text-slate-800">
                        {Number(selectedProduct.currentStock)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{selectedProduct.unit}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500 font-medium block">Adjustment</span>
                      <span className={`text-lg font-bold ${
                        Number(adjustForm.quantityChange) > 0
                          ? 'text-emerald-600'
                          : Number(adjustForm.quantityChange) < 0
                          ? 'text-red-600'
                          : 'text-slate-400'
                      }`}>
                        {Number(adjustForm.quantityChange) > 0 ? `+${adjustForm.quantityChange}` : adjustForm.quantityChange || '0'}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{selectedProduct.unit}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-brand-200 bg-brand-50/30">
                      <span className="text-[11px] text-brand-700 font-medium block">New Total (After)</span>
                      <span className="text-lg font-bold text-brand-700">
                        {calculatedStockAfter !== null ? calculatedStockAfter : '—'}
                      </span>
                      <span className="text-[10px] text-brand-600 block">{selectedProduct.unit}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quantity Change Input */}
              <div className="form-group">
                <label className="form-label font-semibold text-slate-800">Quantity Change (+ or -) *</label>
                <div className="relative">
                  <input
                    id="adjust-quantity-input"
                    type="number"
                    step="any"
                    className="form-input text-base font-semibold"
                    placeholder="Enter e.g. +10 (to add) or -5 (to deduct)"
                    value={adjustForm.quantityChange}
                    onChange={e => setAdjustForm(f => ({ ...f, quantityChange: e.target.value }))}
                    required
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  💡 Type a <strong>positive number</strong> (e.g. <code>10</code>) to increase stock, or a <strong>negative number</strong> (e.g. <code>-5</code>) to reduce stock.
                </p>
              </div>

              {/* Reason Input & Quick Chips */}
              <div className="form-group">
                <label className="form-label font-semibold text-slate-800">Reason for Adjustment *</label>
                <input
                  id="adjust-reason-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Physical inventory count correction"
                  value={adjustForm.reason}
                  onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))}
                  required
                />
                {/* Quick Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    'Stock count reconciliation',
                    'Damaged goods written off',
                    'Supplier bonus stock',
                    'Expired product removal',
                    'Returned by customer',
                  ].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setAdjustForm(f => ({ ...f, reason: chip }))}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded transition-colors"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unit Cost (Optional) */}
              <div className="form-group">
                <label className="form-label font-semibold text-slate-800">Unit Cost (₹) (Optional)</label>
                <input
                  id="adjust-unitcost-input"
                  type="number"
                  step="any"
                  className="form-input"
                  placeholder={selectedProduct ? `Current purchase cost: ₹${selectedProduct.purchasePrice}` : 'e.g. 250'}
                  value={adjustForm.unitCost}
                  onChange={e => setAdjustForm(f => ({ ...f, unitCost: e.target.value }))}
                />
                <p className="text-xs text-slate-400 mt-1">Leave empty to use the product&apos;s current purchase price for inventory valuation.</p>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="btn-secondary flex-1"
                disabled={isAdjusting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdjustSubmit}
                className="btn-primary flex-1"
                disabled={isAdjusting}
              >
                {isAdjusting ? 'Saving Adjustment…' : 'Apply Stock Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
