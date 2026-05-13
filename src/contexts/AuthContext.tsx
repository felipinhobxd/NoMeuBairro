import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { supabase } from '../utils/supabase';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: { name?: string; avatarUrl?: string }) => Promise<{ ok: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // ─── Fetch Profile Data from our public.users table ───
  const fetchProfile = useCallback(async (id: string, email: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (data && !error) {
      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        avatarUrl: data.avatar_url,
        badges: [],
        reputation: data.reputation || 0,
        postsCount: 0,
        supportsReceived: 0,
        createdAt: data.created_at,
      });
    } else {
      // Fallback if public profile doesn't exist yet
      setUser({
        id, name: 'Morador', email, badges: [], reputation: 0, postsCount: 0, supportsReceived: 0, createdAt: new Date().toISOString()
      });
    }
  }, []);

  // ─── Initialize Session ───
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email!);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email!);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const register = useCallback(async (name: string, email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name } // This goes to raw_user_meta_data for the trigger
      }
    });

    if (error) return { ok: false, error: error.message };
    if (data.user) {
      await fetchProfile(data.user.id, email);
      return { ok: true };
    }
    return { ok: false, error: 'Erro ao criar conta.' };
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return { ok: false, error: error.message };
    if (data.user) {
      await fetchProfile(data.user.id, email);
      return { ok: true };
    }
    return { ok: false, error: 'Login falhou.' };
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: { name?: string; avatarUrl?: string }): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Não autenticado.' };

    const updates: any = {};
    if (data.name) updates.name = data.name;
    if (data.avatarUrl) updates.avatar_url = data.avatarUrl;

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (error) return { ok: false, error: error.message };

    setUser(prev => prev ? { ...prev, ...data } : null);
    return { ok: true };
  }, [user]);

  const changePassword = useCallback(async (_currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, register, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
