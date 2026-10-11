'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';

interface Category { id: string; name: string; }
interface ProductForm {
  name: string; sku: string; barcode: string; brand: string; description: string;
  categoryId: string; unit: string; hsnCode: string;
  purchasePrice: string; sellingPrice: string; wholesalePrice: string; mrp: string;
  gstRate: string; cessRate: string;
  lowStockThreshold: string; isActive: boolean;
  openingStock: string;
  primaryImageUrl: string;
}

const UNITS = [
  { value: 'PCS', label: 'PCS (Pieces / नग)' },
  { value: 'BAG', label: 'BAG (Bags / बोरी / कट्टा)' },
  { value: 'KG', label: 'KG (Kilogram / किलो)' },
  { value: 'LTR', label: 'LTR (Litre / लीटर)' },
  { value: 'LITRE', label: 'LITRE (लीटर)' },
  { value: 'ML', label: 'ML (Millilitre)' },
  { value: 'BOTTLE', label: 'BOTTLE (बोतल)' },
  { value: 'CAN', label: 'CAN (कैन)' },
  { value: 'DRUM', label: 'DRUM (ड्रम)' },
  { value: 'GM', label: 'GM (Gram / ग्राम)' },
  { value: 'GRAM', label: 'GRAM (ग्राम)' },
  { value: 'PKT', label: 'PKT (Packet / पैकेट)' },
  { value: 'PACK', label: 'PACK (Pack / पैक)' },
  { value: 'BOX', label: 'BOX (डिब्बा / बॉक्स)' },
  { value: 'DOZ', label: 'DOZ (Dozen / दर्जन)' },
  { value: 'DOZEN', label: 'DOZEN (दर्जन)' },
  { value: 'MTR', label: 'MTR (Metre / मीटर)' },
  { value: 'FT', label: 'FT (Feet / फुट)' },
  { value: 'QTL', label: 'QTL (Quintal / क्विंटल)' },
  { value: 'SET', label: 'SET (सेट)' },
  { value: 'PAIR', label: 'PAIR (जोड़ी)' },
];
const GST_RATES = ['0', '0.1', '0.25', '1', '1.5', '3', '5', '7.5', '12', '18', '28'];

const DEFAULT_FORM: ProductForm = {
  name: '', sku: '', barcode: '', brand: '', description: '',
  categoryId: '', unit: 'PCS', hsnCode: '',
  purchasePrice: '', sellingPrice: '', wholesalePrice: '', mrp: '', gstRate: '18', cessRate: '0',
  lowStockThreshold: '10', isActive: true, openingStock: '0',
  primaryImageUrl: '',
};

export default function ProductFormPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string | undefined;
  const isEdit = productId && productId !== 'new';

  const [form, setForm] = useState<ProductForm>(DEFAULT_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProduct, setIsFetchingProduct] = useState(!!isEdit);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState('');

  // Image Upload State
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = useCallback((k: keyof ProductForm, v: any) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  }, []);

  const getDisplayImageUrl = (url: string) => {
    if (!url) return '';
    return url;
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageUploadError('Please select a valid image file (JPG, PNG, WEBP, GIF)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setImageUploadError('Image size should be less than 10MB');
      return;
    }

    setIsUploadingImage(true);
    setImageUploadError('');

    const formData = new FormData();
    formData.append('image', file);
    if (isEdit && productId) {
      formData.append('productId', productId);
    }

    try {
      const res = await api.post('/products/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imageUrl = res.data?.data?.url;
      if (imageUrl) {
        set('primaryImageUrl', imageUrl);
      }
    } catch (err: any) {
      console.error('Failed to upload image:', err);
      // Fallback: Read as data URL for instant client-side preview
      const reader = new FileReader();
      reader.onload = () => {
        set('primaryImageUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
      setImageUploadError(err?.response?.data?.message || 'Uploaded for local preview');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setIsFetchingProduct(true);
    api.get(`/products/${productId}`)
      .then(r => {
        const p = r.data.data;
        setForm({
          name: p.name || '',
          sku: p.sku || '',
          barcode: p.barcode || '',
          brand: p.brand || '',
          description: p.description || '',
          categoryId: p.categoryId || '',
          unit: p.unit || 'PCS',
          hsnCode: p.hsnCode || '',
          purchasePrice: String(p.purchasePrice || ''),
          sellingPrice: String(p.sellingPrice || ''),
          wholesalePrice: String(p.wholesalePrice || ''),
          mrp: String(p.mrp || ''),
          gstRate: String(p.gstRate || '18'),
          cessRate: String(p.cessRate || '0'),
          lowStockThreshold: String(p.lowStockThreshold || '10'),
          isActive: p.isActive !== false,
          openingStock: '0',
          primaryImageUrl: p.primaryImageUrl || '',
        });
      })
      .catch(() => router.replace('/products'))
      .finally(() => setIsFetchingProduct(false));
  }, [isEdit, productId, router]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Product name is required';
    if (!form.sku.trim()) e.sku = 'SKU is required';
    if (!form.unit) e.unit = 'Unit is required';
    if (!form.purchasePrice || isNaN(Number(form.purchasePrice))) e.purchasePrice = 'Valid purchase price required';
    if (form.sellingPrice && isNaN(Number(form.sellingPrice))) e.sellingPrice = 'Please enter a valid price number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    setErrors({});

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      barcode: form.barcode || undefined,
      brand: form.brand || undefined,
      description: form.description || undefined,
      categoryId: form.categoryId || undefined,
      unit: form.unit,
      hsnCode: form.hsnCode || undefined,
      purchasePrice: Number(form.purchasePrice),
      sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : (form.purchasePrice ? Number(form.purchasePrice) : 0),
      wholesalePrice: form.wholesalePrice ? Number(form.wholesalePrice) : undefined,
      mrp: form.mrp ? Number(form.mrp) : undefined,
      gstRate: Number(form.gstRate),
      cessRate: Number(form.cessRate) || 0,
      lowStockThreshold: Number(form.lowStockThreshold) || 10,
      isActive: form.isActive,
      openingStock: isEdit ? undefined : Number(form.openingStock) || 0,
      primaryImageUrl: form.primaryImageUrl || undefined,
    };

    try {
      if (isEdit) {
        await api.put(`/products/${productId}`, payload);
        setSuccess('Product updated successfully!');
      } else {
        await api.post('/products', payload);
        setSuccess('Product created successfully!');
        setTimeout(() => router.push('/products'), 1500);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to save product';
      setErrors({ general: msg });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetchingProduct) {
    return (
      <AppShell title="Loading…">
        <div className="card p-8 animate-pulse space-y-4 max-w-3xl">
          {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-slate-200 rounded-lg" />)}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={isEdit ? 'Edit Product' : 'Add Product'} subtitle={isEdit ? 'Update product details' : 'Add a new product to your inventory'}>
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {errors.general && (
          <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">⚠ {errors.general}</div>
        )}
        {success && (
          <div className="card p-4 bg-emerald-50 border-emerald-200 text-emerald-700 text-sm">✅ {success}</div>
        )}

        {/* Product Photo Upload Card */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <span>📸</span> Product Photo (उत्पाद की फोटो)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload a photo to display in POS billing cards and product inventory
              </p>
            </div>
            {form.primaryImageUrl && (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                <span>✓</span> Photo Attached
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Image Preview Box */}
            <div className="w-36 h-36 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden relative flex-shrink-0 group shadow-inner">
              {form.primaryImageUrl ? (
                <>
                  <img
                    src={getDisplayImageUrl(form.primaryImageUrl)}
                    alt="Product preview"
                    className="w-full h-full object-cover rounded-2xl"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 bg-white text-slate-800 rounded-lg shadow hover:bg-slate-100 text-xs font-bold"
                      title="Change Photo"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => set('primaryImageUrl', '')}
                      className="p-1.5 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 text-xs font-bold"
                      title="Remove Photo"
                    >
                      ✕
                    </button>
                  </div>
                </>
              ) : (
                <div
                  className="flex flex-col items-center justify-center text-slate-400 cursor-pointer p-4 text-center hover:text-brand-600 transition-colors w-full h-full"
                  onClick={() => fileInputRef.current?.click()}
                  title="Click to select photo"
                >
                  <span className="text-4xl mb-1">📷</span>
                  <span className="text-xs font-medium">Add Photo</span>
                </div>
              )}

              {isUploadingImage && (
                <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center z-10">
                  <span className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mb-1" />
                  <span className="text-[10px] font-bold text-brand-700">Uploading…</span>
                </div>
              )}
            </div>

            {/* Upload Buttons & Options */}
            <div className="flex-1 w-full space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                id="product-photo-file-input"
                onChange={handleImageFileChange}
              />

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  id="btn-upload-photo"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="btn-primary text-xs flex items-center gap-1.5 px-3.5 py-2 shadow-sm"
                >
                  <span>📁</span>
                  <span>{form.primaryImageUrl ? 'Change Photo from Device' : 'Upload Photo from Device (फोटो चुनें)'}</span>
                </button>

                {form.primaryImageUrl && (
                  <button
                    type="button"
                    onClick={() => set('primaryImageUrl', '')}
                    className="btn-secondary text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 px-3 py-2"
                  >
                    ✕ Remove Photo
                  </button>
                )}
              </div>

              <p className="text-[11px] text-slate-400">
                Supports JPG, PNG, WEBP, GIF (Max size: 10MB).
              </p>

              {imageUploadError && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
                  ⚠️ {imageUploadError}
                </p>
              )}

              {/* Or Paste URL */}
              <div className="pt-2 border-t border-slate-100">
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Or enter image web URL (ऑनलाइन फोटो लिंक):
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/product-image.jpg"
                    className="form-input text-xs py-1.5 flex-1"
                    value={form.primaryImageUrl.startsWith('data:') ? '' : form.primaryImageUrl}
                    onChange={e => set('primaryImageUrl', e.target.value)}
                  />
                  {form.primaryImageUrl && !form.primaryImageUrl.startsWith('data:') && (
                    <button
                      type="button"
                      onClick={() => set('primaryImageUrl', '')}
                      className="btn-secondary text-xs px-2.5 py-1 text-slate-500"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-5 border-b border-slate-100 pb-3">Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2 form-group">
              <label className="form-label" htmlFor="product-name">Product Name *</label>
              <input id="product-name" type="text" className={`form-input ${errors.name ? 'form-input-error' : ''}`}
                placeholder="e.g., Colgate Toothpaste 200g" value={form.name} onChange={e => set('name', e.target.value)} />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="product-sku">SKU Code *</label>
              <input id="product-sku" type="text" className={`form-input ${errors.sku ? 'form-input-error' : ''}`}
                placeholder="e.g., COLG-200G" value={form.sku} onChange={e => set('sku', e.target.value.toUpperCase())} />
              {errors.sku && <p className="form-error">{errors.sku}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="product-barcode">Barcode (optional)</label>
              <input id="product-barcode" type="text" className="form-input"
                placeholder="Scan or enter barcode" value={form.barcode} onChange={e => set('barcode', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="product-brand">Brand</label>
              <input id="product-brand" type="text" className="form-input"
                placeholder="e.g., Colgate" value={form.brand} onChange={e => set('brand', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="product-category">Category</label>
              <select id="product-category" className="form-select" value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
                <option value="">— Select category —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="product-unit">Unit *</label>
              <select id="product-unit" className={`form-select ${errors.unit ? 'form-input-error' : ''}`} value={form.unit} onChange={e => set('unit', e.target.value)}>
                {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                {form.unit && !UNITS.some(u => u.value === form.unit) && (
                  <option key={form.unit} value={form.unit}>{form.unit}</option>
                )}
              </select>
              {errors.unit && <p className="form-error">{errors.unit}</p>}
            </div>

            <div className="sm:col-span-2 form-group">
              <label className="form-label" htmlFor="product-description">Description</label>
              <textarea id="product-description" rows={2} className="form-input resize-none"
                placeholder="Optional product description" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-700">Pricing & Tax (खुदरा व थोक रेट)</h2>
            <span className="text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded font-medium">Wholesale & Retail Support</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="form-group">
              <label className="form-label" htmlFor="product-purchase-price">Purchase Price (₹) *</label>
              <input id="product-purchase-price" type="number" step="0.01" min="0" className={`form-input ${errors.purchasePrice ? 'form-input-error' : ''}`}
                placeholder="0.00 (लागत)" value={form.purchasePrice} onChange={e => set('purchasePrice', e.target.value)} />
              {errors.purchasePrice && <p className="form-error">{errors.purchasePrice}</p>}
            </div>
            <div className="form-group">
              <label className="form-label text-brand-700 font-semibold" htmlFor="product-selling-price">
                Retail Price (₹)
                <span className="text-[11px] text-slate-500 font-normal ml-1">(वैकल्पिक / Optional Default)</span>
              </label>
              <input id="product-selling-price" type="number" step="0.01" min="0" className={`form-input border-brand-300 ${errors.sellingPrice ? 'form-input-error' : ''}`}
                placeholder="Optional (बिलिंग के समय बदल सकते हैं)" value={form.sellingPrice} onChange={e => set('sellingPrice', e.target.value)} />
              <p className="text-[10px] text-slate-500 mt-1">
                Sell price vary hota hai toh yahan khali chhod sakte hain — bill banate waqt rate bhar sakte hain.
              </p>
              {errors.sellingPrice && <p className="form-error">{errors.sellingPrice}</p>}
            </div>
            <div className="form-group">
              <label className="form-label text-purple-700 font-semibold" htmlFor="product-wholesale-price">
                Wholesale Price (₹)
                <span className="text-[10px] text-purple-500 font-normal ml-1">(थोक रेट)</span>
              </label>
              <input id="product-wholesale-price" type="number" step="0.01" min="0" className="form-input border-purple-200 focus:border-purple-500"
                placeholder="0.00 (थोक भाव)" value={form.wholesalePrice} onChange={e => set('wholesalePrice', e.target.value)} />
              <p className="text-[10px] text-slate-400 mt-1">Applied automatically when selling to Wholesale Parties</p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="product-mrp">MRP (₹)</label>
              <input id="product-mrp" type="number" step="0.01" min="0" className="form-input"
                placeholder="Max Retail Price" value={form.mrp} onChange={e => set('mrp', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="product-gst-rate">GST Rate (%) *</label>
              <select id="product-gst-rate" className="form-select" value={form.gstRate} onChange={e => set('gstRate', e.target.value)}>
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="product-cess">Cess Rate (%)</label>
              <input id="product-cess" type="number" step="0.01" min="0" className="form-input"
                placeholder="0" value={form.cessRate} onChange={e => set('cessRate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="product-hsn">HSN / SAC Code</label>
              <input id="product-hsn" type="text" className="form-input"
                placeholder="e.g., 3306" value={form.hsnCode} onChange={e => set('hsnCode', e.target.value)} />
            </div>
          </div>

          {/* Profit margin preview */}
          {form.purchasePrice && form.sellingPrice && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 flex gap-6">
              <span>Margin: <strong className={Number(form.sellingPrice) >= Number(form.purchasePrice) ? 'text-emerald-600' : 'text-red-600'}>
                {(((Number(form.sellingPrice) - Number(form.purchasePrice)) / Number(form.purchasePrice)) * 100).toFixed(1)}%
              </strong></span>
              <span>Profit/unit: <strong>₹{(Number(form.sellingPrice) - Number(form.purchasePrice)).toFixed(2)}</strong></span>
            </div>
          )}
        </div>

        {/* Inventory */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-5 border-b border-slate-100 pb-3">Inventory Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {!isEdit && (
              <div className="form-group">
                <label className="form-label" htmlFor="product-opening-stock">Opening Stock</label>
                <input id="product-opening-stock" type="number" min="0" className="form-input"
                  value={form.openingStock} onChange={e => set('openingStock', e.target.value)} />
                <p className="form-hint">Current stock count when adding this product</p>
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="product-low-stock">Low Stock Threshold</label>
              <input id="product-low-stock" type="number" min="0" className="form-input"
                value={form.lowStockThreshold} onChange={e => set('lowStockThreshold', e.target.value)} />
              <p className="form-hint">Alert when stock falls below this level</p>
            </div>
            <div className="form-group flex items-center gap-3 pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} />
                <div className="w-10 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand-500 rounded-full peer peer-checked:after:translate-x-5 peer-checked:bg-brand-600 after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
              <span className="text-sm font-medium text-slate-700">Product is Active</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button id="btn-save-product" type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</> : (isEdit ? '💾 Update Product' : '+ Create Product')}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">
            {isEdit ? 'Cancel' : 'Discard'}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
