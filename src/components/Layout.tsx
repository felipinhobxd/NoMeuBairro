import { type ReactNode, useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { fontSizeLabels, useFontSize } from '../contexts/FontSizeContext';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import {
  useNeighborhood, curitibaNeighborhoods, neighborhoodSearchText,
  findNeighborhood, normalizeNeighborhoodText,
} from '../contexts/NeighborhoodContext';
import { supabase } from '../utils/supabase';
import { cn } from '../utils/cn';
import {
  MapPin, Sun, Moon, LogOut, LayoutGrid, Briefcase,
  CalendarDays, ShieldAlert, UserCircle, ArrowUp, Heart, Bell, MessageSquare, X, Map as MapIconIcon,
  BarChart3, Search, ChevronRight, Building2, Sparkles, MapPinned, Reply, CheckCircle2, Eye, PhoneCall, CalendarCheck,
  ShieldCheck, MoreHorizontal, Download, Bookmark,
  ALargeSmall,
} from 'lucide-react';
import { timeAgo, Button, Card, Input, useToast } from './UI';
import type { AppNotification } from '../types';
import { notificationDestination, notificationMessage, notificationTargetTitle } from '../utils/notificationActivity';

const navItems = [
  { path: '/', label: 'Feed', icon: LayoutGrid },
  { path: '/mapa', label: 'Mapa', icon: MapIconIcon },
  { path: '/estatisticas', label: 'Dados', icon: BarChart3 },
  { path: '/empregos', label: 'Empregos', icon: Briefcase },
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
      className="fixed bottom-24 sm:bottom-28 lg:bottom-8 left-4 sm:left-6 z-30 w-11 h-11 bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 rounded-xl shadow-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:ring-emerald-300 dark:hover:ring-emerald-500/30 transition-all duration-200 active:scale-95 animate-scale-in"
      aria-label="Voltar ao topo">
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}

function NotificationActivityIcon({ notification }: { notification: AppNotification }) {
  switch (notification.type) {
    case 'support': return <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />;
    case 'comment': return <MessageSquare className="w-3.5 h-3.5 text-orange-600" />;
    case 'reply': return <Reply className="w-3.5 h-3.5 text-violet-600" />;
    case 'post_resolved': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    case 'job_interest': return <Briefcase className="w-3.5 h-3.5 text-blue-600" />;
    case 'application_viewed': return <Eye className="w-3.5 h-3.5 text-sky-600" />;
    case 'application_contacted': return <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />;
    case 'event_attendance': return <CalendarCheck className="w-3.5 h-3.5 text-purple-600" />;
    default: return <Bell className="w-3.5 h-3.5 text-slate-500" />;
  }
}

function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const { notifications, unreadCount, markNotificationAsRead, deleteAllNotifications } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  if (!isAuthenticated) return null;

  const openNotification = async (notification: AppNotification) => {
    await markNotificationAsRead(notification.id);
    setIsOpen(false);
    navigate(notificationDestination(notification));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          'p-2.5 rounded-xl transition-all duration-200 relative',
          isOpen ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800',
        )}
        aria-label="Notificações"
        aria-expanded={isOpen}
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-[440px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800 z-50 overflow-hidden flex flex-col animate-scale-in origin-top-right">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notificações</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{unreadCount > 0 ? `${unreadCount} nova${unreadCount === 1 ? '' : 's'}` : 'Tudo em dia'}</p>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm('Deseja apagar todas as notificações?')) void deleteAllNotifications(); }}
                    className="text-[10px] font-bold text-red-600 hover:text-red-700 dark:text-red-400 uppercase tracking-wider transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    Apagar tudo
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors" aria-label="Fechar notificações">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 no-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nenhuma notificação</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Novas atividades aparecerão aqui.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {notifications.slice(0, 12).map((n) => {
                    const targetTitle = notificationTargetTitle(n);
                    return (
                      <button
                        key={n.id}
                        onClick={() => void openNotification(n)}
                        className={cn(
                          'w-full p-4 flex gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group',
                          !n.isRead && 'bg-orange-50/70 dark:bg-orange-500/5',
                        )}
                      >
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          {n.actorAvatarUrl ? (
                            <img src={n.actorAvatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <NotificationActivityIcon notification={n} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">{notificationMessage(n)}</p>
                          {targetTitle && <p className="text-[11px] font-semibold text-orange-800 dark:text-orange-300 mt-1 line-clamp-1">“{targetTitle}”</p>}
                          {n.content && <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">“{n.content}”</p>}
                          <div className="flex items-center gap-2 mt-1.5">
                            <NotificationActivityIcon notification={n} />
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{timeAgo(n.createdAt)}</span>
                          </div>
                        </div>
                        {!n.isRead && <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-center">
              <button onClick={() => { navigate('/notificacoes'); setIsOpen(false); }} className="text-xs font-bold text-orange-700 dark:text-orange-300 hover:underline underline-offset-2">
                Ver todas as notificações
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NeighborhoodPicker() {
  const { setNeighborhood, setNeighborhoodByCep, selectAllNeighborhoods } = useNeighborhood();
  const { posts } = useData();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [cepInput, setCepInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [serverCounts, setServerCounts] = useState<Record<string, number>>({});
  const [countsLoaded, setCountsLoaded] = useState(false);

  const localCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((post) => {
      const primaryArea = post.locality || post.neighborhood;
      const found = findNeighborhood(primaryArea);
      if (found) counts[found.name] = (counts[found.name] || 0) + 1;
    });
    return counts;
  }, [posts]);

  useEffect(() => {
    let active = true;
    void Promise.resolve(supabase.rpc('get_neighborhood_post_counts')).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.warn('Não foi possível carregar as contagens completas por bairro:', error);
        setCountsLoaded(true);
        return;
      }
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        const found = findNeighborhood(row.area);
        const key = found?.name || String(row.area || '');
        if (key) counts[key] = Number(row.total || 0);
      }
      setServerCounts(counts);
      setCountsLoaded(true);
    }).catch((error) => {
      console.warn('Não foi possível carregar as contagens completas por bairro:', error);
      if (active) setCountsLoaded(true);
    });
    return () => { active = false; };
  }, []);

  const neighborhoodCounts = countsLoaded ? serverCounts : localCounts;

  const filteredNeighborhoods = useMemo(() => {
    const q = normalizeNeighborhoodText(searchTerm);
    return curitibaNeighborhoods
      .filter((neighborhood) => !q || neighborhoodSearchText(neighborhood.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searchTerm]);

  const handleCepSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cepInput.length !== 8) return;
    setIsSearching(true);
    const ok = await setNeighborhoodByCep(cepInput);
    setIsSearching(false);
    if (!ok) toast('CEP não encontrado ou fora de Curitiba.', 'error');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in overflow-hidden">
      <Card className="w-full max-w-4xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col !p-0 shadow-2xl border-none ring-1 ring-white/10 dark:ring-emerald-500/20">
        <div className="p-5 sm:p-8 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-emerald-600 to-teal-700 text-white relative overflow-hidden shrink-0">
          <div className="relative z-10">
            <h2 className="text-xl sm:text-3xl font-black tracking-tight mb-2 flex items-center gap-2 sm:gap-3">
              <MapPinned className="w-6 h-6 sm:w-8 sm:h-8" />
              Escolher bairro
            </h2>
            <p className="text-emerald-50/90 text-xs sm:text-base font-medium max-w-xl leading-relaxed">
              Escolha um bairro somente quando quiser filtrar o feed e ver apenas os relatos daquela região. 🌿
            </p>
          </div>
          <Sparkles className="absolute -right-4 -top-4 w-24 h-24 sm:w-32 sm:h-32 text-white/10 rotate-12" />
        </div>

        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/50 flex flex-col lg:flex-row gap-3 sm:gap-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <form onSubmit={handleCepSearch} className="flex-1 flex gap-2">
            <Input
              placeholder="Digite seu CEP"
              value={cepInput}
              onChange={e => setCepInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="flex-1 !bg-white dark:!bg-slate-800 !py-2 sm:!py-2.5"
            />
            <Button type="submit" disabled={isSearching || cepInput.length !== 8} className="whitespace-nowrap">
              {isSearching ? '...' : 'Buscar CEP'}
            </Button>
          </form>
          <div className="hidden lg:block w-px bg-slate-200 dark:bg-slate-800" />
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar bairro, CIC ou localidade..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 no-scrollbar bg-white dark:bg-slate-900">
          <button
            onClick={selectAllNeighborhoods}
            className="w-full mb-3 group p-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/20 text-left transition-all"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="block text-sm font-black text-emerald-700 dark:text-emerald-400">Ver todos os bairros</span>
                <span className="block text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">Voltar ao feed completo de Curitiba</span>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-500" />
            </div>
          </button>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
            {filteredNeighborhoods.map((n) => {
              const count = neighborhoodCounts[n.name] || 0;
              return (
                <button
                  key={n.name}
                  onClick={() => setNeighborhood(n.name)}
                  className="group p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800/50 dark:hover:bg-emerald-500/10 border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-500/30 text-left transition-all duration-200 active:scale-[0.97] flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] sm:text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                      {n.name}
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  {n.aliases?.length ? <span className="text-[9px] text-slate-400 truncate">{n.aliases.join(' · ')}</span> : null}
                  <span className={cn(
                    'text-[9px] font-black px-1.5 py-0.5 rounded-lg w-fit',
                    count > 0
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-500/10'
                      : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800',
                  )}>
                    {count} {count === 1 ? 'RELATO' : 'RELATOS'}
                  </span>
                </button>
              );
            })}
          </div>
          {filteredNeighborhoods.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhum bairro com "{searchTerm}"</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

interface LayoutProps { children: ReactNode }

export default function Layout({ children }: LayoutProps) {
  const { isDark, toggle } = useTheme();
  const { fontSize, openFontSizePicker } = useFontSize();
  const { user, isAuthenticated, logout, isAdmin } = useAuth();
  const { currentNeighborhood, isNeighborhoodSelected, clearSelection } = useNeighborhood();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const desktopNavItems = useMemo(() => (
    isAdmin ? [...navItems, { path: '/admin', label: 'Admin', icon: ShieldCheck }] : navItems
  ), [isAdmin]);
  const mobilePrimaryNavItems = useMemo(() => navItems.filter(item => ['/', '/mapa', '/empregos', '/mural'].includes(item.path)), []);
  const mobileMoreActive = ['/estatisticas', '/denuncias', '/perfil', '/salvos', '/admin'].some(path => isActive(path));

  useEffect(() => { setMobileMoreOpen(false); }, [location.pathname]);

  const triggerHeaderAction = (ariaLabel: string) => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('header button')).find(
      item => item.getAttribute('aria-label') === ariaLabel,
    );
    button?.click();
    setMobileMoreOpen(false);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.title = currentNeighborhood.name ? `No Meu Bairro — ${currentNeighborhood.name}` : 'No Meu Bairro — Todos os bairros';
  }, [location.pathname, currentNeighborhood]);

  if (!isNeighborhoodSelected && !['/privacidade', '/termos'].includes(location.pathname)) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col"><NeighborhoodPicker /></div>;
  }

  const displayNeighborhood = currentNeighborhood.name || 'Todos os bairros';

  return (
    <div className="min-h-screen flex flex-col overflow-x-clip bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors duration-300" role="banner">
        <div className="max-w-[1680px] mx-auto px-2.5 sm:px-4 lg:px-5">
          <div className="nmb-header-row flex items-center justify-between h-16 gap-2 sm:gap-3">
            <div className="nmb-header-identity flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1 lg:flex-none">
              <button onClick={() => navigate('/')} className="nmb-header-home flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg p-1 -m-1" aria-label="Ir para a página inicial">
                <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-emerald-600/20 group-hover:shadow-emerald-600/40 transition-shadow duration-300"><img src="/logo.png" alt="" className="w-full h-full object-cover" /></div>
                <div className="flex flex-col items-start hidden lg:flex"><span className="text-[14px] font-bold text-slate-900 dark:text-white leading-tight tracking-tight">No Meu Bairro</span></div>
              </button>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden lg:block" />
              <button onClick={clearSelection} className="nmb-neighborhood-filter flex items-center gap-1.5 sm:gap-2 group hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-xl transition-all min-w-0" title="Escolher bairro para filtrar">
                <div className="flex flex-col items-start">
                  <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 leading-tight tracking-widest uppercase">Filtro</span>
                  <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200 leading-tight truncate max-w-[34vw] sm:max-w-[150px] xl:max-w-none">{displayNeighborhood}</span>
                </div>
                <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
              </button>
            </div>

            <nav className="nmb-desktop-nav hidden lg:flex items-center gap-0.5 lg:gap-1 flex-1 justify-center min-w-0" role="navigation" aria-label="Navegação principal">
              {desktopNavItems.map((item) => {
                const Icon = item.icon; const active = isActive(item.path);
                return (
                  <button key={item.path} onClick={() => navigate(item.path)} className={cn('flex items-center gap-1.5 px-2 lg:px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 shrink-0', active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800')} aria-label={item.label} aria-current={active ? 'page' : undefined}>
                    <Icon className="w-4 h-4" /><span className="hidden xl:inline">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="nmb-header-actions flex items-center gap-1 lg:gap-2 shrink-0">
              <button
                type="button"
                onClick={openFontSizePicker}
                className="nmb-header-font hidden sm:flex p-2 rounded-xl text-slate-500 hover:text-orange-700 hover:bg-orange-50 dark:text-slate-400 dark:hover:text-orange-300 dark:hover:bg-orange-500/10 transition-all duration-200"
                aria-label={`Alterar tamanho da fonte. Atual: ${fontSizeLabels[fontSize]}`}
                title={`Fonte: ${fontSizeLabels[fontSize]}`}
              >
                <ALargeSmall className="w-[18px] h-[18px]" />
              </button>
              <button onClick={toggle} className="nmb-header-theme p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-all duration-200" aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}>{isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}</button>
              <NotificationBell />
              {isAuthenticated && <button onClick={() => navigate('/salvos')} className={cn('p-2.5 rounded-xl transition-all duration-200', isActive('/salvos') ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800')} aria-label="Itens salvos" title="Itens salvos"><Bookmark className="w-[18px] h-[18px]" /></button>}
              {isAuthenticated && user ? (
                <div className="flex items-center gap-1.5 lg:gap-2">
                  <button onClick={() => navigate('/perfil')} className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl overflow-hidden bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-sm font-bold hover:bg-emerald-200 dark:hover:bg-emerald-500/25 transition-colors" aria-label={`Perfil de ${user.name}`}>{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : user.name.charAt(0).toUpperCase()}</button>
                  <button onClick={logout} className="hidden lg:flex p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-all duration-200" aria-label="Sair" title="Sair"><LogOut className="w-[18px] h-[18px]" /></button>
                </div>
              ) : (
                <button onClick={() => navigate('/login')} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[13px] font-semibold transition-all duration-200 shadow-sm shadow-emerald-600/20 active:scale-[0.98]"><UserCircle className="w-4 h-4" /><span className="hidden sm:inline">Entrar</span></button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24 lg:pb-0 overflow-x-clip" id="main-content" role="main" data-feed-view={location.pathname === '/' || undefined}>
        <div className="nmb-page-shell max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</div>
        <footer className="mt-8 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-300">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div className="grid sm:grid-cols-3 gap-8">
              <div>
                <div className="flex items-center gap-2.5 mb-3"><div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center"><img src="/logo.png" alt="" className="w-full h-full object-cover" /></div><div><p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">No Meu Bairro</p><p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{displayNeighborhood}</p></div></div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">Plataforma comunitária criada para conectar moradores, resolver problemas e fortalecer os bairros de Curitiba{currentNeighborhood.name ? ` — filtro: ${currentNeighborhood.name}` : ''}.</p>
              </div>
              <div><h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Navegação</h4><ul className="space-y-2">{navItems.map(item => <li key={item.path}><button onClick={() => navigate(item.path)} className="text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">{item.label}</button></li>)}</ul></div>
              <div><h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Apoio</h4><ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400"><li><a href="tel:190" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Polícia Militar: 190</a></li><li><a href="tel:180" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Mulher: 180</a></li><li><a href="tel:192" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">SAMU: 192</a></li><li><a href="tel:100" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Direitos Humanos: 100</a></li></ul></div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3"><p className="text-[11px] text-slate-400 dark:text-slate-500">© {new Date().getFullYear()} No Meu Bairro — Curitiba. Todos os direitos reservados.</p><p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">Feito com <Heart className="w-3 h-3 text-red-400 inline fill-current" /> pelo 2°DS</p></div>
          </div>
        </footer>
      </main>

      {mobileMoreOpen && (
        <div className="lg:hidden fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Mais opções">
          <button
            type="button"
            className="absolute inset-0 w-full h-full bg-slate-950/55 backdrop-blur-[2px]"
            onClick={() => setMobileMoreOpen(false)}
            aria-label="Fechar menu"
          />
          <section className="absolute bottom-0 left-0 right-0 max-h-[82dvh] overflow-y-auto rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-2xl safe-area-bottom animate-slide-up">
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 pt-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-3" />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center text-orange-700 dark:text-orange-300 font-bold shrink-0">
                    {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : (user?.name?.charAt(0).toUpperCase() || 'N')}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.name || 'No Meu Bairro'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{isAdmin ? 'Administrador' : displayNeighborhood}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setMobileMoreOpen(false)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar menu"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { path: '/estatisticas', label: 'Dados', icon: BarChart3 },
                  { path: '/denuncias', label: 'Denúncias', icon: ShieldAlert },
                  { path: '/perfil', label: 'Perfil', icon: UserCircle },
                  ...(isAuthenticated ? [{ path: '/salvos', label: 'Salvos', icon: Bookmark }] : []),
                  ...(isAdmin ? [{ path: '/admin', label: 'Admin', icon: ShieldCheck }] : []),
                ].map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => { navigate(item.path); setMobileMoreOpen(false); }}
                      className={cn(
                        'min-h-[58px] rounded-2xl border px-3 flex items-center gap-3 text-left font-bold transition-colors',
                        active
                          ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/25 text-orange-800 dark:text-orange-300'
                          : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200',
                      )}
                    >
                      <span className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shrink-0"><Icon className="w-4.5 h-4.5" /></span>
                      <span className="text-sm truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => triggerHeaderAction('Buscar no site')} className="min-h-[50px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 flex items-center gap-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200"><Search className="w-4.5 h-4.5" />Buscar</button>
                <button type="button" onClick={() => triggerHeaderAction('Instalar aplicativo')} className="min-h-[50px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 flex items-center gap-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200"><Download className="w-4.5 h-4.5" />Instalar app</button>
                <button type="button" onClick={() => { setMobileMoreOpen(false); openFontSizePicker(); }} className="min-h-[50px] rounded-xl border border-orange-200 dark:border-orange-500/25 bg-orange-50 dark:bg-orange-500/10 px-3 flex items-center gap-2.5 text-sm font-bold text-orange-800 dark:text-orange-300"><ALargeSmall className="w-4.5 h-4.5" />Fonte: {fontSizeLabels[fontSize]}</button>
                <button type="button" onClick={toggle} className="min-h-[50px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 flex items-center gap-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200">{isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}{isDark ? 'Modo claro' : 'Modo escuro'}</button>
                {isAuthenticated && user ? (
                  <button type="button" onClick={() => { setMobileMoreOpen(false); void logout(); }} className="min-h-[50px] rounded-xl border border-red-200 dark:border-red-500/25 bg-red-50 dark:bg-red-500/10 px-3 flex items-center gap-2.5 text-sm font-bold text-red-700 dark:text-red-300"><LogOut className="w-4.5 h-4.5" />Sair</button>
                ) : (
                  <button type="button" onClick={() => { navigate('/login'); setMobileMoreOpen(false); }} className="min-h-[50px] rounded-xl border border-orange-200 dark:border-orange-500/25 bg-orange-50 dark:bg-orange-500/10 px-3 flex items-center gap-2.5 text-sm font-bold text-orange-700 dark:text-orange-300"><UserCircle className="w-4.5 h-4.5" />Entrar</button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 safe-area-bottom shadow-[0_-8px_30px_rgb(0,0,0,0.04)] transition-colors duration-300" role="navigation" aria-label="Navegação mobile">
        <div className="grid grid-cols-5 items-stretch h-[68px] px-1.5 w-full max-w-xl mx-auto">
          {mobilePrimaryNavItems.map((item) => {
            const Icon = item.icon; const active = isActive(item.path);
            return (
              <button key={item.path} onClick={() => navigate(item.path)} className={cn('min-w-0 flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-2xl transition-all duration-200 relative active:scale-95', active ? 'text-orange-700 dark:text-orange-300' : 'text-slate-400 dark:text-slate-500')} aria-current={active ? 'page' : undefined}>
                <div className={cn('w-9 h-8 rounded-xl flex items-center justify-center transition-all duration-200', active && 'bg-orange-50 dark:bg-orange-500/10 shadow-sm')}><Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} /></div>
                <span className="text-[10px] leading-none font-bold tracking-tight truncate max-w-full">{item.label}</span>
              </button>
            );
          })}
          <button type="button" onClick={() => setMobileMoreOpen(true)} className={cn('min-w-0 flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-2xl transition-all duration-200 active:scale-95', mobileMoreActive ? 'text-orange-700 dark:text-orange-300' : 'text-slate-400 dark:text-slate-500')} aria-expanded={mobileMoreOpen} aria-label="Mais opções">
            <div className={cn('w-9 h-8 rounded-xl flex items-center justify-center transition-all duration-200 relative', mobileMoreActive && 'bg-orange-50 dark:bg-orange-500/10 shadow-sm')}>
              <MoreHorizontal className="w-5 h-5" />
              {isAdmin && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />}
            </div>
            <span className="text-[10px] leading-none font-bold tracking-tight">Mais</span>
          </button>
        </div>
      </nav>
      <ScrollToTop />
    </div>
  );
}
