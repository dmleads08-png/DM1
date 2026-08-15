import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import type { Session, User } from '@supabase/supabase-js';
import { authConfigured, supabase } from './auth';

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendRecovery: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(authConfigured);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) setLoading(false); }, 4000);

    supabase.auth.getSession()
      .then(({ data }) => { if (!cancelled) { setSession(data.session); } })
      .catch(() => { if (!cancelled) setSession(null); })
      .finally(() => { if (!cancelled) { clearTimeout(timer); setLoading(false); } });

    const { data: authListener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { setRole(null); delete axios.defaults.headers.common.Authorization; }
      setLoading(false);
    });

    return () => { cancelled = true; clearTimeout(timer); authListener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      axios.defaults.headers.common.Authorization = `Bearer ${session.access_token}`;
      const VITE_API = import.meta.env.VITE_API_URL || 'http://localhost:3378/api';
      axios.get(`${VITE_API}/me`)
        .then(r => setRole(r.data.role || 'user'))
        .catch(() => setRole('user'));
    }
  }, [session?.access_token]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('No configurado');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); setRole(null); };
  const sendRecovery = async (email: string) => {
    if (!supabase) throw new Error('No configurado');
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
  };

  return <AuthContext.Provider value={{
    configured: authConfigured, loading, session, user: session?.user || null,
    role, signIn, signOut, sendRecovery
  }}>{children}</AuthContext.Provider>;
};
