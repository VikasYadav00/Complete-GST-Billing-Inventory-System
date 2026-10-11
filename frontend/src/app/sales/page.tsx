'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { useI18n } from '@/contexts/I18nContext';
import { useDebounce } from '@/hooks/useDebounce';

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function SalesListPage() {
  const { t } = useI18n();
  const [sales, setSales] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const debouncedSearch = useDebounce(search, 400);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/sales', {
        params: { page, limit: 20, search: debouncedSearch || undefined, paymentStatus: paymentStatus || undefined },
      });
      setSales(data.data);
      setTotal(data.pagination?.total || 0);
    } catch {} finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, paymentStatus]);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell title={t('sales.title')} subtitle={`${total} invoices created`}>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input id="sales-search" type="text" className="form-input pl-9" placeholder="Search invoice #, customer…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select id="filter-payment-status" className="form-select w-40" value={paymentStatus} onChange={e => { setPaymentStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="UNPAID">Unpaid</option>
        </select>
        <div className="flex gap-2 ml-auto">
          <a href={`${process.env.NEXT_PUBLIC_API_URL}/reports/export/sales`} className="btn-secondary btn-sm" download>📥 Export Excel</a>
          <Link id="btn-new-sale" href="/sales/pos" className="btn-primary btn-sm">+ New Invoice</Link>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Taxable</th>
                <th>GST</th>
                <th>Grand Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(8)].map((_, i) => (
                <tr key={i}>{[...Array(10)].map((_, j) => <td key={j}><div className="skeleton h-4 w-20" /></td>)}</tr>
              )) : sales.length === 0 ? (
                <tr><td colSpan={10}>
                  <div className="empty-state">
                    <p className="text-3xl mb-2">🧾</p>
                    <p className="text-sm">No sales found. <Link href="/sales/pos" className="text-brand-600 hover:underline">Create first invoice →</Link></p>
                  </div>
                </td></tr>
              ) : sales.map(sale => (
                <tr key={sale.id}>
                  <td className="font-mono text-xs text-brand-600">{sale.invoiceNumber}</td>
                  <td className="text-slate-500 text-xs">{new Date(sale.invoiceDate).toLocaleDateString('en-IN')}</td>
                  <td className="max-w-[160px] truncate">
                    {sale.supplier ? (
                      <span className="inline-flex items-center gap-1 text-purple-700 font-semibold" title={`Supplier: ${sale.supplier.companyName || sale.supplier.name}`}>
                        <span className="text-xs">🏭</span> {sale.supplier.companyName || sale.supplier.name}
                      </span>
                    ) : (sale.saleType === 'WHOLESALE' || sale.customer?.customerType === 'WHOLESALE') ? (
                      <span className="inline-flex items-center gap-1 text-amber-800 font-medium" title={sale.customer?.companyName ? `${sale.customer.companyName} (${sale.customer.name})` : sale.customer?.name}>
                        <span className="text-xs">🏢</span> {sale.customer?.companyName || sale.customer?.name || 'Wholesale Party'}
                      </span>
                    ) : sale.customer ? (
                      <span className="text-slate-800" title={sale.customer.name}>
                        <span className="text-xs text-slate-400 mr-1">👤</span> {sale.customer.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Walk-in</span>
                    )}
                  </td>
                  <td>{formatINR(sale.taxableAmount)}</td>
                  <td className="text-slate-500 text-xs">{formatINR(Number(sale.cgstAmount) + Number(sale.sgstAmount) + Number(sale.igstAmount))}</td>
                  <td className="font-semibold">{formatINR(sale.grandTotal)}</td>
                  <td className="text-emerald-600 font-medium">{formatINR(sale.paidAmount)}</td>
                  <td className={Number(sale.balanceAmount) > 0 ? 'text-red-500 font-medium' : 'text-slate-400'}>
                    {formatINR(sale.balanceAmount)}
                  </td>
                  <td>
                    <span className={`badge ${sale.paymentStatus === 'PAID' ? 'badge-success' : sale.paymentStatus === 'PARTIAL' ? 'badge-warning' : 'badge-danger'}`}>
                      {sale.paymentStatus}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Link href={`/sales/${sale.id}`} id={`btn-view-sale-${sale.id}`} className="btn-icon text-xs" title="View">👁</Link>
                      <button onClick={() => window.open(`/sales/${sale.id}/print`, '_blank')} className="btn-icon text-xs" title="Print">🖨</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {Math.ceil(total / 20) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">Showing {((page-1)*20)+1}–{Math.min(page*20, total)} of {total}</p>
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
