import { type ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { cn } from '../utils/cn';
import {
  MapPin, Sun, Moon, LogOut, LayoutGrid, Store,
  CalendarDays, ShieldAlert, UserCircle, ArrowUp, Heart, Bell, MessageSquare, X,
} from 'lucide-react';
import { timeAgo } from './UI';

const navItems = [
  { path: '/', label: 'Feed', icon: LayoutGrid },
  { path: '/guia', label: 'Guia', icon: Store },
  { path: '/mural', label: 'Mural', icon: CalendarDays },
  { path: '/denuncias', label: 'Denúncias', icon: ShieldAlert },
  { path: '/perfil', label: 'Perfil', icon: UserCircle },
];

function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-28 md:bottom-8 left-6 z-30 w-11 h-11 bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 rounded-xl shadow-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:ring-emerald-300 dark:hover:ring-emerald-500/30 transition-all duration-200 active:scale-95 animate-scale-in"
      aria-label="Voltar ao topo">
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}

function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const { notifications, unreadCount, markNotificationsAsRead, deleteAllNotifications } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  if (!isAuthenticated) return null;

  return (
    <div className="relative">
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) markNotificationsAsRead(); }}
        className={cn(
          "p-2.5 rounded-xl transition-all duration-200 relative",
          isOpen ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800"
        )}
        aria-label="Notificações"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800 z-50 overflow-hidden flex flex-col animate-scale-in origin-top-right">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notificações</h3>
                {notifications.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); if(confirm('Deseja apagar todas as notificações?')) deleteAllNotifications(); }}
                    className="text-[10px] font-bold text-red-500 hover:text-red-600 dark:hover:text-red-400 uppercase tracking-wider transition-colors"
                  >
                    Apagar tudo
                  </button>
                )}
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 no-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Nenhuma notificação por enquanto.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/');
                        setTimeout(() => {
                          const element = document.getElementById(`post-${n.postId}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            element.classList.add('ring-2', 'ring-emerald-500', 'ring-offset-2');
                            setTimeout(() => element.classList.remove('ring-2', 'ring-emerald-500', 'ring-offset-2'), 3000);
                          }
                        }, 100);
                      }}
                      className={cn(
                        "w-full p-4 flex gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group",
                        !n.isRead && "bg-emerald-50/30 dark:bg-emerald-500/5"
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        {n.actorAvatarUrl ? (
                          <img src={n.actorAvatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-slate-400">{n.actorName?.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                          <span className="font-bold text-slate-900 dark:text-white">{n.actorName}</span>
                          {n.type === 'support' ? ' apoiou seu relato: ' : ' comentou no seu relato: '}
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">"{n.postTitle}"</span>
                        </p>
                        {n.content && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic line-clamp-2">
                            "{n.content}"
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          {n.type === 'support' ? (
                            <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                          ) : (
                            <MessageSquare className="w-3 h-3 text-emerald-500" />
                          )}
                          <span className="text-[10px] text-slate-400">{timeAgo(n.createdAt)}</span>
                        </div>
                      </div>
                      {!n.isRead && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-center">
              <button onClick={() => { navigate('/perfil'); setIsOpen(false); }} className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                Ver todas as atividades
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface LayoutProps { children: ReactNode }

export default function Layout({ children }: LayoutProps) {
  const { isDark, toggle } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <a href="#main-content" className="skip-link">Pular para o conteúdo</a>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors duration-300" role="banner">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <button onClick={() => navigate('/')} className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg p-1 -m-1" aria-label="Ir para a página inicial">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-600/20 group-hover:shadow-emerald-600/40 transition-shadow duration-300">
                <MapPin className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[15px] font-bold text-slate-900 dark:text-white leading-tight tracking-tight">No Meu Bairro</span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 leading-tight tracking-widest uppercase">Vitória Régia</span>
              </div>
            </button>
            <nav className="hidden md:flex items-center gap-1" role="navigation" aria-label="Navegação principal">
              {navItems.map((item) => {
                const Icon = item.icon; const active = isActive(item.path);
                return (
                  <button key={item.path} onClick={() => navigate(item.path)}
                    className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                      active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800')}
                    aria-current={active ? 'page' : undefined}>
                    <Icon className="w-4 h-4" /><span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="flex items-center gap-1.5">
              <button onClick={toggle} className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-all duration-200"
                aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}>
                {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
              </button>
              <NotificationBell />
              {isAuthenticated && user ? (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => navigate('/perfil')}
                    className="w-9 h-9 rounded-xl overflow-hidden bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-sm font-bold hover:bg-emerald-200 dark:hover:bg-emerald-500/25 transition-colors"
                    aria-label={`Perfil de ${user.name}`}>
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : user.name.charAt(0).toUpperCase()}
                  </button>
                  <button onClick={logout} className="hidden md:flex p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-all duration-200" aria-label="Sair" title="Sair">
                    <LogOut className="w-[18px] h-[18px]" />
                  </button>
                </div>
              ) : (
                <button onClick={() => navigate('/login')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm shadow-emerald-600/20 active:scale-[0.98]">
                  <UserCircle className="w-4 h-4" /><span className="hidden sm:inline">Entrar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 pb-24 md:pb-0" id="main-content" role="main">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</div>

        {/* Footer */}
        <footer className="mt-8 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-300">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div className="grid sm:grid-cols-3 gap-8">
              {/* Brand */}
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">No Meu Bairro</p>
                    <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Vitória Régia</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
                  Plataforma comunitária criada para conectar moradores, resolver problemas e fortalecer o bairro Vitória Régia em Curitiba.
                </p>
              </div>
              {/* Links */}
              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Navegação</h4>
                <ul className="space-y-2">
                  {navItems.map(item => (
                    <li key={item.path}>
                      <button onClick={() => navigate(item.path)} className="text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Info */}
              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Apoio</h4>
                <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                  <li className="flex items-center gap-2">
                    <a href="tel:190" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Polícia Militar: 190</a>
                  </li>
                  <li className="flex items-center gap-2">
                    <a href="tel:180" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Mulher: 180</a>
                  </li>
                  <li className="flex items-center gap-2">
                    <a href="tel:192" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">SAMU: 192</a>
                  </li>
                  <li className="flex items-center gap-2">
                    <a href="tel:100" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Direitos Humanos: 100</a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                © {new Date().getFullYear()} No Meu Bairro — Vitória Régia, Curitiba. Todos os direitos reservados.
              </p>
              <p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                Feito com <Heart className="w-3 h-3 text-red-400 inline fill-current" /> pelo 2°DS
              </p>
            </div>
          </div>
        </footer>
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 safe-area-bottom transition-colors duration-300" role="navigation" aria-label="Navegação mobile">
        <div className="flex items-center justify-around h-[68px] px-2 max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon; const active = isActive(item.path);
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={cn('flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 min-w-[56px]',
                  active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500')}
                aria-current={active ? 'page' : undefined}>
                <Icon className={cn('transition-transform duration-200', active && 'scale-110')} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-semibold leading-none">{item.label}</span>
                {active && <div className="absolute bottom-2 w-1 h-1 rounded-full bg-emerald-500 dark:bg-emerald-400" />}
              </button>
            );
          })}
        </div>
      </nav>

      <ScrollToTop />
    </div>
  );
}
