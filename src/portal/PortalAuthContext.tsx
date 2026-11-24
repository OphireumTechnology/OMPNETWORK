import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  portalRequest,
  setPortalToken,
  setPortalUnauthorizedHandler,
} from './portalApi';
import { PortalProfile, PortalUser, PortalWallet } from './portalTypes';

interface PortalAuthContextValue {
  loading: boolean;
  user: PortalUser | null;
  profile: PortalProfile | null;
  wallet: PortalWallet | null;
  unreadNotifications: number;
  cartItemCount: number;
  devVerificationToken: string | null;
  setDevVerificationToken: (t: string | null) => void;
  refreshSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    phone?: string;
  }) => Promise<{ devVerificationToken?: string }>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthContextValue | null>(null);

export const PortalAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<PortalUser | null>(null);
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [wallet, setWallet] = useState<PortalWallet | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [devVerificationToken, setDevVerificationToken] = useState<string | null>(null);

  const clearState = useCallback(() => {
    setUser(null);
    setProfile(null);
    setWallet(null);
    setUnreadNotifications(0);
    setCartItemCount(0);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await portalRequest<{
        user: PortalUser;
        profile: PortalProfile;
        wallet: PortalWallet;
        unreadNotifications: number;
        cartItemCount: number;
      }>('/auth/me');
      setUser(res.user);
      setProfile(res.profile);
      setWallet(res.wallet);
      setUnreadNotifications(res.unreadNotifications || 0);
      setCartItemCount(res.cartItemCount || 0);
    } catch {
      setPortalToken(null);
      clearState();
    } finally {
      setLoading(false);
    }
  }, [clearState]);

  useEffect(() => {
    setPortalUnauthorizedHandler(() => {
      clearState();
    });
    void refreshSession();
    return () => setPortalUnauthorizedHandler(null);
  }, [clearState, refreshSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await portalRequest<{ token: string; user: PortalUser; profile: PortalProfile }>(
        '/auth/login',
        { method: 'POST', body: { email, password }, skipAuth: true }
      );
      setPortalToken(res.token);
      await refreshSession();
    },
    [refreshSession]
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      companyName?: string;
      phone?: string;
    }) => {
      const res = await portalRequest<{
        token: string;
        user: PortalUser;
        profile: PortalProfile;
        devVerificationToken?: string;
      }>('/auth/register', { method: 'POST', body: input, skipAuth: true });
      setPortalToken(res.token);
      if (res.devVerificationToken) {
        setDevVerificationToken(res.devVerificationToken);
      }
      await refreshSession();
      return { devVerificationToken: res.devVerificationToken };
    },
    [refreshSession]
  );

  const logout = useCallback(async () => {
    try {
      await portalRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Clear local state regardless
    }
    setPortalToken(null);
    clearState();
  }, [clearState]);

  const logoutAll = useCallback(async () => {
    try {
      await portalRequest('/auth/logout-all', { method: 'POST' });
    } catch {
      // Clear local state regardless
    }
    setPortalToken(null);
    clearState();
  }, [clearState]);

  return (
    <PortalAuthContext.Provider
      value={{
        loading,
        user,
        profile,
        wallet,
        unreadNotifications,
        cartItemCount,
        devVerificationToken,
        setDevVerificationToken,
        refreshSession,
        login,
        register,
        logout,
        logoutAll,
      }}
    >
      {children}
    </PortalAuthContext.Provider>
  );
};

export function usePortalAuth(): PortalAuthContextValue {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalAuth must be used inside PortalAuthProvider');
  return ctx;
}
