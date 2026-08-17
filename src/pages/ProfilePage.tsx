import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Profile from './Profile';
import ProfileActivity from '../components/ProfileActivity';
import ModerationPanel from '../components/ModerationPanel';
import { Button, Card } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';

export default function ProfilePage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    if (!isAuthenticated || !user?.id) {
      setIsAdmin(false);
      return () => { active = false; };
    }

    void supabase
      .from('app_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setIsAdmin(!error && data?.role === 'admin');
      });

    return () => { active = false; };
  }, [isAuthenticated, user?.id]);

  return (
    <div className="space-y-6">
      <Profile />
      {isAuthenticated && user && (
        <div className="max-w-2xl mx-auto animate-fade-in space-y-6">
          {isAdmin && (
            <Card className="!border-emerald-200 dark:!border-emerald-500/20 !bg-emerald-50/60 dark:!bg-emerald-500/5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-600/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Administrador</p>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">Conta com acesso administrativo</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Você pode analisar denúncias e decidir se o conteúdo deve ser mantido ou excluído.</p>
                </div>
                <Button onClick={() => navigate('/admin')} className="shrink-0">
                  <ShieldCheck className="w-4 h-4" /> Abrir painel
                </Button>
              </div>
            </Card>
          )}
          <ModerationPanel />
          <ProfileActivity userId={user.id} accountType={user.accountType} />
        </div>
      )}
    </div>
  );
}
