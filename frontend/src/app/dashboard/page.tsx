'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { useI18n } from '@/contexts/I18nContext';

interface DashboardMetrics {
  todaySales: number;
  monthSales: number;
  taxableRevenue?: number;
  grossProfit: number;
  netProfit: number;
  grossProfitMarginPercent?: number;
  netProfitMarginPercent?: number;
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  customerDues: number;
  supplierDues: number;
  inventoryValue: number;
  recentSales: any[];
  lowStockProducts: any[];
  topProducts: any[];
  salesTrend: any[];
}

function formatCurrency(val: number | string | undefined | null) {
  const n = Number(val || 0);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function StatCard({
  id, label, value, sub, icon, color = 'blue', change,
}: {
  id: string; label: string; value: string; sub?: string; icon: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'orange';
  change?: { value: number; label: string };
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-emerald-50 text-emerald-600',
    amber:  'bg-amber-50 text-amber-600',
    red:    'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div id={id} className="card p-5 flex flex-col gap-3 card-hover cursor-default">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
          <span className="text-xl">{icon}</span>
        </div>
      </div>
      {change && (
        <div className={change.value >= 0 ? 'stat-change-up' : 'stat-change-down'}>
          <span>{change.value >= 0 ? '↑' : '↓'}</span>
          <span>{Math.abs(change.value).toFixed(1)}% {change.label}</span>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useI18n();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [metricsRes, trendRes] = await Promise.all([
          api.get('/reports/dashboard'),
          api.get('/reports/sales-trend?days=7'),
        ]);

        const raw = metricsRes.data?.data || {};
        const parsed: DashboardMetrics = {
          todaySales: Number(raw.todaySales || 0),
          monthSales: Number(raw.monthSales || 0),
          taxableRevenue: Number(raw.taxableRevenue ?? raw.profitability?.taxableRevenue ?? 0),
          grossProfit: Number(raw.grossProfit ?? raw.profitability?.grossProfit ?? 0),
          netProfit: Number(raw.netProfit ?? raw.profitability?.netProfit ?? 0),
          grossProfitMarginPercent: Number(raw.grossProfitMarginPercent ?? raw.profitability?.grossProfitMarginPercent ?? 0),
          netProfitMarginPercent: Number(raw.netProfitMarginPercent ?? raw.profitability?.netProfitMarginPercent ?? 0),
          totalProducts: Number(raw.activeProductsCount ?? raw.totalProducts ?? 0),
          lowStockCount: Number(raw.lowStockCount || 0),
          outOfStockCount: Number(raw.outOfStockCount || 0),
          customerDues: Number(raw.customerOutstandingDues ?? raw.customerDues ?? 0),
          supplierDues: Number(raw.supplierOutstandingDues ?? raw.supplierDues ?? 0),
          inventoryValue: Number(raw.inventoryValuation?.retailValue ?? raw.inventoryValuation?.costValue ?? raw.inventoryValue ?? 0),
          recentSales: Array.isArray(raw.recentSales) ? raw.recentSales : [],
          lowStockProducts: Array.isArray(raw.lowStockProductsList) ? raw.lowStockProductsList : (Array.isArray(raw.lowStockProducts) ? raw.lowStockProducts : []),
          topProducts: Array.isArray(raw.topProducts) ? raw.topProducts : [],
          salesTrend: Array.isArray(trendRes.data?.data) ? trendRes.data.data : [],
        };

        setMetrics(parsed);
        setTrend(parsed.salesTrend);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const m = metrics;

  return (
    <AppShell title="Dashboard" subtitle={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}! Here's your business overview.`}>
      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card p-5 h-28 skeleton" />
          ))}
        </div>
      )}

      {error && (
        <div className="card p-6 text-center text-red-500 mb-6">
          <p className="text-lg mb-1">⚠ Failed to load dashboard</p>
          <p className="text-sm text-slate-400">{error}</p>
        </div>
      )}

      {m && (
        <>

          {/* KPI Cards Row 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard id="stat-today-sales" label={t('dashboard.todaySales')} value={formatCurrency(m.todaySales)} icon="🧾" color="blue" />
            <StatCard
              id="stat-monthly-sales"
              label={t('dashboard.monthlySales')}
              value={formatCurrency(m.monthSales)}
              sub={m.taxableRevenue ? `₹${Number(m.taxableRevenue).toLocaleString('en-IN')} net taxable` : undefined}
              icon="📈"
              color="green"
            />
            <StatCard
              id="stat-gross-profit"
              label={t('dashboard.grossProfit')}
              value={formatCurrency(m.grossProfit)}
              sub={m.grossProfitMarginPercent !== undefined ? `${m.grossProfitMarginPercent}% gross margin` : undefined}
              icon="💹"
              color="purple"
            />
            <StatCard
              id="stat-net-profit"
              label={t('dashboard.netProfit')}
              value={formatCurrency(m.netProfit)}
              sub={m.netProfitMarginPercent !== undefined ? `${m.netProfitMarginPercent}% net margin` : undefined}
              icon="💰"
              color="orange"
            />
          </div>

          {/* KPI Cards Row 2 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard id="stat-total-products" label={t('dashboard.totalProducts')} value={(m.totalProducts ?? 0).toLocaleString('en-IN')} icon="📦" color="blue" />
            <StatCard
              id="stat-low-stock"
              label={t('dashboard.lowStock')}
              value={(m.lowStockCount ?? 0).toLocaleString('en-IN')}
              sub={`${m.outOfStockCount ?? 0} out of stock`}
              icon="⚠️"
              color="amber"
            />
            <StatCard id="stat-customer-dues" label={t('dashboard.customerDues')} value={formatCurrency(m.customerDues)} icon="👥" color="red" />
            <StatCard id="stat-inventory-value" label={t('dashboard.inventoryValue')} value={formatCurrency(m.inventoryValue)} icon="🏪" color="green" />
          </div>

          {/* Bottom section — two columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Sales */}
            <div className="lg:col-span-2 card">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800 text-sm">{t('dashboard.recentSales')}</h2>
                <Link href="/sales" className="text-xs text-brand-600 hover:underline font-medium">View all →</Link>
              </div>
              {m.recentSales && m.recentSales.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.recentSales.map((sale: any) => (
                        <tr key={sale.id}>
                          <td className="font-mono text-xs text-brand-600">{sale.invoiceNumber}</td>
                          <td className="max-w-[150px] truncate">{sale.customer?.name || 'Walk-in'}</td>
                          <td className="font-semibold">{formatCurrency(sale.grandTotal)}</td>
                          <td>
                            <span className={`badge ${sale.paymentStatus === 'PAID' ? 'badge-success' : sale.paymentStatus === 'PARTIAL' ? 'badge-warning' : 'badge-danger'}`}>
                              {sale.paymentStatus}
                            </span>
                          </td>
                          <td className="text-slate-400 text-xs">{new Date(sale.invoiceDate).toLocaleDateString('en-IN')}</td>
                          <td>
                            <Link href={`/sales/${sale.id}`} className="text-xs text-brand-600 hover:underline">
                              View →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p className="text-3xl mb-2">🧾</p>
                  <p className="text-sm">No sales yet. <Link href="/sales/pos" className="text-brand-600 hover:underline">Create your first invoice →</Link></p>
                </div>
              )}
            </div>

            {/* Low Stock Alerts */}
            <div className="card">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800 text-sm">{t('dashboard.lowStockAlerts')}</h2>
                <Link href="/inventory" className="text-xs text-brand-600 hover:underline font-medium">Manage →</Link>
              </div>
              {m.lowStockProducts && m.lowStockProducts.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {m.lowStockProducts.slice(0, 8).map((p: any) => (
                    <li key={p.id} className="px-5 py-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${Number(p.currentStock) === 0 ? 'bg-red-100' : 'bg-amber-100'}`}>
                        <span className="text-sm">{Number(p.currentStock) === 0 ? '🚫' : '⚠️'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                        <p className="text-xs text-slate-400 truncate">{p.sku}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${Number(p.currentStock) === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                          {p.currentStock}
                        </p>
                        <p className="text-xs text-slate-400">{p.unit || 'units'}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="text-sm">All products are well stocked</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
