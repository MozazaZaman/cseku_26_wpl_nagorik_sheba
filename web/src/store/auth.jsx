import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ns_user')) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem('ns_user', JSON.stringify(user));
    else localStorage.removeItem('ns_user');
  }, [user]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('ns_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('ns_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const registerWithFace = async (formData) => {
    const { data } = await api.post('/auth/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    localStorage.setItem('ns_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('ns_token');
    setUser(null);
  };

  // Dual-mode sessions for system administrators: the same person keeps a
  // normal citizen account and may switch into/out of super_admin at will.
  const switchMode = async (mode) => {
    const { data } = await api.post('/auth/mode', { mode });
    localStorage.setItem('ns_token', data.token);
    setUser(data.user);
    return data.user;
  };

  return <AuthCtx.Provider value={{ user, login, register, registerWithFace, logout, switchMode }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

/**
 * Single destination rule for every entry point (login, drawer switch):
 * super admins land on their console, staff on the console, everyone else
 * on the citizen home (or a redirect target). One path, no duplicates.
 */
export function destinationFor(user, fallback = '/dashboard') {
  if (!user) return '/login';
  if (user.role === 'super_admin') return '/superadmin';
  if (user.role === 'staff') return '/staff';
  return fallback;
}
