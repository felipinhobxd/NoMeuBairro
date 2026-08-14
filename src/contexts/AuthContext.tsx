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

  const fetchProfile = useCallback(async (id: string, email: string, metadataName?: string) => {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, avatar_url, reputation, created_at')
        .eq('id', id)
        .maybeSingle();

      if (data && !error) {
        setUser({
          id: data.id,
          name: data.name,
          email,
          avatarUrl: data.avatar_url,
          badges: [],
          reputation: data.reputation || 0,
          postsCount: 0,
          supportsReceived: 0,
          createdAt: data.created_at,
        });
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(res => setTimeout(res, 1000 * attempts));
      }
    }

    setUser({
      id,
      name: metadataName || 'Morador',
      email,
      badges: [],
      reputation: 0,
      postsCount: 0,
      supportsReceived: 0,
      createdAt: new Date().toISOString()
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata?.name
        );
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata?.name
        );
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const register = useCallback(async (name: string, email: string, password: string): Promise<{ ok: boolean; error?: string; pendingVerification?: boolean }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });

    if (error) return { ok: false, error: error.message };

    if (data.user) {
      if (data.session) {
        await fetchProfile(data.user.id, email, name);
        return { ok: true };
      }
      return { ok: true, pendingVerification: true };
    }

    return { ok: false, error: 'Erro ao criar conta.' };
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return { ok: false, error: error.message };
    if (data.user) {
      await fetchProfile(data.user.id, data.user.email || email, data.user.user_metadata?.name);
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

    const updates: Record<string, string> = {};
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

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user?.email) return { ok: false, error: 'Usuário não identificado.' };

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });

    if (loginError) return { ok: false, error: 'A senha atual está incorreta.' };

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, register, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
