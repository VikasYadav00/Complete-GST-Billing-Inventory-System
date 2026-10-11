'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setTokens, clearTokens } from '@/lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  businessId: string;
  businessName: string;
  permissions?: { resource: string; action: string }[];
  preferredLanguage?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  hasPermission: (resource: string, action: string) => boolean;
}

interface RegisterData {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  phone: string;
  state?: string;
  stateCode?: string;
  gstin?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('rp_user') : null;
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch { /* invalid json */ }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { user: u, accessToken, refreshToken } = data.data;
    setTokens(accessToken, refreshToken);
    localStorage.setItem('rp_user', JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('rp_refresh_token') : null;
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch { /* ignore */ }
    clearTokens();
    setUser(null);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const { data: res } = await api.post('/auth/register', data);
    const { user: u, accessToken, refreshToken } = res.data;
    setTokens(accessToken, refreshToken);
    localStorage.setItem('rp_user', JSON.stringify(u));
    setUser(u);
  }, []);

  const hasPermission = useCallback(
    (resource: string, action: string) => {
      if (!user) return false;
      if (user.role === 'OWNER') return true;
      if (!user.permissions) return false;
      return user.permissions.some(
        (p) =>
          (p.resource === '*' || p.resource === resource) &&
          (p.action === '*' || p.action === action || p.action === 'manage')
      );
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, register, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
