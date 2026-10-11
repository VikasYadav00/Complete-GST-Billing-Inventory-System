'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { useI18n } from '@/contexts/I18nContext';

export default function ReportsPage() {
  const { t } = useI18n();
  const [dashMetrics, setDashMetrics] = useState<any>(null);
  const [pnlReport, setPnlReport] = useState<any>(null);
  const [gstSummary, setGstSummary] = useState<any>(null);
  const [invValuation, setInvValuation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dash, pnl, gst, inv] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get(`/reports/profit-loss?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/reports/gst-summary?startDate=${startDate}&endDate=${endDate}`),
        api.get('/reports/inventory-valuation'),
      ]);
      setDashMetrics(dash.data.data);
      setPnlReport(pnl.data.data);
      setGstSummary(gst.data.data);
      setInvValuation(inv.data.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const setDatePreset = (preset: 'month' | 'today' | 'quarter' | 'year') => {
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    let start = new Date();

    if (preset === 'today') {
      start = today;
    } else if (preset === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (preset === 'quarter') {
      const currentQuarter = Math.floor(today.getMonth() / 3);
      start = new Date(today.getFullYear(), currentQuarter * 3, 1);
    } else if (preset === 'year') {
      // Indian Financial Year: April 1st
      const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      start = new Date(fyStartYear, 3, 1);
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(endStr);
  };

  const fmt = (n: number | string | undefined | null) =>
    `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <AppShell title="Reports" subtitle="Business performance, GST filings & profit analysis">
      {/* Date Filter Bar */}
      <div className="card p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase">Period Presets:</span>
          <button
            onClick={() => setDatePreset('month')}
            className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 font-medium text-slate-700 transition"
          >
            This Month
          </button>
          <button
            onClick={() => setDatePreset('today')}
            className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 font-medium text-slate-700 transition"
          >
            Today
          </button>
          <button
            onClick={() => setDatePreset('quarter')}
            className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 font-medium text-slate-700 transition"
          >
            This Quarter
          </button>
          <button
            onClick={() => setDatePreset('year')}
            className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 font-medium text-slate-700 transition"
          >
            This FY
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">From:</span>
          <input
            type="date"
            className="form-input text-xs py-1.5"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-xs text-slate-500">To:</span>
          <input
            type="date"
            className="form-input text-xs py-1.5"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <button onClick={loadAll} className="btn-primary btn-sm">
            Apply Filters
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-48 skeleton" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Profit & Loss Statement */}
          <div className="card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-slate-100 gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>📈</span> Profit & Loss Statement
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reporting Period: {startDate} to {endDate} • {pnlReport?.invoicesCount || 0} Invoices processed
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-success text-xs">
                  Gross Margin: {pnlReport?.grossProfitMargin ?? 0}%
                </span>
                <span className="badge badge-primary text-xs">
                  Net Margin: {pnlReport?.netProfitMargin ?? 0}%
                </span>
              </div>
            </div>

            {/* 6 Key Financial Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
              {/* 1. Gross Sales */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Gross Sales</p>
                <p className="text-lg font-bold text-slate-900 mt-1">{fmt(pnlReport?.grossSales)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Total billed incl. GST</p>
              </div>

              {/* 2. Net Turnover */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 text-center">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Net Turnover</p>
                <p className="text-lg font-bold text-blue-900 mt-1">{fmt(pnlReport?.taxableRevenue)}</p>
                <p className="text-[11px] text-blue-600 mt-0.5">Revenue excl. GST</p>
              </div>

              {/* 3. Cost of Goods Sold */}
              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100 text-center">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">COGS</p>
                <p className="text-lg font-bold text-amber-900 mt-1">{fmt(pnlReport?.cogs)}</p>
                <p className="text-[11px] text-amber-600 mt-0.5">Purchase cost snapshot</p>
              </div>

              {/* 4. Gross Profit */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Gross Profit</p>
                <p
                  className={`text-lg font-bold mt-1 ${
                    Number(pnlReport?.grossProfit) >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {fmt(pnlReport?.grossProfit)}
                </p>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                  Margin: {pnlReport?.grossProfitMargin ?? 0}%
                </p>
              </div>

              {/* 5. Operating Expenses */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expenses</p>
                <p className="text-lg font-bold text-slate-900 mt-1">{fmt(pnlReport?.totalExpenses)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Store & utility costs</p>
              </div>

              {/* 6. Net Profit */}
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 text-center">
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Net Profit</p>
                <p
                  className={`text-lg font-bold mt-1 ${
                    Number(pnlReport?.netProfit) >= 0 ? 'text-purple-700' : 'text-red-600'
                  }`}
                >
                  {fmt(pnlReport?.netProfit)}
                </p>
                <p className="text-[11px] text-purple-600 font-medium mt-0.5">
                  Net: {pnlReport?.netProfitMargin ?? 0}%
                </p>
              </div>
            </div>

            {/* Formula Explanation Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                <span>💡</span> Accounting Reconciliation:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500">Gross Sales ({fmt(pnlReport?.grossSales)})</span> = Net Turnover ({fmt(pnlReport?.taxableRevenue)}) + Output GST ({fmt(pnlReport?.totalGstCollected)})
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-emerald-700 font-bold">Gross Profit ({fmt(pnlReport?.grossProfit)})</span> = Net Turnover ({fmt(pnlReport?.taxableRevenue)}) − COGS ({fmt(pnlReport?.cogs)})
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-purple-700 font-bold">Net Profit ({fmt(pnlReport?.netProfit)})</span> = Gross Profit ({fmt(pnlReport?.grossProfit)}) − Expenses ({fmt(pnlReport?.totalExpenses)})
                </div>
              </div>
            </div>

            {/* Expense Breakdown if any */}
            {pnlReport?.expenseBreakdown && pnlReport.expenseBreakdown.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-semibold text-slate-700 uppercase mb-3">Expenses by Category</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {pnlReport.expenseBreakdown.map((item: any) => (
                    <div key={item.categoryName} className="p-3 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500">{item.categoryName}</p>
                      <p className="text-sm font-bold text-slate-800">{fmt(item.amount)}</p>
                      <p className="text-[10px] text-slate-400">{item.count} recorded</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* GST Summary Report */}
          <div className="card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>🧾</span> GST Tax Summary (GSTR-1 & Input Tax Credit)
              </h2>
              <span className="text-xs text-slate-500">
                Net Tax Payable: <strong className="text-slate-800">{fmt(gstSummary?.netGstPayable)}</strong>
              </span>
            </div>

            {gstSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Taxable Sales', value: fmt(gstSummary.outputTax?.totalTaxable) },
                    { label: 'CGST Collected', value: fmt(gstSummary.outputTax?.b2b?.cgst + gstSummary.outputTax?.b2c?.cgst) },
                    { label: 'SGST Collected', value: fmt(gstSummary.outputTax?.b2b?.sgst + gstSummary.outputTax?.b2c?.sgst) },
                    { label: 'IGST Collected', value: fmt(gstSummary.outputTax?.b2b?.igst + gstSummary.outputTax?.b2c?.igst) },
                  ].map((item) => (
                    <div key={item.label} className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{item.label}</p>
                      <p className="text-lg font-bold text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 text-center">
                    <p className="text-xs font-semibold text-blue-700 uppercase">Total Output Tax (Sales)</p>
                    <p className="text-base font-bold text-blue-900 mt-1">{fmt(gstSummary.outputTax?.totalOutputTax)}</p>
                  </div>
                  <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 text-center">
                    <p className="text-xs font-semibold text-emerald-700 uppercase">Input Tax Credit (Purchases)</p>
                    <p className="text-base font-bold text-emerald-900 mt-1">{fmt(gstSummary.inputTaxCredit?.totalInputCredit)}</p>
                  </div>
                  <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100 text-center">
                    <p className="text-xs font-semibold text-purple-700 uppercase">Net GST Payable</p>
                    <p className="text-base font-bold text-purple-900 mt-1">{fmt(gstSummary.netGstPayable)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No GST data available for selected period</p>
            )}
          </div>

          {/* Inventory Valuation */}
          <div className="card p-6">
            <h2 className="text-base font-bold text-slate-800 pb-4 mb-5 border-b border-slate-100 flex items-center gap-2">
              <span>📦</span> Current Inventory Valuation & Margin
            </h2>
            {invValuation ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Total Products', value: (invValuation.totalProducts ?? 0).toLocaleString('en-IN') },
                  { label: 'Total Units in Stock', value: (invValuation.totalUnits ?? 0).toLocaleString('en-IN') },
                  { label: 'Purchase Cost Value', value: fmt(invValuation.totalPurchaseValue ?? invValuation.totalCostValue) },
                  { label: 'Retail Selling Value', value: fmt(invValuation.totalSellingValue ?? invValuation.totalRetailValue) },
                  { label: 'Potential Margin', value: fmt(invValuation.totalPotentialMargin) },
                ].map((item) => (
                  <div key={item.label} className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{item.label}</p>
                    <p className="text-base font-bold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No inventory data available</p>
            )}
          </div>

          {/* Export Section */}
          <div className="card p-6">
            <h2 className="text-base font-bold text-slate-800 pb-4 mb-5 border-b border-slate-100 flex items-center gap-2">
              <span>📥</span> Export Reports & Ledgers
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: 'export-products-xlsx', label: 'Products (Excel)', href: `${process.env.NEXT_PUBLIC_API_URL}/reports/export/products` },
                { id: 'export-products-csv', label: 'Products (CSV)', href: `${process.env.NEXT_PUBLIC_API_URL}/reports/export/products?format=csv` },
                { id: 'export-sales-xlsx', label: 'Sales (Excel)', href: `${process.env.NEXT_PUBLIC_API_URL}/reports/export/sales?startDate=${startDate}&endDate=${endDate}` },
                { id: 'export-sales-csv', label: 'Sales (CSV)', href: `${process.env.NEXT_PUBLIC_API_URL}/reports/export/sales?format=csv&startDate=${startDate}&endDate=${endDate}` },
              ].map((item) => (
                <a
                  key={item.id}
                  id={item.id}
                  href={item.href}
                  download
                  className="btn-secondary text-center justify-center text-xs py-2.5"
                >
                  📥 {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
