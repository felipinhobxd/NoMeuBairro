import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, AccountType } from '../types';
import { supabase } from '../utils/supabase';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string; pendingVerification?: boolean }>;
  logout: () => void;
  updateProfile: (data: { name?: string; avatarUrl?: string }) => Promise<{ ok: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>(null!);

function getAccountType(metadata: Record<string, any> | undefined): AccountType {
  return metadata?.account_type === 'company' ? 'company' : 'resident';
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!match) return null;
  try {
    const mime = match[1] || 'image/jpeg';
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const fetchProfile = useCallback(async (id: string, email: string, metadata?: Record<string, any>) => {
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
          accountType: getAccountType(metadata),
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
      if (attempts < maxAttempts) await new Promise(res => setTimeout(res, 1000 * attempts));
    }

    setUser({
      id,
      name: metadata?.name || 'Morador',
      email,
      accountType: getAccountType(metadata),
      badges: [],
      reputation: 0,
      postsCount: 0,
      supportsReceived: 0,
      createdAt: new Date().toISOString(),
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchProfile(session.user.id, session.user.email || '', session.user.user_metadata);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) fetchProfile(session.user.id, session.user.email || '', session.user.user_metadata);
      else setUser(null);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const register = useCallback(async (name: string, email: string, password: string): Promise<{ ok: boolean; error?: string; pendingVerification?: boolean }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, account_type: 'resident' } },
    });

    if (error) return { ok: false, error: error.message };
    if (data.user) {
      if (data.session) {
        await fetchProfile(data.user.id, email, data.user.user_metadata);
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
      await fetchProfile(data.user.id, data.user.email || email, data.user.user_metadata);
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

    let storedAvatarUrl: string | null | undefined;

    if (data.avatarUrl !== undefined) {
      if (!data.avatarUrl) {
        storedAvatarUrl = null;
        try {
          await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`]);
        } catch {
          // A remoção do arquivo não impede a limpeza da URL no perfil.
        }
      } else if (data.avatarUrl.startsWith('data:image/')) {
        const blob = dataUrlToBlob(data.avatarUrl);
        if (!blob) return { ok: false, error: 'Não foi possível processar a foto recortada.' };

        const path = `${user.id}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, blob, {
            contentType: 'image/jpeg',
            upsert: true,
            cacheControl: '31536000',
          });

        if (uploadError) return { ok: false, error: `Não foi possível salvar a foto: ${uploadError.message}` };

        const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path);
        storedAvatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;
      } else {
        storedAvatarUrl = data.avatarUrl;
      }
    }

    const updates: { name?: string; avatar_url?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updates.name = data.name;
    if (storedAvatarUrl !== undefined) updates.avatar_url = storedAvatarUrl;

    if (Object.keys(updates).length === 1) return { ok: false, error: 'Nenhuma alteração para salvar.' };

    const { data: saved, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select('id, name, avatar_url, reputation, created_at')
      .single();

    if (error || !saved) return { ok: false, error: error?.message || 'Não foi possível salvar o perfil.' };

    setUser(prev => prev ? {
      ...prev,
      name: saved.name,
      avatarUrl: saved.avatar_url,
      reputation: saved.reputation || 0,
      createdAt: saved.created_at,
    } : null);

    return { ok: true };
  }, [user]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user?.email) return { ok: false, error: 'Usuário não identificado.' };
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
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
