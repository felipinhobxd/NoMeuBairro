import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';

export default function AdminNavPortal() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [desktopTarget, setDesktopTarget] = useState<HTMLElement | null>(null);
  const [mobileTarget, setMobileTarget] = useState<HTMLElement | null>(null);

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

  useEffect(() => {
    const syncTargets = () => {
      setDesktopTarget(document.querySelector<HTMLElement>('header nav[aria-label="Navegação principal"]'));
      setMobileTarget(document.querySelector<HTMLElement>('nav[aria-label="Navegação mobile"] > div'));
    };

    syncTargets();
    const observer = new MutationObserver(syncTargets);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!isAdmin) return null;

  const active = location.pathname.startsWith('/admin');

  const desktopButton = (
    <button
      type="button"
      onClick={() => navigate('/admin')}
      className={`flex items-center gap-1.5 px-2 lg:px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 shrink-0 ${
        active
          ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300'
          : 'text-orange-700 hover:text-orange-800 hover:bg-orange-50 dark:text-orange-300 dark:hover:bg-orange-500/10'
      }`}
      aria-current={active ? 'page' : undefined}
      title="Área administrativa"
    >
      <ShieldCheck className="w-4 h-4" />
      <span className="hidden xl:inline">Admin</span>
    </button>
  );

  const mobileButton = (
    <button
      type="button"
      onClick={() => navigate('/admin')}
      className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-2xl transition-all duration-300 flex-1 relative active:scale-90 ${
        active ? 'text-orange-600 dark:text-orange-300' : 'text-orange-500 dark:text-orange-400'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <div className={`p-2 rounded-xl transition-all duration-300 ${active ? 'bg-orange-50 dark:bg-orange-500/10 scale-110 shadow-sm' : ''}`}>
        <ShieldCheck className="w-5 h-5 transition-transform duration-300" strokeWidth={active ? 2.5 : 2} />
      </div>
      <span className="text-[10px] font-bold tracking-tight transition-all">Admin</span>
    </button>
  );

  return (
    <>
      {desktopTarget ? createPortal(desktopButton, desktopTarget) : null}
      {mobileTarget ? createPortal(mobileButton, mobileTarget) : null}
    </>
  );
}
