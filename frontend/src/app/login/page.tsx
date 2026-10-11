'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { AxiosError } from 'axios';

export default function LoginPage() {
  const { login, register } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Login form state
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  // Register form state
  const [regForm, setRegForm] = useState({
    businessName: '', ownerName: '', email: '', password: '', confirmPassword: '',
    phone: '', gstin: '', state: '', stateCode: '',
  });
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      router.replace('/dashboard');
    } catch (err) {
      const axErr = err as AxiosError<any>;
      setError(axErr.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (regForm.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (regForm.password !== regForm.confirmPassword) {
      setError('Passwords do not match. Please ensure Password and Confirm Password are the same.');
      return;
    }

    setIsLoading(true);
    try {
      const { confirmPassword, ...registerPayload } = regForm;
      await register({ ...registerPayload, gstin: regForm.gstin || undefined });
      router.replace('/dashboard');
    } catch (err) {
      const axErr = err as AxiosError<any>;
      setError(axErr.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <span className="text-xl font-bold">R</span>
            </div>
            <span className="text-2xl font-bold tracking-tight">RetailPro</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-6">
            Complete GST Billing<br />& Inventory System
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed">
            Manage your retail business with ease — create invoices, track stock, manage suppliers, and grow with confidence.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {[
            { icon: '🧾', label: 'GST Invoices & POS Billing', desc: 'CGST / SGST / IGST auto-calculation' },
            { icon: '📦', label: 'Real-time Inventory', desc: 'Stock alerts via WhatsApp' },
            { icon: '📊', label: 'Business Reports', desc: 'P&L, GST Summary, Export to Excel' },
            { icon: '👥', label: 'Multi-user Roles', desc: 'Owner, Manager, Cashier, Staff' },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <p className="font-semibold text-sm">{f.label}</p>
                <p className="text-blue-200 text-xs">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md">
          {/* Logo (mobile) */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">R</span>
            </div>
            <span className="text-xl font-bold text-slate-900">RetailPro</span>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl bg-white border border-slate-200 p-1 mb-8 shadow-card">
            <button
              id="tab-login"
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'login' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t('auth.login')}
            </button>
            <button
              id="tab-register"
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'register' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t('auth.register')}
            </button>
          </div>

          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
              <span className="text-red-500 mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{t('auth.loginTitle')}</h2>
                <p className="text-slate-500 text-sm mt-1">{t('auth.loginSubtitle')}</p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-email">{t('auth.email')}</label>
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  placeholder="you@business.com"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm(f => ({ ...f, email: e.target.value }))}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">{t('auth.password')}</label>
                <input
                  id="login-password"
                  type="password"
                  className="form-input"
                  placeholder="Enter your password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(f => ({ ...f, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                id="btn-login"
                type="submit"
                className="btn-primary w-full justify-center py-3 text-base"
                disabled={isLoading}
              >
                {isLoading ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing in…</>
                ) : t('auth.login')}
              </button>


            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{t('auth.register')}</h2>
                <p className="text-slate-500 text-sm mt-1">Create your business account — free forever</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="reg-biz-name">{t('auth.businessName')} *</label>
                  <input id="reg-biz-name" type="text" className="form-input" placeholder="Sharma General Store" value={regForm.businessName} onChange={e => setRegForm(f => ({ ...f, businessName: e.target.value }))} required />
                </div>
                <div>
                  <label className="form-label" htmlFor="reg-owner-name">{t('auth.ownerName')} *</label>
                  <input id="reg-owner-name" type="text" className="form-input" placeholder="Rahul Sharma" value={regForm.ownerName} onChange={e => setRegForm(f => ({ ...f, ownerName: e.target.value }))} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="reg-email">{t('auth.email')} *</label>
                  <input
                    id="reg-email"
                    type="email"
                    className="form-input"
                    placeholder="rahul@store.com"
                    value={regForm.email}
                    onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="reg-phone">{t('auth.phone')} *</label>
                  <input
                    id="reg-phone"
                    type="tel"
                    className="form-input"
                    placeholder="9876543210"
                    value={regForm.phone}
                    onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="reg-password">{t('auth.password')} *</label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showRegPassword ? 'text' : 'password'}
                      className="form-input pr-9"
                      placeholder="Min 8 characters"
                      value={regForm.password}
                      onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(s => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      tabIndex={-1}
                      title={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label" htmlFor="reg-confirm-password">Confirm Password *</label>
                  <div className="relative">
                    <input
                      id="reg-confirm-password"
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      className={`form-input pr-9 ${
                        regForm.confirmPassword
                          ? regForm.password === regForm.confirmPassword
                            ? 'border-emerald-500 focus:border-emerald-600'
                            : 'border-red-400 focus:border-red-500 bg-red-50/30'
                          : ''
                      }`}
                      placeholder="Re-enter password"
                      value={regForm.confirmPassword}
                      onChange={e => setRegForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(s => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      tabIndex={-1}
                      title={showRegConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegConfirmPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                  {regForm.confirmPassword && (
                    <p className={`text-[11px] mt-1 font-medium ${
                      regForm.password === regForm.confirmPassword ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {regForm.password === regForm.confirmPassword ? '✓ Passwords match' : '✕ Passwords do not match'}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="reg-state">State</label>
                  <input id="reg-state" type="text" className="form-input" placeholder="Maharashtra" value={regForm.state} onChange={e => setRegForm(f => ({ ...f, state: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label" htmlFor="reg-gstin">GSTIN (optional)</label>
                  <input id="reg-gstin" type="text" className="form-input" placeholder="27AAAPZ0059Q1Z6" value={regForm.gstin} onChange={e => setRegForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))} maxLength={15} />
                </div>
              </div>

              <button
                id="btn-register"
                type="submit"
                className="btn-primary w-full justify-center py-3 text-base mt-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating account…</>
                ) : 'Create Business Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
