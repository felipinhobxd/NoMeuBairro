import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { User, AccountType } from '../types';
import { supabase } from '../utils/supabase';
import { disconnectPushOnLogout } from '../utils/pushNotifications';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  canModerate: boolean;
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

function avatarStoragePath(url: string | undefined, userId: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = '/storage/v1/object/public/avatars/';
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(parsed.pathname.slice(index + marker.length));
    return path.startsWith(`${userId}/`) ? path : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'moderator' | null>(null);
  const profileInFlightRef = useRef<string | null>(null);
  const lastProfileIdentityRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (id: string, email: string, metadata?: Record<string, any>, force = false) => {
    const identity = `${id}|${email}|${metadata?.account_type || 'resident'}|${metadata?.name || ''}`;
    if (!force && (profileInFlightRef.current === identity || lastProfileIdentityRef.current === identity)) return;
    profileInFlightRef.current = identity;
    const roleRequest = Promise.resolve(supabase
      .from('app_roles')
      .select('role')
      .eq('user_id', id)
      .maybeSingle());

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, avatar_url, reputation, created_at')
        .eq('id', id)
        .maybeSingle();

      if (data && !error) {
        const { data: roleData } = await roleRequest;
        lastProfileIdentityRef.current = identity;
        profileInFlightRef.current = null;
        setRole(roleData?.role === 'admin' || roleData?.role === 'moderator' ? roleData.role : null);
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

      attempts += 1;
      if (attempts < maxAttempts) await new Promise((res) => setTimeout(res, 600 * attempts));
    }

    lastProfileIdentityRef.current = identity;
    profileInFlightRef.current = null;
    const { data: roleData } = await roleRequest;
    setRole(roleData?.role === 'admin' || roleData?.role === 'moderator' ? roleData.role : null);
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
    let active = true;

    const loadInitial = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session?.user) return;
      await fetchProfile(session.user.id, session.user.email || '', session.user.user_metadata);
    };
    void loadInitial();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (!session?.user) {
        if (event === 'SIGNED_OUT') {
          lastProfileIdentityRef.current = null;
          profileInFlightRef.current = null;
        }
        setRole(null);
        setUser(null);
        return;
      }

      if (event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY') return;
      void fetchProfile(session.user.id, session.user.email || '', session.user.user_metadata);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
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
        await fetchProfile(data.user.id, email, data.user.user_metadata, true);
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
      await fetchProfile(data.user.id, data.user.email || email, data.user.user_metadata, true);
      return { ok: true };
    }
    return { ok: false, error: 'Login falhou.' };
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    await disconnectPushOnLogout();
    await supabase.auth.signOut();
    lastProfileIdentityRef.current = null;
    profileInFlightRef.current = null;
    setRole(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: { name?: string; avatarUrl?: string }): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Não autenticado.' };

    const nextName = data.name?.trim();
    const currentAvatar = user.avatarUrl || '';
    const avatarInput = data.avatarUrl;
    const nameChanged = nextName !== undefined && nextName !== user.name;
    const avatarChanged = avatarInput !== undefined && avatarInput !== currentAvatar;

    if (!nameChanged && !avatarChanged) {
      return {
        ok: false,
        error: 'Nenhuma alteração foi aplicada. Se escolheu uma nova foto, finalize o recorte em “Usar foto” antes de tocar em “Salvar”.',
      };
    }

    let storedAvatarUrl: string | null | undefined;
    let newAvatarPath: string | null = null;
    const oldAvatarPath = avatarStoragePath(user.avatarUrl, user.id);

    if (avatarChanged) {
      if (!avatarInput) {
        storedAvatarUrl = null;
      } else if (avatarInput.startsWith('data:image/')) {
        const blob = dataUrlToBlob(avatarInput);
        if (!blob) return { ok: false, error: 'Não foi possível processar a foto recortada.' };

        newAvatarPath = `${user.id}/avatar-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(newAvatarPath, blob, {
            contentType: 'image/jpeg',
            upsert: false,
            cacheControl: '31536000',
          });

        if (uploadError) return { ok: false, error: `Não foi possível salvar a foto: ${uploadError.message}` };

        const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(newAvatarPath);
        storedAvatarUrl = publicData.publicUrl;
      } else {
        storedAvatarUrl = avatarInput;
      }
    }

    const updates: { name?: string; avatar_url?: string | null; updated_at: string } = { updated_at: new Date().toISOString() };
    if (nameChanged && nextName !== undefined) updates.name = nextName;
    if (avatarChanged) updates.avatar_url = storedAvatarUrl ?? null;

    const { data: saved, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select('id, name, avatar_url, reputation, created_at')
      .single();

    if (error || !saved) {
      if (newAvatarPath) {
        try { await supabase.storage.from('avatars').remove([newAvatarPath]); } catch {}
      }
      return { ok: false, error: error?.message || 'Não foi possível salvar o perfil.' };
    }

    if (avatarChanged && oldAvatarPath && oldAvatarPath !== newAvatarPath) {
      try { await supabase.storage.from('avatars').remove([oldAvatarPath]); } catch {}
    }

    setUser((prev) => prev ? {
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
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isAdmin: role === 'admin', canModerate: role === 'admin' || role === 'moderator', login, register, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
