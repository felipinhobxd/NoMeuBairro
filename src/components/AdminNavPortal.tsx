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
  const [mobileHeaderTarget, setMobileHeaderTarget] = useState<HTMLElement | null>(null);

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
      const desktopNav = document.querySelector<HTMLElement>('header nav[aria-label="Navegação principal"]');
      const themeButton = document.querySelector<HTMLButtonElement>('header button[aria-label^="Ativar modo"]');
      setDesktopTarget(desktopNav);
      setMobileHeaderTarget(themeButton?.parentElement ?? null);

      // Em larguras intermediárias os rótulos ocupavam espaço demais quando Admin existia.
      // Mantemos o texto no DOM para acessibilidade e fornecemos tooltip para cada item.
      desktopNav?.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        const label = (button.textContent || '').replace(/\s+/g, ' ').trim();
        if (label && !button.title) button.title = label;
      });
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
      className={`nmb-admin-nav hidden md:flex items-center justify-center gap-1.5 min-h-10 px-2.5 2xl:px-3 rounded-xl text-[13px] font-bold transition-all duration-200 shrink-0 ${
        active
          ? 'bg-orange-600 text-white shadow-sm'
          : 'text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/10'
      }`}
      aria-current={active ? 'page' : undefined}
      aria-label="Administração"
      title="Administração"
    >
      <ShieldCheck className="w-4 h-4 shrink-0" />
      <span className="nmb-admin-nav-label">Admin</span>
    </button>
  );

  const mobileButton = (
    <button
      type="button"
      onClick={() => navigate('/admin')}
      className={`nmb-admin-mobile md:hidden p-2 rounded-xl transition-all duration-200 ${
        active
          ? 'bg-orange-600 text-white shadow-sm'
          : 'text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/10'
      }`}
      aria-current={active ? 'page' : undefined}
      aria-label="Administração"
      title="Administração"
    >
      <ShieldCheck className="w-[18px] h-[18px]" strokeWidth={active ? 2.5 : 2} />
    </button>
  );

  return (
    <>
      {desktopTarget ? createPortal(desktopButton, desktopTarget) : null}
      {mobileHeaderTarget ? createPortal(mobileButton, mobileHeaderTarget) : null}
    </>
  );
}
