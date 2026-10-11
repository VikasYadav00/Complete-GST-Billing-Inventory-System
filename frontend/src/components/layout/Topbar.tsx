'use client';

import React, { useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';

interface TopbarProps {
  title?: string;
  subtitle?: string;
  onMenuClick?: () => void;
}

export function Topbar({ title, subtitle, onMenuClick }: TopbarProps) {
  const { language, setLanguage } = useI18n();
  const { user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-4 px-5 flex-shrink-0">
      {/* Mobile menu toggle */}
      <button
        id="btn-mobile-menu"
        className="btn-icon lg:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        ☰
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        {title && <h1 className="text-base font-semibold text-slate-900 truncate">{title}</h1>}
        {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          id="btn-language-toggle"
          onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          title="Toggle language / भाषा बदलें"
        >
          {language === 'en' ? 'हि' : 'En'}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            id="btn-notifications"
            className="btn-icon relative"
            onClick={() => setNotifOpen(!notifOpen)}
            aria-label="Notifications"
          >
            🔔
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 card shadow-lg z-50 animate-fade-in">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900 text-sm">Notifications</h3>
              </div>
              <div className="p-4 text-center text-slate-400 text-sm">
                <span className="text-2xl block mb-2">🎉</span>
                No new notifications
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-brand-700 font-semibold text-xs">
            {user?.name?.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  );
}
