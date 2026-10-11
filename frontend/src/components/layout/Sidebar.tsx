'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';

interface NavItem {
  key: string;
  href: string;
  icon: string;
  label: string;
  section?: string;
}

const navItems: NavItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: '◻', label: 'nav.dashboard', section: 'MAIN' },
  { key: 'sales-pos', href: '/sales/pos', icon: '🧾', label: 'nav.sales', section: 'SALES' },
  { key: 'payments', href: '/payments', icon: '💰', label: 'nav.payments', section: 'SALES' },
  { key: 'customers', href: '/customers', icon: '👥', label: 'nav.salesParties', section: 'PARTIES' },
  { key: 'suppliers', href: '/suppliers', icon: '🏭', label: 'nav.purchaseParties', section: 'PARTIES' },
  { key: 'products', href: '/products', icon: '📦', label: 'nav.products', section: 'INVENTORY' },
  { key: 'categories', href: '/categories', icon: '🗂', label: 'nav.categories', section: 'INVENTORY' },
  { key: 'inventory', href: '/inventory', icon: '📋', label: 'nav.inventory', section: 'INVENTORY' },
  { key: 'purchases', href: '/purchases', icon: '🛒', label: 'nav.purchases', section: 'PROCUREMENT' },
  { key: 'expenses', href: '/expenses', icon: '💸', label: 'nav.expenses', section: 'FINANCE' },
  { key: 'reports', href: '/reports', icon: '📊', label: 'nav.reports', section: 'FINANCE' },
  { key: 'settings', href: '/settings', icon: '⚙', label: 'nav.settings', section: 'SYSTEM' },
];

const sections: Record<string, string> = {
  MAIN: 'Overview',
  SALES: 'Sales & POS',
  PARTIES: 'Parties (पार्टियां)',
  INVENTORY: 'Inventory',
  PROCUREMENT: 'Procurement',
  FINANCE: 'Finance',
  SYSTEM: 'System',
};

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const grouped = navItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    const s = item.section || 'MAIN';
    if (!acc[s]) acc[s] = [];
    acc[s].push(item);
    return acc;
  }, {});

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <aside className="flex flex-col h-full bg-white border-r border-slate-200 w-[260px] flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-sm">
          <span className="text-white font-bold text-sm">R</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm truncate">RetailPro</p>
          <p className="text-xs text-slate-400 truncate">{user?.businessName || 'Business'}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="btn-icon text-slate-400 lg:hidden">✕</button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {Object.entries(grouped).map(([section, items]) => (
          <div key={section}>
            {section !== 'MAIN' && (
              <p className="sidebar-section-label">{sections[section]}</p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      id={`nav-${item.key}`}
                      className={`sidebar-link ${active ? 'sidebar-link-active' : ''}`}
                    >
                      <span className="text-lg w-5 text-center leading-none">{item.icon}</span>
                      <span>{t(item.label)}</span>
                      {active && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-brand-700 font-semibold text-xs">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate capitalize">{user?.role?.toLowerCase()}</p>
          </div>
          <button
            id="btn-logout"
            onClick={logout}
            title="Logout"
            className="btn-icon text-slate-400 hover:text-red-500"
          >
            ⎋
          </button>
        </div>
      </div>
    </aside>
  );
}
