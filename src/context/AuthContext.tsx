// ============================================================
// ARKA Finance — Auth Context
// ============================================================

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type UserRole, type Session } from '../types';
import { getSessionData, saveSession, clearSession } from '../services/authService';

interface AuthContextType {
  session: Session | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const existing = getSessionData();
    if (existing) setSession(existing);
  }, []);

  const login = (role: UserRole) => {
    saveSession(role);
    setSession(getSessionData());
  };

  const logout = () => {
    clearSession();
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        role: session?.role ?? null,
        isAuthenticated: session !== null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
