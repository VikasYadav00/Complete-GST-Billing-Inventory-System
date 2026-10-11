'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';

interface CartItem {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  gstRate: number;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

interface Customer { id: string; name: string; companyName?: string; customerType?: 'RETAIL' | 'WHOLESALE'; phone: string; gstin?: string; stateCode?: string; currentBalance?: number; }
interface Supplier { id: string; name: string; companyName?: string; phone: string; email?: string; gstin?: string; state?: string; stateCode?: string; address?: string; currentBalance?: number; }
interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  unit: string;
  sellingPrice: number;
  wholesalePrice?: number;
  gstRate: number;
  hsnCode: string;
  currentStock: number;
  categoryId?: string;
  category?: { id: string; name: string; color?: string };
  primaryImageUrl?: string;
}

function formatINR(n: number) {
  return `₹${Number(n).toFixed(2)}`;
}

export default function POSPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  const [business, setBusiness] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [partyType, setPartyType] = useState<'RETAIL' | 'WHOLESALE' | 'SUPPLIER'>('RETAIL');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);

  // Supplier state
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierResults, setSupplierResults] = useState<Supplier[]>([]);
  const [offsetSupplierDues, setOffsetSupplierDues] = useState(true);

  // Quick Add Customer modal state
  const [showQuickCustModal, setShowQuickCustModal] = useState(false);
  const [quickCustType, setQuickCustType] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [quickCustCompanyName, setQuickCustCompanyName] = useState('');
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustGstin, setQuickCustGstin] = useState('');
  const [isSavingQuickCust, setIsSavingQuickCust] = useState(false);
  const [quickCustError, setQuickCustError] = useState('');

  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Square Catalog Grid state
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [viewMode, setViewMode] = useState<'SPLIT' | 'GRID' | 'CART'>('SPLIT');

  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');
  const [invoiceDiscount, setInvoiceDiscount] = useState('0');
  const [isGstInvoice, setIsGstInvoice] = useState(true);
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [error, setError] = useState('');

  const productInputRef = useRef<HTMLInputElement>(null);

  // Load business profile to get tax pricing mode & settings
  useEffect(() => {
    api.get('/business/profile')
      .then(res => setBusiness(res.data.data))
      .catch(() => {});
  }, []);

  // Load catalog products & categories for square grid
  const loadCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    try {
      const [prodsRes, catsRes] = await Promise.all([
        api.get('/products', { params: { limit: 100 } }),
        api.get('/categories')
      ]);
      setCatalogProducts(prodsRes.data?.data || []);
      setCatalogCategories(catsRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load products/categories for catalog', err);
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const filteredCatalog = catalogProducts.filter(p => {
    const matchesCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory || (p as any).category?.id === selectedCategory;
    if (!matchesCat) return false;
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase().trim();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.category?.name && p.category.name.toLowerCase().includes(q))
    );
  });

  // Product search
  useEffect(() => {
    if (!productSearch.trim()) { setProductResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/products', { params: { search: productSearch, limit: 8 } });
        setProductResults(data.data || []);
        setShowProductDropdown(true);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Customer search (auto-filtered by type)
  useEffect(() => {
    if (!customerSearch.trim() || customerSearch.length < 2) { setCustomerResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const params: any = { search: customerSearch, limit: 6 };
        if (partyType === 'WHOLESALE') params.type = 'WHOLESALE';
        if (partyType === 'RETAIL') params.type = 'RETAIL';
        const { data } = await api.get('/customers', { params });
        setCustomerResults(data.data || []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, partyType]);

  // Check URL params for customerId or supplierId
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const custId = params.get('customerId');
      if (custId) {
        api.get(`/customers/${custId}`).then(res => {
          const c = res.data.data;
          if (c) {
            setCustomer(c);
            setPartyType(c.customerType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL');
          }
        }).catch(() => {});
      }
      const suppId = params.get('supplierId');
      if (suppId) {
        setPartyType('SUPPLIER');
        api.get('/purchases/suppliers').then(res => {
          const list: Supplier[] = res.data.data || [];
          const found = list.find(s => s.id === suppId);
          if (found) setSupplier(found);
        }).catch(() => {});
      }
    }
  }, []);

  // Supplier search
  useEffect(() => {
    if (!supplierSearch.trim() || supplierSearch.length < 2) { setSupplierResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/purchases/suppliers', { params: { search: supplierSearch, limit: 8 } });
        setSupplierResults(data.data || []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [supplierSearch]);

  const addToCart = useCallback((product: Product, keepSearch = false) => {
    const isWholesaleMode = partyType === 'WHOLESALE';
    const effectivePrice = (isWholesaleMode && product.wholesalePrice != null && Number(product.wholesalePrice) > 0)
      ? Number(product.wholesalePrice)
      : Number(product.sellingPrice);

    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id
          ? { ...i, quantity: i.quantity + 1 }
          : i
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        gstRate: Number(product.gstRate),
        hsnCode: product.hsnCode || '',
        quantity: 1,
        unitPrice: effectivePrice,
        discountPercent: 0,
      }];
    });
    if (!keepSearch) {
      setProductSearch('');
      setProductResults([]);
      setShowProductDropdown(false);
      productInputRef.current?.focus();
    }
  }, [partyType]);

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.productId !== productId));
    } else {
      setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i));
    }
  };

  const updateDiscount = (productId: string, discount: number) => {
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, discountPercent: Math.max(0, Math.min(100, discount)) } : i));
  };

  const updatePrice = (productId: string, price: number) => {
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, unitPrice: Math.max(0, price) } : i));
  };

  // Quick Add Customer Handler
  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName.trim()) { setQuickCustError('Name is required'); return; }
    if (!quickCustPhone.trim()) { setQuickCustError('Phone number is required'); return; }
    if (quickCustType === 'WHOLESALE' && !quickCustCompanyName.trim()) {
      setQuickCustError('Firm / Company Name is required for Wholesale Parties');
      return;
    }

    setIsSavingQuickCust(true);
    setQuickCustError('');
    try {
      const res = await api.post('/customers', {
        customerType: quickCustType,
        companyName: quickCustCompanyName.trim() || undefined,
        name: quickCustName.trim(),
        phone: quickCustPhone.trim(),
        gstin: quickCustGstin.trim() ? quickCustGstin.trim().toUpperCase() : undefined,
        state: business?.state || 'Delhi',
        stateCode: business?.stateCode || '07',
      });
      const newCust = res.data.data;
      setCustomer(newCust);
      setCustomerSearch('');
      setShowQuickCustModal(false);
      setQuickCustCompanyName('');
      setQuickCustName('');
      setQuickCustPhone('');
      setQuickCustGstin('');
      setError('');
    } catch (err: any) {
      setQuickCustError(err?.response?.data?.message || 'Failed to add party');
    } finally {
      setIsSavingQuickCust(false);
    }
  };

  // Calculate totals synchronized with backend GST calculation
  const isExclusive = business?.taxPricingMode !== 'INCLUSIVE';

  const totals = cart.reduce((acc, item) => {
    const lineGross = item.quantity * item.unitPrice;
    const lineDiscount = lineGross * (item.discountPercent / 100);
    const lineNet = Math.max(0, lineGross - lineDiscount);

    let taxable = lineNet;
    let gst = 0;
    if (isGstInvoice && item.gstRate > 0) {
      if (isExclusive) {
        taxable = lineNet;
        gst = taxable * (item.gstRate / 100);
      } else {
        taxable = (lineNet * 100) / (100 + item.gstRate);
        gst = lineNet - taxable;
      }
    }

    acc.subTotal += lineGross;
    acc.discount += lineDiscount;
    acc.taxable += taxable;
    acc.gst += gst;
    return acc;
  }, { subTotal: 0, discount: 0, taxable: 0, gst: 0 });

  const invDiscount = Number(invoiceDiscount) || 0;
  const grandTotal = isExclusive
    ? Math.round((totals.taxable - invDiscount + (isGstInvoice ? totals.gst : 0)) * 100) / 100
    : Math.round((totals.subTotal - totals.discount - invDiscount) * 100) / 100;

  const currentPaid = paidAmount === ''
    ? (paymentMethod === 'CREDIT' ? 0 : grandTotal)
    : Number(paidAmount);
  const balanceDue = Math.round((grandTotal - currentPaid) * 100) / 100;

  const handleCheckout = async () => {
    if (cart.length === 0) { setError('Please add at least one item'); return; }

    const isCredit = paymentMethod === 'CREDIT';
    const finalPaid = paidAmount === '' ? (isCredit ? 0 : grandTotal) : Number(paidAmount);
    const effectiveBalance = Math.max(0, Math.round((grandTotal - finalPaid) * 100) / 100);

    // Require party for credit or partial payment
    if (partyType === 'RETAIL' || partyType === 'WHOLESALE') {
      if ((isCredit || effectiveBalance > 0) && !customer) {
        setError(`A ${partyType === 'WHOLESALE' ? 'Wholesale Party' : 'Customer'} is required for Credit sales or when there is an unpaid balance. Please select or add a ${partyType === 'WHOLESALE' ? 'party' : 'customer'}.`);
        return;
      }
    } else if (partyType === 'SUPPLIER') {
      if (!supplier) {
        setError('Please select a supplier to proceed with selling to supplier.');
        return;
      }
    }

    setError('');
    setIsSubmitting(true);

    const idempotencyKey = `pos_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const payload = {
      customerId: (partyType === 'RETAIL' || partyType === 'WHOLESALE') ? (customer?.id || null) : null,
      supplierId: partyType === 'SUPPLIER' ? supplier?.id : null,
      saleType: partyType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
      offsetSupplierDues: (partyType === 'SUPPLIER' && isCredit) ? offsetSupplierDues : false,
      items: cart.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountPercent: i.discountPercent,
        hsnCode: i.hsnCode,
        gstRate: i.gstRate,
      })),
      paymentMethod,
      paidAmount: finalPaid,
      invoiceDiscountAmount: invDiscount,
      isGstInvoice,
      notes,
      idempotencyKey,
    };

    try {
      const { data } = await api.post('/sales', payload);
      setLastInvoice(data.data);
      setCart([]);
      setCustomer(null);
      setCustomerSearch('');
      setSupplier(null);
      setSupplierSearch('');
      setPaidAmount('');
      setInvoiceDiscount('0');
      setNotes('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Checkout failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const printInvoice = () => {
    window.open(`/sales/${lastInvoice?.id}/print`, '_blank');
  };

  return (
    <AppShell title="POS Billing" subtitle="Create sales invoice">
      {lastInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-8 text-center animate-fade-in shadow-2xl">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Invoice Created Successfully!</h2>
            <p className="text-brand-600 font-mono font-bold text-lg mb-4">{lastInvoice.invoiceNumber}</p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm space-y-2 text-left mb-6">
              <div className="flex justify-between">
                <span className="text-slate-600">Grand Total:</span>
                <span className="font-bold text-slate-900">{formatINR(lastInvoice.grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Amount Paid:</span>
                <span className="font-semibold text-emerald-700">{formatINR(lastInvoice.paidAmount)}</span>
              </div>
              {Number(lastInvoice.balanceAmount) > 0 && (
                <div className="flex justify-between text-red-600 font-bold border-t border-slate-200 pt-1">
                  <span>Balance Due (Credit):</span>
                  <span>{formatINR(lastInvoice.balanceAmount)}</span>
                </div>
              )}
              {lastInvoice.supplier ? (
                <div className="text-xs text-purple-700 pt-1 border-t border-slate-200">
                  🏭 Sold to Supplier: <strong>{lastInvoice.supplier.companyName || lastInvoice.supplier.name}</strong> ({lastInvoice.supplier.phone})
                </div>
              ) : lastInvoice.saleType === 'WHOLESALE' || (lastInvoice.customer && lastInvoice.customer.customerType === 'WHOLESALE') ? (
                <div className="text-xs text-amber-800 pt-1 border-t border-slate-200">
                  🏢 Wholesale Party: <strong>{lastInvoice.customer?.companyName || lastInvoice.customer?.name || 'Wholesale Buyer'}</strong>
                  {lastInvoice.customer?.companyName && <span className="text-slate-500"> ({lastInvoice.customer.name})</span>}
                </div>
              ) : lastInvoice.customer ? (
                <div className="text-xs text-slate-600 pt-1 border-t border-slate-200">
                  👤 Retail Customer: <strong>{lastInvoice.customer.name}</strong> ({lastInvoice.customer.phone})
                </div>
              ) : null}
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={printInvoice} className="btn-primary">🖨 Print Invoice</button>
              <button onClick={() => setLastInvoice(null)} className="btn-secondary">New Sale</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-full">
        {/* Left — Cart */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Product search & Catalog Controls */}
          <div className="card p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input
                  id="pos-product-search"
                  ref={productInputRef}
                  type="text"
                  className="form-input pl-9 pr-8"
                  placeholder="Search product by name, SKU or barcode…"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  onFocus={() => productResults.length > 0 && setShowProductDropdown(true)}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearch('');
                      setProductResults([]);
                      setShowProductDropdown(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs w-5 h-5 rounded-full flex items-center justify-center bg-slate-100 transition-colors"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
                {showProductDropdown && productResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 card shadow-xl z-30 overflow-hidden max-h-64 overflow-y-auto border border-slate-200">
                    {productResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors border-b border-slate-100 last:border-0"
                        onMouseDown={() => addToCart(p, false)}
                      >
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm flex-shrink-0 overflow-hidden border border-slate-200">
                          {p.primaryImageUrl ? (
                            <img src={p.primaryImageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            '📦'
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.sku} · {p.unit} · GST {p.gstRate}%</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-brand-700">
                            {partyType === 'WHOLESALE' && p.wholesalePrice != null && Number(p.wholesalePrice) > 0
                              ? formatINR(p.wholesalePrice)
                              : formatINR(p.sellingPrice)}
                          </p>
                          {partyType === 'WHOLESALE' && p.wholesalePrice != null && Number(p.wholesalePrice) > 0 && (
                            <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1 py-0.5 rounded border border-amber-200 block">
                              Wholesale Rate
                            </span>
                          )}
                          <p className={`text-xs ${Number(p.currentStock) === 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            Stock: {Number(p.currentStock)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={loadCatalog}
                disabled={isLoadingCatalog}
                className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 whitespace-nowrap"
                title="Refresh products list"
              >
                <span className={isLoadingCatalog ? 'animate-spin' : ''}>🔄</span>
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Main Container: Square Product Catalog & Cart */}
          <div className="card flex-1 overflow-hidden flex flex-col min-h-[500px]">
            {cart.length === 0 ? (
              /* Case 1: Empty Cart -> Full Square Products Catalog Grid */
              <div className="flex flex-col h-full flex-1">
                {/* Header bar */}
                <div className="p-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📦</span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">
                        Product Catalog (उत्पाद सूची)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Square card par click karke cart mein add karein
                      </p>
                    </div>
                    <span className="text-xs bg-brand-100 text-brand-800 font-bold px-2 py-0.5 rounded-full ml-1">
                      {filteredCatalog.length} {filteredCatalog.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="text-xs text-brand-600 hover:text-brand-800 font-medium bg-brand-50 px-2 py-1 rounded"
                    >
                      Clear search: "{productSearch}"
                    </button>
                  )}
                </div>

                {/* Category Chips Bar */}
                <div className="px-3 py-2 border-b border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap ${
                      selectedCategory === 'ALL'
                        ? 'bg-brand-600 text-white shadow-xs font-semibold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Products ({catalogProducts.length})
                  </button>
                  {catalogCategories.map(cat => {
                    const count = catalogProducts.filter(p => p.categoryId === cat.id || (p.category && p.category.id === cat.id)).length;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap ${
                          selectedCategory === cat.id
                            ? 'bg-brand-600 text-white shadow-xs font-semibold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat.name} {count > 0 && `(${count})`}
                      </button>
                    );
                  })}
                </div>

                {/* Square Cards Grid */}
                <div className="p-3.5 overflow-y-auto flex-1 max-h-[calc(100vh-270px)]">
                  {isLoadingCatalog && catalogProducts.length === 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="aspect-square rounded-2xl border border-slate-200 bg-slate-50 animate-pulse p-3 flex flex-col justify-between" />
                      ))}
                    </div>
                  ) : filteredCatalog.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <span className="text-4xl mb-2">🔍</span>
                      <p className="text-sm font-semibold text-slate-700">Koi product nahi mila</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {productSearch ? `"${productSearch}" se match hone wala koi product nahi hai` : 'Is category mein koi product nahi hai'}
                      </p>
                      {(productSearch || selectedCategory !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => {
                            setProductSearch('');
                            setSelectedCategory('ALL');
                          }}
                          className="mt-3 btn-secondary text-xs px-3 py-1.5"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {filteredCatalog.map(p => {
                        const inCartItem = cart.find(i => i.productId === p.id);
                        const inCartQty = inCartItem?.quantity || 0;
                        const isWholesaleMode = partyType === 'WHOLESALE';
                        const effectivePrice = (isWholesaleMode && p.wholesalePrice != null && Number(p.wholesalePrice) > 0)
                          ? Number(p.wholesalePrice)
                          : Number(p.sellingPrice);

                        return (
                          <div
                            key={p.id}
                            id={`pos-card-${p.id}`}
                            onClick={() => addToCart(p, true)}
                            className={`group relative flex flex-col justify-between p-3 rounded-2xl border transition-all duration-200 cursor-pointer select-none text-left aspect-square overflow-hidden hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 ${
                              inCartQty > 0
                                ? 'border-brand-500 bg-gradient-to-br from-brand-50/70 to-white shadow-md ring-2 ring-brand-500/30'
                                : 'border-slate-200 bg-white hover:border-brand-400 hover:shadow-brand-100/50'
                            }`}
                          >
                            {/* Top row: Category tag & stock info & in-cart badge */}
                            <div className="flex items-start justify-between gap-1 w-full">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 truncate max-w-[120px]">
                                {p.category?.name || p.unit || 'ITEM'}
                              </span>
                              {inCartQty > 0 ? (
                                <span className="bg-brand-600 text-white font-bold text-[11px] px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                  ✓ {inCartQty}
                                </span>
                              ) : (
                                <span
                                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                    Number(p.currentStock) > 10
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : Number(p.currentStock) > 0
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-red-50 text-red-600 border border-red-200'
                                  }`}
                                >
                                  {Number(p.currentStock) > 0 ? `${p.currentStock} ${p.unit}` : 'Out'}
                                </span>
                              )}
                            </div>

                            {/* Center: Product name and SKU */}
                            <div className="my-auto py-1 flex items-start gap-2">
                              {p.primaryImageUrl ? (
                                <img
                                  src={p.primaryImageUrl}
                                  alt={p.name}
                                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                              ) : null}
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-brand-600 line-clamp-2 leading-tight transition-colors">
                                  {p.name}
                                </h4>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">{p.sku}</p>
                              </div>
                            </div>

                            {/* Bottom row: Price & Quantity / Add (+) button */}
                            <div className="pt-2 border-t border-slate-100 flex items-end justify-between gap-1 w-full">
                              <div className="min-w-0">
                                <span className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight block truncate">
                                  {effectivePrice > 0 ? formatINR(effectivePrice) : (
                                    <span className="text-amber-600 text-xs font-semibold">₹ Rate daalein</span>
                                  )}
                                </span>
                                {isWholesaleMode && p.wholesalePrice != null && Number(p.wholesalePrice) > 0 ? (
                                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                                    Wholesale
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-slate-400 block mt-0.5 leading-none">
                                    GST {p.gstRate}%
                                  </span>
                                )}
                              </div>

                              {inCartQty > 0 ? (
                                <div
                                  className="flex items-center gap-1 bg-white border border-brand-300 rounded-lg p-0.5 shadow-xs"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => updateQty(p.id, inCartQty - 1)}
                                    className="w-5 h-5 rounded bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 font-bold flex items-center justify-center text-xs transition-colors"
                                    title="Decrease quantity"
                                  >
                                    −
                                  </button>
                                  <span className="text-xs font-bold text-brand-700 px-0.5 min-w-[14px] text-center">
                                    {inCartQty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateQty(p.id, inCartQty + 1)}
                                    className="w-5 h-5 rounded bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center justify-center text-xs transition-colors"
                                    title="Increase quantity"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="w-7 h-7 rounded-xl bg-slate-100 group-hover:bg-brand-600 group-hover:text-white text-slate-700 font-bold flex items-center justify-center text-sm shadow-xs transition-colors flex-shrink-0"
                                  title="Add to cart"
                                >
                                  +
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Case 2: Items in Cart -> View Switcher with Split, Grid, and Cart views */
              <div className="flex flex-col h-full flex-1">
                {/* Header with View Switcher */}
                <div className="p-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🛒</span> Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})
                    </span>
                    <span className="text-xs font-extrabold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                      Total: {formatINR(grandTotal)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-xs">
                      <button
                        type="button"
                        id="pos-view-split"
                        onClick={() => setViewMode('SPLIT')}
                        className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                          viewMode === 'SPLIT'
                            ? 'bg-brand-600 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Show both product grid and cart table"
                      >
                        ⊟ Split View
                      </button>
                      <button
                        type="button"
                        id="pos-view-grid"
                        onClick={() => setViewMode('GRID')}
                        className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                          viewMode === 'GRID'
                            ? 'bg-brand-600 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Show full square product cards"
                      >
                        ⊞ Products ({filteredCatalog.length})
                      </button>
                      <button
                        type="button"
                        id="pos-view-cart"
                        onClick={() => setViewMode('CART')}
                        className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                          viewMode === 'CART'
                            ? 'bg-brand-600 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Show cart table only"
                      >
                        📋 Cart Table
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded font-medium transition-colors"
                      title="Clear all items from cart"
                    >
                      🗑️ Clear
                    </button>
                  </div>
                </div>

                {/* Sub-view: SPLIT (Square Grid on top + Cart Table on bottom) */}
                {viewMode === 'SPLIT' && (
                  <div className="flex flex-col flex-1 divide-y divide-slate-200">
                    {/* Top: Square Product Grid */}
                    <div className="max-h-60 sm:max-h-64 overflow-hidden flex flex-col bg-slate-50/40">
                      <div className="px-3 py-1.5 bg-white border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedCategory('ALL')}
                          className={`px-2.5 py-0.5 rounded-full font-medium transition-all whitespace-nowrap text-[11px] ${
                            selectedCategory === 'ALL'
                              ? 'bg-brand-600 text-white font-semibold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          All ({catalogProducts.length})
                        </button>
                        {catalogCategories.map(cat => {
                          const count = catalogProducts.filter(p => p.categoryId === cat.id || (p.category && p.category.id === cat.id)).length;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setSelectedCategory(cat.id)}
                              className={`px-2.5 py-0.5 rounded-full font-medium transition-all whitespace-nowrap text-[11px] ${
                                selectedCategory === cat.id
                                  ? 'bg-brand-600 text-white font-semibold'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {cat.name} {count > 0 && `(${count})`}
                            </button>
                          );
                        })}
                      </div>

                      <div className="p-2.5 overflow-y-auto max-h-52 sm:max-h-56">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                          {filteredCatalog.map(p => {
                            const inCartItem = cart.find(i => i.productId === p.id);
                            const inCartQty = inCartItem?.quantity || 0;
                            const isWholesaleMode = partyType === 'WHOLESALE';
                            const effectivePrice = (isWholesaleMode && p.wholesalePrice != null && Number(p.wholesalePrice) > 0)
                              ? Number(p.wholesalePrice)
                              : Number(p.sellingPrice);

                            return (
                              <div
                                key={p.id}
                                onClick={() => addToCart(p, true)}
                                className={`group relative flex flex-col justify-between p-2.5 rounded-xl border transition-all duration-150 cursor-pointer select-none text-left aspect-square overflow-hidden hover:shadow-md ${
                                  inCartQty > 0
                                    ? 'border-brand-500 bg-brand-50/60 shadow-xs ring-1 ring-brand-500'
                                    : 'border-slate-200 bg-white hover:border-brand-400'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1 w-full">
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 truncate max-w-[75px]">
                                    {p.category?.name || p.unit || 'ITEM'}
                                  </span>
                                  {inCartQty > 0 ? (
                                    <span className="bg-brand-600 text-white font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                                      ✓ {inCartQty}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-400">
                                      {p.currentStock} {p.unit}
                                    </span>
                                  )}
                                </div>

                                <div className="my-auto py-0.5 flex items-start gap-1.5">
                                  {p.primaryImageUrl ? (
                                    <img
                                      src={p.primaryImageUrl}
                                      alt={p.name}
                                      className="w-7 h-7 rounded-md object-cover flex-shrink-0 border border-slate-200"
                                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                    />
                                  ) : null}
                                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-brand-600 line-clamp-2 leading-tight flex-1">
                                    {p.name}
                                  </h4>
                                </div>

                                <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-1 w-full">
                                  <span className="text-xs font-extrabold text-slate-900 truncate">
                                    {effectivePrice > 0 ? formatINR(effectivePrice) : <span className="text-amber-600 text-[10px]">Rate daalein</span>}
                                  </span>
                                  {inCartQty > 0 ? (
                                    <div
                                      className="flex items-center gap-0.5 bg-white border border-brand-300 rounded p-0.5"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => updateQty(p.id, inCartQty - 1)}
                                        className="w-4 h-4 rounded bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px]"
                                      >
                                        −
                                      </button>
                                      <span className="text-[11px] font-bold text-brand-700 px-0.5">
                                        {inCartQty}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => updateQty(p.id, inCartQty + 1)}
                                        className="w-4 h-4 rounded bg-brand-600 text-white font-bold flex items-center justify-center text-[10px]"
                                      >
                                        +
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="w-5 h-5 rounded-lg bg-slate-100 group-hover:bg-brand-600 group-hover:text-white text-slate-700 font-bold flex items-center justify-center text-xs">
                                      +
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Cart Table */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                      <div className="px-3 py-1.5 bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-700 flex justify-between items-center">
                        <span>Cart Items ({cart.length})</span>
                        <span className="text-[11px] text-slate-500 font-normal">Edit rate, qty or discount below</span>
                      </div>
                      <div className="table-container flex-1 overflow-y-auto max-h-[300px]">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Sell Rate (₹)</th>
                              <th>Qty</th>
                              <th>Disc%</th>
                              <th>GST</th>
                              <th>Total</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {cart.map(item => {
                              const lineBase = item.quantity * item.unitPrice;
                              const lineDiscount = lineBase * (item.discountPercent / 100);
                              const taxable = lineBase - lineDiscount;
                              const gstAmt = taxable * (item.gstRate / 100);
                              const lineTotal = taxable + gstAmt;
                              return (
                                <tr key={item.productId}>
                                  <td>
                                    <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                                    <p className="text-xs text-slate-400">{item.sku}</p>
                                  </td>
                                  <td>
                                    <div className="relative">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className={`form-input w-28 text-xs px-2 py-1.5 font-bold ${
                                          Number(item.unitPrice) === 0
                                            ? 'border-amber-400 bg-amber-50 text-amber-900 focus:border-amber-600 focus:bg-white animate-pulse'
                                            : 'border-blue-200 bg-blue-50/40 text-blue-900 focus:border-brand-500 focus:bg-white'
                                        }`}
                                        placeholder="0.00"
                                        value={item.unitPrice === 0 ? '' : item.unitPrice}
                                        onChange={e => updatePrice(item.productId, parseFloat(e.target.value) || 0)}
                                        title="Click to enter or change selling price"
                                      />
                                      {Number(item.unitPrice) === 0 && (
                                        <span className="block text-[10px] text-amber-700 font-semibold mt-0.5 whitespace-nowrap">
                                          ⚠️ Rate bharein
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-sm font-bold">−</button>
                                      <input
                                        type="number"
                                        min="1"
                                        className="form-input w-14 text-center text-xs px-1 py-1"
                                        value={item.quantity}
                                        onChange={e => updateQty(item.productId, parseInt(e.target.value) || 1)}
                                      />
                                      <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-sm font-bold">+</button>
                                    </div>
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      max="100"
                                      className="form-input w-16 text-xs px-2 py-1"
                                      value={item.discountPercent}
                                      onChange={e => updateDiscount(item.productId, parseFloat(e.target.value) || 0)}
                                    />
                                  </td>
                                  <td>
                                    <span className="badge badge-info text-xs">{item.gstRate}%</span>
                                    <p className="text-xs text-slate-400 mt-0.5">{formatINR(gstAmt)}</p>
                                  </td>
                                  <td className="font-semibold text-slate-900">{formatINR(lineTotal)}</td>
                                  <td>
                                    <button onClick={() => updateQty(item.productId, 0)} className="btn-icon hover:text-red-500 text-xs">✕</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-view: GRID ONLY */}
                {viewMode === 'GRID' && (
                  <div className="flex flex-col flex-1">
                    <div className="px-3 py-2 border-b border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('ALL')}
                        className={`px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap ${
                          selectedCategory === 'ALL'
                            ? 'bg-brand-600 text-white shadow-xs font-semibold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        All Products ({catalogProducts.length})
                      </button>
                      {catalogCategories.map(cat => {
                        const count = catalogProducts.filter(p => p.categoryId === cat.id || (p.category && p.category.id === cat.id)).length;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap ${
                              selectedCategory === cat.id
                                ? 'bg-brand-600 text-white shadow-xs font-semibold'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {cat.name} {count > 0 && `(${count})`}
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-3.5 overflow-y-auto flex-1 max-h-[calc(100vh-320px)]">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {filteredCatalog.map(p => {
                          const inCartItem = cart.find(i => i.productId === p.id);
                          const inCartQty = inCartItem?.quantity || 0;
                          const isWholesaleMode = partyType === 'WHOLESALE';
                          const effectivePrice = (isWholesaleMode && p.wholesalePrice != null && Number(p.wholesalePrice) > 0)
                            ? Number(p.wholesalePrice)
                            : Number(p.sellingPrice);

                          return (
                            <div
                              key={p.id}
                              id={`pos-card-${p.id}`}
                              onClick={() => addToCart(p, true)}
                              className={`group relative flex flex-col justify-between p-3 rounded-2xl border transition-all duration-200 cursor-pointer select-none text-left aspect-square overflow-hidden hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 ${
                                inCartQty > 0
                                  ? 'border-brand-500 bg-gradient-to-br from-brand-50/70 to-white shadow-md ring-2 ring-brand-500/30'
                                  : 'border-slate-200 bg-white hover:border-brand-400 hover:shadow-brand-100/50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1 w-full">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 truncate max-w-[120px]">
                                  {p.category?.name || p.unit || 'ITEM'}
                                </span>
                                {inCartQty > 0 ? (
                                  <span className="bg-brand-600 text-white font-bold text-[11px] px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                    ✓ {inCartQty}
                                  </span>
                                ) : (
                                  <span
                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                      Number(p.currentStock) > 10
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : Number(p.currentStock) > 0
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-red-50 text-red-600 border border-red-200'
                                    }`}
                                  >
                                    {Number(p.currentStock) > 0 ? `${p.currentStock} ${p.unit}` : 'Out'}
                                  </span>
                                )}
                              </div>

                              <div className="my-auto py-1 flex items-start gap-2">
                                {p.primaryImageUrl ? (
                                  <img
                                    src={p.primaryImageUrl}
                                    alt={p.name}
                                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                  />
                                ) : null}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-brand-600 line-clamp-2 leading-tight transition-colors">
                                    {p.name}
                                  </h4>
                                  <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">{p.sku}</p>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-100 flex items-end justify-between gap-1 w-full">
                                <div className="min-w-0">
                                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight block truncate">
                                    {effectivePrice > 0 ? formatINR(effectivePrice) : (
                                      <span className="text-amber-600 text-xs font-semibold">₹ Rate daalein</span>
                                    )}
                                  </span>
                                  {isWholesaleMode && p.wholesalePrice != null && Number(p.wholesalePrice) > 0 ? (
                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                                      Wholesale
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-400 block mt-0.5 leading-none">
                                      GST {p.gstRate}%
                                    </span>
                                  )}
                                </div>

                                {inCartQty > 0 ? (
                                  <div
                                    className="flex items-center gap-1 bg-white border border-brand-300 rounded-lg p-0.5 shadow-xs"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => updateQty(p.id, inCartQty - 1)}
                                      className="w-5 h-5 rounded bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 font-bold flex items-center justify-center text-xs transition-colors"
                                    >
                                      −
                                    </button>
                                    <span className="text-xs font-bold text-brand-700 px-0.5 min-w-[14px] text-center">
                                      {inCartQty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => updateQty(p.id, inCartQty + 1)}
                                      className="w-5 h-5 rounded bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center justify-center text-xs transition-colors"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="w-7 h-7 rounded-xl bg-slate-100 group-hover:bg-brand-600 group-hover:text-white text-slate-700 font-bold flex items-center justify-center text-sm shadow-xs transition-colors flex-shrink-0"
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        🛒 {cart.length} items in cart · Total: <strong className="text-brand-700 font-bold">{formatINR(grandTotal)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setViewMode('CART')}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        Go to Cart Table →
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub-view: CART TABLE ONLY */}
                {viewMode === 'CART' && (
                  <div className="flex flex-col flex-1">
                    <div className="table-container flex-1 overflow-y-auto max-h-[calc(100vh-320px)]">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Sell Rate (₹)</th>
                            <th>Qty</th>
                            <th>Disc%</th>
                            <th>GST</th>
                            <th>Total</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {cart.map(item => {
                            const lineBase = item.quantity * item.unitPrice;
                            const lineDiscount = lineBase * (item.discountPercent / 100);
                            const taxable = lineBase - lineDiscount;
                            const gstAmt = taxable * (item.gstRate / 100);
                            const lineTotal = taxable + gstAmt;
                            return (
                              <tr key={item.productId}>
                                <td>
                                  <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                                  <p className="text-xs text-slate-400">{item.sku}</p>
                                </td>
                                <td>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className={`form-input w-28 text-xs px-2 py-1.5 font-bold ${
                                        Number(item.unitPrice) === 0
                                          ? 'border-amber-400 bg-amber-50 text-amber-900 focus:border-amber-600 focus:bg-white animate-pulse'
                                          : 'border-blue-200 bg-blue-50/40 text-blue-900 focus:border-brand-500 focus:bg-white'
                                      }`}
                                      placeholder="0.00"
                                      value={item.unitPrice === 0 ? '' : item.unitPrice}
                                      onChange={e => updatePrice(item.productId, parseFloat(e.target.value) || 0)}
                                      title="Click to enter or change selling price"
                                    />
                                    {Number(item.unitPrice) === 0 && (
                                      <span className="block text-[10px] text-amber-700 font-semibold mt-0.5 whitespace-nowrap">
                                        ⚠️ Rate bharein
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-sm font-bold">−</button>
                                    <input
                                      type="number"
                                      min="1"
                                      className="form-input w-14 text-center text-xs px-1 py-1"
                                      value={item.quantity}
                                      onChange={e => updateQty(item.productId, parseInt(e.target.value) || 1)}
                                    />
                                    <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-sm font-bold">+</button>
                                  </div>
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="100"
                                    className="form-input w-16 text-xs px-2 py-1"
                                    value={item.discountPercent}
                                    onChange={e => updateDiscount(item.productId, parseFloat(e.target.value) || 0)}
                                  />
                                </td>
                                <td>
                                  <span className="badge badge-info text-xs">{item.gstRate}%</span>
                                  <p className="text-xs text-slate-400 mt-0.5">{formatINR(gstAmt)}</p>
                                </td>
                                <td className="font-semibold text-slate-900">{formatINR(lineTotal)}</td>
                                <td>
                                  <button onClick={() => updateQty(item.productId, 0)} className="btn-icon hover:text-red-500 text-xs">✕</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => setViewMode('GRID')}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        ← Add More Products (Square Grid)
                      </button>
                      <span className="font-semibold text-slate-700">
                        Total: <strong className="text-brand-700 font-bold">{formatINR(grandTotal)}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right — Summary & Checkout */}
        <div className="flex flex-col gap-4">
          {/* Party selection (Customer vs Supplier) */}
          <div className="card p-4">
            {/* 3 Tabs: Retail, Wholesale, Supplier */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg mb-3">
              <button
                type="button"
                id="pos-party-retail-tab"
                onClick={() => {
                  setPartyType('RETAIL');
                  setQuickCustType('RETAIL');
                  setError('');
                }}
                className={`py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  partyType === 'RETAIL'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>👤</span> Retail
              </button>
              <button
                type="button"
                id="pos-party-wholesale-tab"
                onClick={() => {
                  setPartyType('WHOLESALE');
                  setQuickCustType('WHOLESALE');
                  setError('');
                }}
                className={`py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  partyType === 'WHOLESALE'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🏢</span> Wholesale
              </button>
              <button
                type="button"
                id="pos-party-supplier-tab"
                onClick={() => {
                  setPartyType('SUPPLIER');
                  setError('');
                }}
                className={`py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  partyType === 'SUPPLIER'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🏭</span> Supplier
              </button>
            </div>

            {partyType === 'WHOLESALE' && (
              <div className="mb-3 p-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-1.5">
                <span>🏷️</span>
                <span><strong>Wholesale Mode (थोक भाव):</strong> Cart automatically uses wholesale rates.</span>
              </div>
            )}

            {partyType !== 'SUPPLIER' ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-700">
                    {partyType === 'WHOLESALE' ? 'Wholesale Party (थोक खरीदार)' : 'Retail Customer (खुदरा ग्राहक)'}{' '}
                    {paymentMethod === 'CREDIT' ? (
                      <span className="text-red-500 font-bold">* (Required for Credit)</span>
                    ) : (
                      <span className="text-slate-400 font-normal">(optional)</span>
                    )}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickCustType(partyType);
                      setShowQuickCustModal(true);
                      setQuickCustError('');
                    }}
                    className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1 hover:underline"
                  >
                    <span>➕</span> {partyType === 'WHOLESALE' ? 'New Party' : 'New Customer'}
                  </button>
                </div>

                {customer ? (
                  <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                    partyType === 'WHOLESALE'
                      ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                      : 'bg-blue-50/80 border-blue-200 text-blue-900'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                      partyType === 'WHOLESALE' ? 'bg-amber-600' : 'bg-brand-600'
                    }`}>
                      {customer.companyName ? '🏢' : customer.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {customer.companyName || customer.name}
                        </p>
                        {customer.companyName && (
                          <span className="text-[11px] text-slate-500 truncate">({customer.name})</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {customer.phone} {customer.gstin ? `• GSTIN: ${customer.gstin}` : ''}
                      </p>
                      {Number(customer.currentBalance) > 0 && (
                        <p className="text-[11px] font-semibold text-red-600">
                          Due Balance: {formatINR(customer.currentBalance!)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCustomer(null); setCustomerSearch(''); }}
                      className="btn-icon text-xs hover:text-red-500"
                      title="Remove party"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        id="pos-customer-search"
                        type="text"
                        className="form-input"
                        placeholder={partyType === 'WHOLESALE' ? "Search wholesale firm name, person or phone…" : "Search customer name or phone…"}
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                      />
                      {customerResults.length > 0 && customerSearch && (
                        <div className="absolute top-full left-0 right-0 mt-1 card shadow-lg z-30 overflow-hidden">
                          {customerResults.map(c => (
                            <button
                              key={c.id}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left text-sm border-b border-slate-100 last:border-0"
                              onClick={() => { setCustomer(c); setCustomerSearch(''); setCustomerResults([]); }}
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                                c.customerType === 'WHOLESALE' ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700'
                              }`}>
                                {c.companyName ? '🏢' : c.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-slate-900 truncate">{c.companyName || c.name}</p>
                                  {c.companyName && <span className="text-xs text-slate-400">({c.name})</span>}
                                  {c.customerType === 'WHOLESALE' && (
                                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded">Wholesale</span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400">{c.phone} {c.gstin ? `• ${c.gstin}` : ''}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {customerSearch && customerResults.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickCustType(partyType);
                          if (partyType === 'WHOLESALE') {
                            setQuickCustCompanyName(customerSearch);
                            setQuickCustName('');
                          } else {
                            setQuickCustName(customerSearch);
                            setQuickCustCompanyName('');
                          }
                          setShowQuickCustModal(true);
                          setQuickCustError('');
                        }}
                        className="w-full text-xs text-brand-600 bg-brand-50 hover:bg-brand-100 p-2 rounded border border-brand-200 text-center font-medium"
                      >
                        + Add "{customerSearch}" as new {partyType === 'WHOLESALE' ? 'wholesale party' : 'customer'}
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* SUPPLIER SELECTION */
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-purple-700 flex items-center gap-1">
                    <span>🏢</span> Select Supplier to Bill
                  </span>
                  <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-medium">Supplier Sale</span>
                </div>

                {supplier ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 p-2.5 bg-purple-50/90 border border-purple-200 rounded-lg">
                      <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                        🏢
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-purple-900 truncate">
                            {supplier.companyName || supplier.name}
                          </p>
                          {supplier.companyName && (
                            <span className="text-[10px] text-slate-500 truncate">({supplier.name})</span>
                          )}
                        </div>
                        <p className="text-xs text-purple-700">{supplier.phone} {supplier.gstin ? `• ${supplier.gstin}` : ''}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSupplier(null); setSupplierSearch(''); }}
                        className="btn-icon text-xs hover:text-red-500"
                        title="Remove supplier"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Payable Balance Info */}
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs flex justify-between items-center">
                      <span className="text-slate-600">Current Payable to Supplier:</span>
                      <span className={`font-bold ${Number(supplier.currentBalance) > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                        {Number(supplier.currentBalance) > 0 ? formatINR(supplier.currentBalance!) : '₹0.00 (Clear)'}
                      </span>
                    </div>

                    {/* Credit offset checkbox */}
                    {paymentMethod === 'CREDIT' && (
                      <label className="flex items-start gap-2 p-2 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-900 cursor-pointer">
                        <input
                          type="checkbox"
                          id="cb-offset-supplier-dues"
                          checked={offsetSupplierDues}
                          onChange={e => setOffsetSupplierDues(e.target.checked)}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="font-bold">Offset against payable balance</span>
                          <p className="text-[11px] text-purple-700 mt-0.5">
                            Credit amount will reduce what we owe this supplier.
                          </p>
                        </div>
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        id="pos-supplier-search"
                        type="text"
                        className="form-input border-purple-200 focus:border-purple-500"
                        placeholder="Search supplier name, company or phone…"
                        value={supplierSearch}
                        onChange={e => setSupplierSearch(e.target.value)}
                      />
                      {supplierResults.length > 0 && supplierSearch && (
                        <div className="absolute top-full left-0 right-0 mt-1 card shadow-lg z-30 overflow-hidden max-h-60 overflow-y-auto">
                          {supplierResults.map(s => (
                            <button
                              key={s.id}
                              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-purple-50 text-left text-sm border-b border-slate-100 last:border-0"
                              onClick={() => { setSupplier(s); setSupplierSearch(''); setSupplierResults([]); }}
                            >
                              <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 text-xs font-semibold flex-shrink-0">🏢</div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-900 truncate">
                                  {s.companyName || s.name}
                                  {s.companyName && <span className="font-normal text-xs text-slate-500 ml-1">({s.name})</span>}
                                </p>
                                <p className="text-xs text-slate-400">{s.phone} {s.gstin ? `• ${s.gstin}` : ''}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className="text-[11px] font-mono text-slate-600 block">
                                  Due: {formatINR(s.currentBalance || 0)}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {supplierSearch && supplierResults.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-2">
                        No supplier found matching "{supplierSearch}"
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bill summary */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Bill Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({cart.length} items)</span>
                <span>{formatINR(totals.subTotal)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Item Discounts</span>
                  <span className="text-red-500">−{formatINR(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount</span>
                <span>{formatINR(totals.taxable - invDiscount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST {isGstInvoice ? '' : '(Disabled)'}</span>
                <span className={isGstInvoice && totals.gst > 0 ? 'font-semibold text-slate-900' : ''}>
                  {formatINR(isGstInvoice ? totals.gst : 0)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-slate-600">Invoice Discount (₹)</span>
                <input
                  type="number"
                  min="0"
                  className="form-input w-24 text-xs py-1 px-2 text-right"
                  value={invoiceDiscount}
                  onChange={e => setInvoiceDiscount(e.target.value)}
                />
              </div>
              <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t-2 border-slate-200">
                <span>Grand Total</span>
                <span className="text-brand-700">{formatINR(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Payment</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { id: 'CASH', label: t('sales.cash'), icon: '💵' },
                { id: 'UPI', label: t('sales.upi'), icon: '📱' },
                { id: 'CARD', label: t('sales.card'), icon: '💳' },
                { id: 'CREDIT', label: t('sales.credit'), icon: '📋' },
              ].map(m => (
                <button
                  key={m.id}
                  id={`payment-method-${m.id.toLowerCase()}`}
                  onClick={() => {
                    setPaymentMethod(m.id);
                    if (m.id === 'CREDIT') {
                      setPaidAmount('0');
                    } else {
                      setPaidAmount(String(grandTotal.toFixed(2)));
                    }
                  }}
                  className={`p-2.5 rounded-lg border text-sm font-medium flex items-center gap-2 transition-all ${
                    paymentMethod === m.id
                      ? m.id === 'CREDIT'
                        ? 'border-amber-500 bg-amber-50 text-amber-800 font-bold'
                        : 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span>{m.icon}</span> {m.label}
                </button>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label flex justify-between" htmlFor="pos-paid-amount">
                <span>Amount Received (₹)</span>
                {paymentMethod === 'CREDIT' && (
                  <span className="text-xs text-amber-600 font-semibold">Selling on Credit</span>
                )}
              </label>
              <input
                id="pos-paid-amount"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                placeholder={paymentMethod === 'CREDIT' ? '0.00' : String(grandTotal.toFixed(2))}
                value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
              />
            </div>

            <div className={`text-sm flex justify-between font-semibold p-2 rounded ${
              balanceDue > 0
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : balanceDue < 0
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'text-slate-600'
            }`}>
              <span>{balanceDue < 0 ? 'Change to return:' : balanceDue > 0 ? 'Balance due (उधार):' : 'Full Payment ✓'}</span>
              <span>{formatINR(Math.abs(balanceDue))}</span>
            </div>

            {/* GST Invoice toggle */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={isGstInvoice} onChange={e => setIsGstInvoice(e.target.checked)} />
                <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-4 peer-checked:bg-brand-600 after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
              <span className="text-xs text-slate-600">Generate GST Tax Invoice</span>
            </div>
          </div>

          {error && (
            <div className="card p-3 bg-red-50 border-red-200 text-red-700 text-sm flex items-start gap-2">
              <span className="text-base">⚠</span>
              <div className="flex-1">
                <p>{error}</p>
                {(partyType === 'RETAIL' || partyType === 'WHOLESALE') && (error.toLowerCase().includes('party') || error.toLowerCase().includes('customer')) && !customer && (
                  <button
                    type="button"
                    onClick={() => { setQuickCustType(partyType); setShowQuickCustModal(true); setQuickCustError(''); }}
                    className="mt-2 text-xs font-bold bg-red-600 text-white px-2.5 py-1 rounded hover:bg-red-700 transition-colors"
                  >
                    + Add {partyType === 'WHOLESALE' ? 'Wholesale Party' : 'Customer'} Now
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            id="btn-checkout"
            onClick={handleCheckout}
            disabled={isSubmitting || cart.length === 0}
            className="btn-primary w-full justify-center py-3 text-base"
          >
            {isSubmitting ? (
              <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing…</>
            ) : (
              `🧾 ${t('sales.checkout')} — ${formatINR(grandTotal)}`
            )}
          </button>
        </div>
      </div>

      {/* Quick Add Party Modal */}
      {showQuickCustModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {quickCustType === 'WHOLESALE' ? '🏢 Add Wholesale Party (थोक)' : '👤 Add Retail Customer (खुदरा)'}
              </h3>
              <button onClick={() => setShowQuickCustModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            {/* Type selector inside modal */}
            <div className="flex p-1 bg-slate-100 rounded-lg mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setQuickCustType('RETAIL')}
                className={`flex-1 py-1.5 rounded-md transition-all ${
                  quickCustType === 'RETAIL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                👤 Retail Customer
              </button>
              <button
                type="button"
                onClick={() => setQuickCustType('WHOLESALE')}
                className={`flex-1 py-1.5 rounded-md transition-all ${
                  quickCustType === 'WHOLESALE' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600'
                }`}
              >
                🏢 Wholesale Party
              </button>
            </div>

            <form onSubmit={handleQuickAddCustomer} className="space-y-4">
              {quickCustType === 'WHOLESALE' && (
                <div className="form-group">
                  <label className="form-label">Firm / Company Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Kisan Khad Bhandar"
                    value={quickCustCompanyName}
                    onChange={e => setQuickCustCompanyName(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">
                  {quickCustType === 'WHOLESALE' ? 'Proprietor / Contact Person *' : 'Customer Name *'}
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder={quickCustType === 'WHOLESALE' ? "e.g. Rameshwar Dayal" : "e.g. Rameshwar Dayal"}
                  value={quickCustName}
                  onChange={e => setQuickCustName(e.target.value)}
                  autoFocus={quickCustType !== 'WHOLESALE'}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="tel"
                  required
                  className="form-input font-mono"
                  placeholder="10-digit mobile number"
                  value={quickCustPhone}
                  onChange={e => setQuickCustPhone(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">GSTIN (Optional)</label>
                <input
                  type="text"
                  className="form-input font-mono uppercase"
                  placeholder="15-digit GSTIN if registered"
                  value={quickCustGstin}
                  onChange={e => setQuickCustGstin(e.target.value)}
                />
              </div>

              {quickCustError && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 text-xs text-red-700">
                  ⚠ {quickCustError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickCustModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickCust}
                  className="btn-primary flex-1"
                >
                  {isSavingQuickCust ? 'Saving…' : 'Save & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
