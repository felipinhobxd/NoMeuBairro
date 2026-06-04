import { type ReactNode, useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useNeighborhood, curitibaNeighborhoods } from '../contexts/NeighborhoodContext';
import { cn } from '../utils/cn';
import {
  MapPin, Sun, Moon, LogOut, LayoutGrid, Store,
  CalendarDays, ShieldAlert, UserCircle, ArrowUp, Heart, Bell, MessageSquare, X, Map as MapIconIcon,
  BarChart3, ShieldCheck, Search, ChevronRight, Building2, Sparkles, MapPinned
} from 'lucide-react';
import { timeAgo, Button, Card, Input, useToast } from './UI';

const navItems = [
  { path: '/', label: 'Feed', icon: LayoutGrid },
  { path: '/mapa', label: 'Mapa', icon: MapIconIcon },
  { path: '/estatisticas', label: 'Dados', icon: BarChart3 },
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

function NeighborhoodPicker() {
  const { setNeighborhood, setNeighborhoodByCep } = useNeighborhood();
  const { posts } = useData();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [cepInput, setCepInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const neighborhoodCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach(p => {
      const loc = normalize(p.location || '');
      curitibaNeighborhoods.forEach(n => {
        const nName = normalize(n.name);
        if (loc.includes(nName)) {
          counts[n.name] = (counts[n.name] || 0) + 1;
        }
      });
    });
    return counts;
  }, [posts]);

  const filteredNeighborhoods = useMemo(() => {
    return curitibaNeighborhoods.filter(n =>
      n.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
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
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col !p-0 shadow-2xl border-none ring-1 ring-white/10 dark:ring-emerald-500/20">
        <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-emerald-600 to-teal-700 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2 flex items-center gap-3">
              <MapPinned className="w-8 h-8" />
              Bem-vindo ao No Meu Bairro
            </h2>
            <p className="text-emerald-50/80 text-sm sm:text-base font-medium max-w-xl">
              Para começar, selecione seu bairro ou digite seu CEP. Vamos conectar você com o que acontece ao seu redor. 🌿
            </p>
          </div>
          <Sparkles className="absolute -right-4 -top-4 w-32 h-32 text-white/10 rotate-12" />
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-4 border-b border-slate-100 dark:border-slate-800">
          <form onSubmit={handleCepSearch} className="flex-1 flex gap-2">
            <Input
              placeholder="Digite seu CEP (ex: 81460296)"
              value={cepInput}
              onChange={e => setCepInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="flex-1 !bg-white dark:!bg-slate-800"
            />
            <Button type="submit" disabled={isSearching || cepInput.length !== 8}>
              {isSearching ? '...' : 'Buscar'}
            </Button>
          </form>
          <div className="hidden sm:block w-px bg-slate-200 dark:bg-slate-800" />
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar bairro pelo nome..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 no-scrollbar bg-white dark:bg-slate-900">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredNeighborhoods.map((n) => {
              const count = neighborhoodCounts[n.name] || 0;
              return (
                <button
                  key={n.name}
                  onClick={() => setNeighborhood(n.name)}
                  className="group p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800/50 dark:hover:bg-emerald-500/10 border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-500/30 text-left transition-all duration-200 active:scale-[0.97] flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                      {n.name}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  {count > 0 && (
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-lg w-fit">
                      {count} {count === 1 ? 'RELATO' : 'RELATOS'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {filteredNeighborhoods.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Nenhum bairro encontrado com "{searchTerm}"</p>
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
  const { user, isAuthenticated, logout } = useAuth();
  const { currentNeighborhood, isNeighborhoodSelected, clearSelection } = useNeighborhood();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.id === '9c90d435-bfe2-4936-98d1-2c6c1160db4b';

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Atualiza o título da aba do navegador dinamicamente
    if (currentNeighborhood) {
      document.title = `No Meu Bairro — ${currentNeighborhood.name}`;
    } else {
      document.title = "No Meu Bairro";
    }
  }, [location.pathname, currentNeighborhood]);

  // Se o bairro NÃO foi selecionado, mostra APENAS o seletor de bairro
  if (!isNeighborhoodSelected) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
         <NeighborhoodPicker />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <a href="#main-content" className="skip-link">Pular para o conteúdo</a>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors duration-300" role="banner">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg p-1 -m-1" aria-label="Ir para a página inicial">
                <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-emerald-600/20 group-hover:shadow-emerald-600/40 transition-shadow duration-300">
                  <img src="/logo.png" alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col items-start hidden lg:flex">
                  <span className="text-[14px] font-bold text-slate-900 dark:text-white leading-tight tracking-tight">No Meu Bairro</span>
                </div>
              </button>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

              <button
                onClick={clearSelection}
                className="flex items-center gap-2 group hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-xl transition-all"
                title="Mudar de bairro"
              >
                <div className="flex flex-col items-start">
                  <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 leading-tight tracking-widest uppercase">Bairro</span>
                  <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200 leading-tight truncate max-w-[80px] xl:max-w-none">{currentNeighborhood.name}</span>
                </div>
                <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
              </button>
            </div>

            <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 flex-1 justify-center min-w-0" role="navigation" aria-label="Navegação principal">
              {navItems.map((item) => {
                const Icon = item.icon; const active = isActive(item.path);
                return (
                  <button key={item.path} onClick={() => navigate(item.path)}
                    className={cn('flex items-center gap-1.5 px-2 lg:px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 shrink-0',
                      active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800')}
                    aria-current={active ? 'page' : undefined}>
                    <Icon className="w-4 h-4" />
                    <span className="hidden xl:inline">{item.label}</span>
                  </button>
                );
              })}
              {isAdmin && (
                <button onClick={() => navigate('/admin')}
                  className={cn('flex items-center gap-1.5 px-2 lg:px-3 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 shrink-0',
                    location.pathname === '/admin' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                      : 'bg-indigo-600/5 text-indigo-600 hover:bg-indigo-600/10 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20')}
                >
                  <ShieldCheck className="w-4 h-4" /><span className="hidden lg:inline">Painel Admin</span>
                </button>
              )}
            </nav>

            <div className="flex items-center gap-1 lg:gap-2 shrink-0">
              <button onClick={toggle} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-all duration-200"
                aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}>
                {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
              </button>
              <NotificationBell />
              {isAuthenticated && user ? (
                <div className="flex items-center gap-1.5 lg:gap-2">
                  <button onClick={() => navigate('/perfil')}
                    className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl overflow-hidden bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-sm font-bold hover:bg-emerald-200 dark:hover:bg-emerald-500/25 transition-colors"
                    aria-label={`Perfil de ${user.name}`}>
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : user.name.charAt(0).toUpperCase()}
                  </button>
                  <button onClick={logout} className="hidden lg:flex p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-all duration-200" aria-label="Sair" title="Sair">
                    <LogOut className="w-[18px] h-[18px]" />
                  </button>
                </div>
              ) : (
                <button onClick={() => navigate('/login')} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[13px] font-semibold transition-all duration-200 shadow-sm shadow-emerald-600/20 active:scale-[0.98]">
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
                  <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
                    <img src="/logo.png" alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">No Meu Bairro</p>
                    <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{currentNeighborhood.name}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
                  Plataforma comunitária criada para conectar moradores, resolver problemas e fortalecer o bairro {currentNeighborhood.name} em Curitiba.
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
                © {new Date().getFullYear()} No Meu Bairro — {currentNeighborhood.name}, Curitiba. Todos os direitos reservados.
              </p>
              <p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                Feito com <Heart className="w-3 h-3 text-red-400 inline fill-current" /> pelo 2°DS
              </p>
            </div>
          </div>
        </footer>
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 safe-area-bottom shadow-[0_-8px_30px_rgb(0,0,0,0.04)] transition-colors duration-300" role="navigation" aria-label="Navegação mobile">
        <div className="flex items-center justify-around h-[72px] px-2 w-full">
          {navItems.map((item) => {
            const Icon = item.icon; const active = isActive(item.path);
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={cn('flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-2xl transition-all duration-300 flex-1 relative active:scale-90',
                  active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500')}
                aria-current={active ? 'page' : undefined}>
                <div className={cn(
                  "p-2 rounded-xl transition-all duration-300",
                  active && "bg-emerald-50 dark:bg-emerald-500/10 scale-110 shadow-sm"
                )}>
                  <Icon className={cn('w-5 h-5 transition-transform duration-300')} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className={cn("text-[10px] font-bold tracking-tight transition-all", active ? "opacity-100 translate-y-0" : "opacity-80")}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <ScrollToTop />
    </div>
  );
}
