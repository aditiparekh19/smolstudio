'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, loginMutation, logoutMutation, meQuery, registerMutation } from '../lib/graphql';
import type { Cart, User } from '../lib/types';

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Cart>;
  register: (input: { email: string; password: string; firstName?: string; lastName?: string }) => Promise<Cart>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await apiClient().request<{ me: User | null }>(meQuery);
      setUser(result.me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login: async (email, password) => {
      const token = localStorage.getItem('smolstudio-cart-token') ?? '';
      const result = await apiClient(token ? { 'x-cart-token': token } : undefined)
        .request<{ login: { user: User; cart: Cart } }>(loginMutation, { email, password });
      setUser(result.login.user);
      return result.login.cart;
    },
    register: async (input) => {
      const token = localStorage.getItem('smolstudio-cart-token') ?? '';
      const result = await apiClient(token ? { 'x-cart-token': token } : undefined)
        .request<{ register: { user: User; cart: Cart } }>(registerMutation, input);
      setUser(result.register.user);
      return result.register.cart;
    },
    logout: async () => {
      await apiClient().request(logoutMutation);
      setUser(null);
    },
    refresh
  }), [user, loading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
