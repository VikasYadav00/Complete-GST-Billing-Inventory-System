'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

function SettingsContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as any) || 'profile';

  const { user } = useAuth();
  const [business, setBusiness] = useState<any>(null);

  // Profile form state
  const [form, setForm] = useState<any>({});
  // Bank & UPI Settings state
  const [bankForm, setBankForm] = useState<any>({
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBranch: '',
    upiId: '',
    termsAndConditions: '',
    thermalPrinterWidth: '80mm',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [isTestingWA, setIsTestingWA] = useState(false);
  const [waMsg, setWaMsg] = useState('');

  // Security / Password update state
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [securityMsg, setSecurityMsg] = useState('');
  const [securityError, setSecurityError] = useState('');

  const [activeTab, setActiveTab] = useState<'profile' | 'gst' | 'bank' | 'whatsapp' | 'invoice' | 'security'>(initialTab);

  useEffect(() => {
    api.get('/business/profile').then(r => {
      const b = r.data.data;
      setBusiness(b);
      setForm({
        name: b.name || '',
        legalName: b.legalName || '',
        tagline: b.tagline || '',
        ownerName: b.ownerName || '',
        phone: b.phone || '',
        email: b.email || '',
        address: b.addressLine1 || b.address || '',
        city: b.city || '',
        state: b.state || '',
        pincode: b.pincode || '',
        stateCode: b.stateCode || '',
        gstin: b.gstin || '',
        isGstRegistered: b.isGstRegistered || false,
        taxPricingMode: b.taxPricingMode || 'EXCLUSIVE',
        currency: b.currency || 'INR',
      });

      const s = b.settings || {};
      setBankForm({
        bankName: s.bankName || '',
        bankAccountNumber: s.bankAccountNumber || '',
        bankIfsc: s.bankIfsc || '',
        bankBranch: s.bankBranch || '',
        upiId: s.upiId || '',
        termsAndConditions: s.termsAndConditions || '',
        thermalPrinterWidth: s.thermalPrinterWidth || '80mm',
        invoicePrefix: s.invoicePrefix || 'INV-',
      });
    }).catch(() => {});
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMsg('');
    setSaveError('');
    try {
      await api.put('/business/profile', {
        ...form,
        addressLine1: form.address,
      });
      setSaveMsg('Business profile updated successfully ✅');
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBankSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMsg('');
    setSaveError('');
    try {
      await api.put('/business/settings', {
        bankName: bankForm.bankName || null,
        bankAccountNumber: bankForm.bankAccountNumber || null,
        bankIfsc: bankForm.bankIfsc ? bankForm.bankIfsc.toUpperCase().trim() : null,
        bankBranch: bankForm.bankBranch || null,
        upiId: bankForm.upiId ? bankForm.upiId.toLowerCase().trim() : null,
        termsAndConditions: bankForm.termsAndConditions || null,
        thermalPrinterWidth: bankForm.thermalPrinterWidth || '80mm',
      });
      setSaveMsg('Bank & UPI details updated successfully! These will appear on all future tax invoices and receipts. ✅');
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || 'Failed to update bank & UPI settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvoiceSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMsg('');
    setSaveError('');
    try {
      await api.put('/business/settings', {
        invoicePrefix: bankForm.invoicePrefix || 'INV-',
        thermalPrinterWidth: bankForm.thermalPrinterWidth || '80mm',
        termsAndConditions: bankForm.termsAndConditions || undefined,
      });
      setSaveMsg('Invoice settings updated successfully ✅');
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const testWhatsApp = async () => {
    if (!whatsappPhone.trim()) { setWaMsg('⚠ Enter a phone number first'); return; }
    setIsTestingWA(true); setWaMsg('');
    try {
      const { data } = await api.post('/business/test-whatsapp', { recipientPhone: whatsappPhone });
      setWaMsg(data.success ? '✅ Test message sent! Check your WhatsApp.' : `⚠ ${data.message}`);
    } catch (err: any) {
      setWaMsg(`⚠ ${err?.response?.data?.message || 'Test failed'}`);
    } finally { setIsTestingWA(false); }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityMsg('');
    setSecurityError('');

    if (!securityForm.currentPassword) {
      setSecurityError('Please enter your current password');
      return;
    }
    if (securityForm.newPassword.length < 6) {
      setSecurityError('New password must be at least 6 characters long');
      return;
    }
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      setSecurityError('New password and confirm password do not match');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await api.post('/auth/change-password', {
        currentPassword: securityForm.currentPassword,
        newPassword: securityForm.newPassword,
      });
      setSecurityMsg(res.data?.message || 'Password updated successfully! Please keep your new credentials secure.');
      setSecurityForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      setSecurityError(err?.response?.data?.message || 'Failed to update password. Please check your current password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const TABS = [
    { id: 'bank', label: 'Bank & UPI (Payment Details)', icon: '🏦' },
    { id: 'profile', label: 'Business Profile', icon: '🏪' },
    { id: 'gst', label: 'GST Config', icon: '🧾' },
    { id: 'invoice', label: 'Invoice Customization', icon: '📄' },
    { id: 'whatsapp', label: 'WhatsApp Alerts', icon: '💬' },
    { id: 'security', label: 'Security & Password', icon: '🔒' },
  ] as const;

  const currentUpiId = bankForm.upiId || 'sharmaagro@sbi';
  const liveQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
    `upi://pay?pa=${currentUpiId}&pn=${encodeURIComponent(form.name || 'Store')}&cu=INR`
  )}`;

  return (
    <AppShell title="Settings" subtitle="Business profile, bank accounts, UPI QR, and GST configuration">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 mb-6 p-1 bg-white border border-slate-200 rounded-xl shadow-sm w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`settings-tab-${tab.id}`}
            onClick={() => { setActiveTab(tab.id); setSaveMsg(''); setSaveError(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {saveMsg && (
        <div className="max-w-3xl mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center gap-2">
          <span>✅</span> <span>{saveMsg}</span>
        </div>
      )}

      {saveError && (
        <div className="max-w-3xl mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <span>⚠️</span> <span>{saveError}</span>
        </div>
      )}

      {/* =========================================================================
          TAB 1: BANK & UPI (PAYMENT CONFIGURATION)
          ========================================================================= */}
      {activeTab === 'bank' && (
        <div className="max-w-4xl space-y-6">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
            <h3 className="font-bold text-blue-900 text-sm flex items-center gap-2">
              <span>💡</span> Bank & UPI Details on Customer Invoices
            </h3>
            <p className="text-xs text-blue-700 mt-1">
              The details you configure here are printed directly onto all official <strong>Tax Invoices</strong> and <strong>Thermal Receipts</strong>. When a customer receives a bill, they can scan the dynamically generated <strong>UPI QR Code</strong> to pay instantly using PhonePe, Google Pay, Paytm, or BHIM.
            </p>
          </div>

          <form onSubmit={handleBankSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 columns: Inputs */}
            <div className="lg:col-span-2 card p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <span>🏦</span> Bank Account & UPI Settings
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group sm:col-span-2">
                  <label className="form-label" htmlFor="bank-name">Bank Name *</label>
                  <input
                    id="bank-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. State Bank of India, HDFC Bank, ICICI Bank"
                    value={bankForm.bankName}
                    onChange={e => setBankForm((f: any) => ({ ...f, bankName: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="bank-acc">Account Number *</label>
                  <input
                    id="bank-acc"
                    type="text"
                    className="form-input font-mono"
                    placeholder="e.g. 38192837461"
                    value={bankForm.bankAccountNumber}
                    onChange={e => setBankForm((f: any) => ({ ...f, bankAccountNumber: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="bank-ifsc">IFSC Code *</label>
                  <input
                    id="bank-ifsc"
                    type="text"
                    className="form-input font-mono uppercase"
                    placeholder="e.g. SBIN0001234"
                    maxLength={11}
                    value={bankForm.bankIfsc}
                    onChange={e => setBankForm((f: any) => ({ ...f, bankIfsc: e.target.value.toUpperCase() }))}
                    required
                  />
                  <p className="form-hint">11-character Indian Financial System Code</p>
                </div>

                <div className="form-group sm:col-span-2">
                  <label className="form-label" htmlFor="bank-branch">Branch Name / Address</label>
                  <input
                    id="bank-branch"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Alipur Mandi Branch, GT Road, Delhi"
                    value={bankForm.bankBranch}
                    onChange={e => setBankForm((f: any) => ({ ...f, bankBranch: e.target.value }))}
                  />
                </div>

                <div className="form-group sm:col-span-2">
                  <label className="form-label" htmlFor="bank-upi">Business UPI ID (VPA) *</label>
                  <input
                    id="bank-upi"
                    type="text"
                    className="form-input font-mono"
                    placeholder="e.g. yourbusiness@sbi or 9876543210@paytm"
                    value={bankForm.upiId}
                    onChange={e => setBankForm((f: any) => ({ ...f, upiId: e.target.value }))}
                    required
                  />
                  <p className="form-hint">This UPI ID generates the QR Code printed on bills for direct payment.</p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  id="btn-save-bank-settings"
                  className="btn-primary w-full sm:w-auto"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving…' : '💾 Save Bank & UPI Details'}
                </button>
              </div>
            </div>

            {/* Right column: Live QR Preview */}
            <div className="card p-6 flex flex-col items-center text-center justify-between space-y-4 bg-slate-50 border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Live UPI QR Code Preview</h3>
                <p className="text-xs text-slate-500 mt-1">This QR will be embedded in all customer invoices & receipts</p>
              </div>

              <div className="p-3 bg-white border border-slate-300 rounded-xl shadow-sm">
                <img
                  src={liveQrUrl}
                  alt="UPI QR Code Preview"
                  className="w-36 h-36 mx-auto object-contain"
                />
                <p className="text-[11px] font-mono font-bold text-slate-800 mt-2 truncate max-w-[160px]">
                  {currentUpiId}
                </p>
              </div>

              <div className="text-xs text-slate-600 bg-blue-50/70 p-2.5 rounded-lg border border-blue-100 text-left w-full space-y-1">
                <p className="font-semibold text-blue-900">Preview Check:</p>
                <p>• Scannable with Google Pay, PhonePe, Paytm, BHIM</p>
                <p>• On invoices, it automatically fills the exact invoice amount</p>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 2: BUSINESS PROFILE
          ========================================================================= */}
      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSave} className="max-w-2xl space-y-5">
          <div className="card p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">Business Information</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 form-group">
                <label className="form-label">Business / Trade Name *</label>
                <input type="text" className="form-input" value={form.name || ''} onChange={e => setForm((f: any) => ({...f, name: e.target.value}))} required />
              </div>
              <div className="col-span-2 form-group">
                <label className="form-label">Legal Name (as per GST certificate)</label>
                <input type="text" className="form-input" value={form.legalName || ''} onChange={e => setForm((f: any) => ({...f, legalName: e.target.value}))} />
              </div>
              <div className="col-span-2 form-group">
                <label className="form-label">Tagline / Subheading</label>
                <input type="text" className="form-input" placeholder="e.g. Leading Retailer of Fertilizers & Farm Equipment" value={form.tagline || ''} onChange={e => setForm((f: any) => ({...f, tagline: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Person</label>
                <input type="text" className="form-input" value={form.ownerName || ''} onChange={e => setForm((f: any) => ({...f, ownerName: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <input type="tel" className="form-input" value={form.phone || ''} onChange={e => setForm((f: any) => ({...f, phone: e.target.value}))} required />
              </div>
              <div className="col-span-2 form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={form.email || ''} onChange={e => setForm((f: any) => ({...f, email: e.target.value}))} />
              </div>
              <div className="col-span-2 form-group">
                <label className="form-label">Address Line 1</label>
                <textarea rows={2} className="form-input resize-none" value={form.address || ''} onChange={e => setForm((f: any) => ({...f, address: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input type="text" className="form-input" value={form.city || ''} onChange={e => setForm((f: any) => ({...f, city: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input type="text" className="form-input" value={form.state || ''} onChange={e => setForm((f: any) => ({...f, state: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">PIN Code</label>
                <input type="text" className="form-input" value={form.pincode || ''} onChange={e => setForm((f: any) => ({...f, pincode: e.target.value}))} maxLength={6} />
              </div>
              <div className="form-group">
                <label className="form-label">State Code (GST)</label>
                <input type="text" className="form-input" value={form.stateCode || ''} onChange={e => setForm((f: any) => ({...f, stateCode: e.target.value}))} maxLength={2} placeholder="e.g., 07" />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : '💾 Save Profile'}
            </button>
          </div>
        </form>
      )}

      {/* =========================================================================
          TAB 3: GST CONFIGURATION
          ========================================================================= */}
      {activeTab === 'gst' && (
        <form onSubmit={handleProfileSave} className="max-w-2xl space-y-5">
          <div className="card p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">GST Configuration</h2>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={form.isGstRegistered || false}
                  onChange={e => setForm((f: any) => ({...f, isGstRegistered: e.target.checked}))} />
                <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-5 peer-checked:bg-brand-600 after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
              <span className="text-sm font-medium text-slate-700">Business is GST Registered</span>
            </div>

            {form.isGstRegistered && (
              <>
                <div className="form-group">
                  <label className="form-label">GSTIN (15 characters)</label>
                  <input type="text" className="form-input font-mono uppercase" value={form.gstin || ''} onChange={e => setForm((f: any) => ({...f, gstin: e.target.value.toUpperCase()}))} maxLength={15} placeholder="07AAAAA0000A1Z5" />
                </div>
                <div className="form-group">
                  <label className="form-label">Tax Pricing Mode</label>
                  <select className="form-select" value={form.taxPricingMode || 'EXCLUSIVE'} onChange={e => setForm((f: any) => ({...f, taxPricingMode: e.target.value}))}>
                    <option value="EXCLUSIVE">GST Exclusive (Tax added on top of item price)</option>
                    <option value="INCLUSIVE">GST Inclusive (Selling price already contains tax)</option>
                  </select>
                  <p className="form-hint">Exclusive: ₹100 + 18% GST = ₹118. Inclusive: ₹118 with GST already inside.</p>
                </div>
              </>
            )}

            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : '💾 Save GST Settings'}
            </button>
          </div>
        </form>
      )}

      {/* =========================================================================
          TAB 4: INVOICE CUSTOMIZATION
          ========================================================================= */}
      {activeTab === 'invoice' && (
        <form onSubmit={handleInvoiceSettingsSave} className="max-w-2xl space-y-5">
          <div className="card p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">Invoice & Receipt Customization</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Invoice Prefix</label>
                <input
                  type="text"
                  className="form-input font-mono uppercase"
                  value={bankForm.invoicePrefix || 'INV-'}
                  onChange={e => setBankForm((f: any) => ({ ...f, invoicePrefix: e.target.value.toUpperCase() }))}
                  maxLength={8}
                />
                <p className="form-hint">Example: {bankForm.invoicePrefix || 'INV-'}2026-0001</p>
              </div>

              <div className="form-group">
                <label className="form-label">Thermal Printer Format</label>
                <select
                  className="form-select"
                  value={bankForm.thermalPrinterWidth || '80mm'}
                  onChange={e => setBankForm((f: any) => ({ ...f, thermalPrinterWidth: e.target.value }))}
                >
                  <option value="80mm">80mm Thermal (Standard Counter)</option>
                  <option value="58mm">58mm Thermal (Pocket POS)</option>
                  <option value="A4">A4 Full Page</option>
                </select>
              </div>

              <div className="col-span-2 form-group">
                <label className="form-label">Invoice Terms & Conditions</label>
                <textarea
                  rows={4}
                  className="form-input resize-none text-xs"
                  placeholder="Terms printed at bottom of every bill (returns policy, jurisdiction, etc.)"
                  value={bankForm.termsAndConditions}
                  onChange={e => setBankForm((f: any) => ({ ...f, termsAndConditions: e.target.value }))}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : '💾 Save Invoice Settings'}
            </button>
          </div>
        </form>
      )}

      {/* =========================================================================
          TAB 5: WHATSAPP
          ========================================================================= */}
      {activeTab === 'whatsapp' && (
        <div className="max-w-2xl">
          <div className="card p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">📱 WhatsApp Low-Stock & Invoice Alerts</h2>
            <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-800">
              <p className="font-semibold mb-1">How it works:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700 text-xs">
                <li>Configure WhatsApp Business API credentials in your backend <code>.env</code> file</li>
                <li>Set <code>WHATSAPP_PHONE_NUMBER_ID</code> and <code>WHATSAPP_ACCESS_TOKEN</code></li>
                <li>When products fall below minimum threshold, low-stock alerts are dispatched to the manager phone number</li>
                <li>Invoices can also be shared directly with customers via WhatsApp Web 💬</li>
              </ol>
            </div>

            <div className="form-group">
              <label className="form-label">Test WhatsApp Notification</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  className="form-input flex-1"
                  placeholder="91XXXXXXXXXX (with country code)"
                  value={whatsappPhone}
                  onChange={e => setWhatsappPhone(e.target.value)}
                />
                <button
                  id="btn-test-whatsapp"
                  onClick={testWhatsApp}
                  disabled={isTestingWA}
                  className="btn-primary"
                >
                  {isTestingWA ? 'Sending…' : '📤 Send Test'}
                </button>
              </div>
              {waMsg && <p className="mt-2 text-sm text-slate-700">{waMsg}</p>}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: SECURITY & PASSWORD
          ========================================================================= */}
      {activeTab === 'security' && (
        <div className="max-w-2xl space-y-6">
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
            <h3 className="font-bold text-amber-900 text-sm flex items-center gap-2">
              <span>🛡️</span> Account Security & Password Protection
            </h3>
            <p className="text-xs text-amber-800 mt-1">
              Ensure your account has a strong password to safeguard business billing data, financial transactions, and inventory records.
            </p>
          </div>

          {/* User Info Card */}
          <div className="card p-5 bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-lg font-bold">
                {user?.name ? user.name[0]?.toUpperCase() : 'U'}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{user?.name || 'User'}</h4>
                <p className="text-xs text-slate-500">{user?.email || 'user@example.com'}</p>
                <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                  Role: {user?.role || 'Admin'}
                </span>
              </div>
            </div>
            <div className="text-xs text-slate-500 sm:text-right">
              <span className="font-medium text-slate-700">{user?.businessName || form.name || 'Store'}</span>
            </div>
          </div>

          {securityMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center gap-2">
              <span>✅</span> <span>{securityMsg}</span>
            </div>
          )}

          {securityError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
              <span>⚠️</span> <span>{securityError}</span>
            </div>
          )}

          <div className="card p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>🔒</span> Change Password
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Update your login password regularly for maximum account security</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={e => setShowPasswords(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span>Show passwords</span>
              </label>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="form-group">
                <label className="form-label" htmlFor="current-password">Current Password *</label>
                <input
                  id="current-password"
                  type={showPasswords ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter your current password"
                  value={securityForm.currentPassword}
                  onChange={e => setSecurityForm(f => ({ ...f, currentPassword: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-password">New Password *</label>
                <input
                  id="new-password"
                  type={showPasswords ? 'text' : 'password'}
                  className="form-input"
                  placeholder="At least 6 characters"
                  value={securityForm.newPassword}
                  onChange={e => setSecurityForm(f => ({ ...f, newPassword: e.target.value }))}
                  required
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Must contain a minimum of 6 characters</span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm-password">Confirm New Password *</label>
                <input
                  id="confirm-password"
                  type={showPasswords ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Re-enter new password"
                  value={securityForm.confirmPassword}
                  onChange={e => setSecurityForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  id="btn-update-password"
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="btn-primary w-full sm:w-auto"
                >
                  {isUpdatingPassword ? 'Updating Password…' : '🔐 Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading settings…</div>}>
      <SettingsContent />
    </Suspense>
  );
}
