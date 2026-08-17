from pathlib import Path

repo = Path('.')
layout = repo / 'src/components/Layout.tsx'
text = layout.read_text()

# Imports: add mobile/admin icons.
old = "  BarChart3, Search, ChevronRight, Building2, Sparkles, MapPinned, Reply, CheckCircle2, Eye, PhoneCall, CalendarCheck,\n} from 'lucide-react';"
new = "  BarChart3, Search, ChevronRight, Building2, Sparkles, MapPinned, Reply, CheckCircle2, Eye, PhoneCall, CalendarCheck,\n  ShieldCheck, MoreHorizontal, Download,\n} from 'lucide-react';"
if old not in text:
    raise SystemExit('Layout icon import anchor not found')
text = text.replace(old, new, 1)

# State and admin role lookup.
old = "  const navigate = useNavigate();\n  const location = useLocation();\n\n  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);"
new = """  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const desktopNavItems = useMemo(() => (
    isAdmin ? [...navItems, { path: '/admin', label: 'Admin', icon: ShieldCheck }] : navItems
  ), [isAdmin]);
  const mobilePrimaryNavItems = useMemo(() => navItems.filter(item => ['/', '/mapa', '/empregos', '/mural'].includes(item.path)), []);
  const mobileMoreActive = ['/estatisticas', '/denuncias', '/perfil', '/admin'].some(path => isActive(path));

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

  useEffect(() => { setMobileMoreOpen(false); }, [location.pathname]);

  const triggerHeaderAction = (ariaLabel: string) => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('header button')).find(
      item => item.getAttribute('aria-label') === ariaLabel,
    );
    button?.click();
    setMobileMoreOpen(false);
  };"""
if old not in text:
    raise SystemExit('Layout state anchor not found')
text = text.replace(old, new, 1)

# Root/header responsiveness.
text = text.replace(
    '<div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">',
    '<div className="min-h-screen flex flex-col overflow-x-clip bg-slate-50 dark:bg-slate-950 transition-colors duration-300">',
    1,
)
text = text.replace(
    '<div className="max-w-[1440px] mx-auto px-4 sm:px-6">',
    '<div className="max-w-[1680px] mx-auto px-2.5 sm:px-4 lg:px-5">',
    1,
)
text = text.replace(
    '<div className="flex items-center justify-between h-16 gap-4">',
    '<div className="flex items-center justify-between h-16 gap-2 sm:gap-3">',
    1,
)
text = text.replace(
    '<div className="flex items-center gap-3 shrink-0">',
    '<div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1 lg:flex-none">',
    1,
)
text = text.replace('hidden md:block', 'hidden lg:block', 1)
text = text.replace(
    'button onClick={clearSelection} className="flex items-center gap-2 group hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-xl transition-all"',
    'button onClick={clearSelection} className="nmb-neighborhood-filter flex items-center gap-1.5 sm:gap-2 group hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-xl transition-all min-w-0"',
    1,
)
text = text.replace(
    'truncate max-w-[140px] xl:max-w-none',
    'truncate max-w-[34vw] sm:max-w-[150px] xl:max-w-none',
    1,
)

# Desktop nav starts at lg and includes Admin natively.
text = text.replace(
    '<nav className="hidden md:flex items-center gap-0.5 lg:gap-1 flex-1 justify-center min-w-0"',
    '<nav className="hidden lg:flex items-center gap-0.5 lg:gap-1 flex-1 justify-center min-w-0"',
    1,
)
text = text.replace('{navItems.map((item) => {', '{desktopNavItems.map((item) => {', 1)

# Header actions: theme moves to More on phone/tablet, desktop logout remains.
text = text.replace(
    '<div className="flex items-center gap-1 lg:gap-2 shrink-0">',
    '<div className="nmb-header-actions flex items-center gap-1 lg:gap-2 shrink-0">',
    1,
)
text = text.replace(
    '<button onClick={toggle} className="p-2 rounded-xl',
    '<button onClick={toggle} className="nmb-header-theme p-2 rounded-xl',
    1,
)

# Main padding follows tablet/mobile nav breakpoint.
text = text.replace('className="flex-1 pb-24 md:pb-0"', 'className="flex-1 pb-24 lg:pb-0 overflow-x-clip"', 1)

# Replace old 7-item mobile nav with bottom sheet + 5-item primary nav.
old_start = '      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40'
start = text.find(old_start)
if start == -1:
    raise SystemExit('Old mobile nav start not found')
end_marker = '      <ScrollToTop />'
end = text.find(end_marker, start)
if end == -1:
    raise SystemExit('Mobile nav end marker not found')

replacement = r'''      {mobileMoreOpen && (
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
'''
text = text[:start] + replacement + text[end:]
layout.write_text(text)

# App: admin is now native in Layout; remove portal component.
app = repo / 'src/App.tsx'
text = app.read_text()
text = text.replace("import AdminNavPortal from './components/AdminNavPortal';\n", '', 1)
text = text.replace('                  <AdminNavPortal />\n', '', 1)
app.write_text(text)

# Product tour treats tablets as mobile because desktop nav begins at 1024px.
product = repo / 'src/components/ProductExperience.tsx'
text = product.read_text()
text = text.replace("window.matchMedia('(max-width: 767px)').matches", "window.matchMedia('(max-width: 1023px)').matches")
text = text.replace("window.matchMedia('(max-width: 767px)')", "window.matchMedia('(max-width: 1023px)')")
product.write_text(text)

# Responsive polish: phone/tablet header is intentionally sparse; secondary actions live in More.
polish = repo / 'src/components/DesktopUiPolish.tsx'
text = polish.read_text()
insert = r'''
      @media (max-width: 1023px) {
        header[role="banner"] > div {
          padding-left: 10px !important;
          padding-right: 10px !important;
        }

        header[role="banner"] > div > div {
          min-height: 62px !important;
          height: 62px !important;
          gap: 6px !important;
        }

        header[role="banner"] > div > div > div:first-child {
          min-width: 0;
          flex: 1 1 auto;
          gap: 4px !important;
        }

        header[role="banner"] button[aria-label="Ir para a página inicial"] {
          flex: 0 0 auto;
        }

        header[role="banner"] button[aria-label="Ir para a página inicial"] > div:first-child {
          width: 38px !important;
          height: 38px !important;
        }

        header[role="banner"] .nmb-neighborhood-filter {
          min-width: 0;
          max-width: min(43vw, 190px);
          padding: 5px 6px !important;
        }

        header[role="banner"] .nmb-neighborhood-filter > div {
          min-width: 0;
        }

        header[role="banner"] .nmb-neighborhood-filter span:last-child {
          max-width: 100% !important;
        }

        header[role="banner"] .nmb-header-actions {
          flex: 0 0 auto;
          gap: 2px !important;
        }

        /* No celular/tablet, ações secundárias ficam no menu Mais. */
        header[role="banner"] .nmb-header-theme,
        header[role="banner"] button[aria-label="Buscar no site"],
        header[role="banner"] button[aria-label="Instalar aplicativo"] {
          display: none !important;
        }

        header[role="banner"] .nmb-header-actions button[aria-label="Notificações"],
        header[role="banner"] .nmb-header-actions button[aria-label^="Perfil de"] {
          width: 40px !important;
          height: 40px !important;
          min-width: 40px !important;
          min-height: 40px !important;
          padding: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        main[role="main"] {
          overflow-x: clip;
        }

        main[role="main"] > div:first-child {
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        nav[aria-label="Navegação mobile"] button {
          min-height: 54px;
          touch-action: manipulation;
        }

        [aria-label="Camadas do mapa"],
        [aria-label="Categorias dos relatos"] {
          scroll-snap-type: x proximity;
          -webkit-overflow-scrolling: touch;
        }

        [aria-label="Camadas do mapa"] > button,
        [aria-label="Categorias dos relatos"] > button {
          scroll-snap-align: start;
        }
      }

      @media (max-width: 380px) {
        header[role="banner"] > div {
          padding-left: 7px !important;
          padding-right: 7px !important;
        }

        header[role="banner"] button[aria-label="Ir para a página inicial"] > div:first-child {
          width: 34px !important;
          height: 34px !important;
        }

        header[role="banner"] .nmb-neighborhood-filter {
          max-width: 38vw;
        }

        header[role="banner"] .nmb-neighborhood-filter span:first-child {
          display: none;
        }

        header[role="banner"] .nmb-header-actions button[aria-label="Notificações"],
        header[role="banner"] .nmb-header-actions button[aria-label^="Perfil de"] {
          width: 36px !important;
          height: 36px !important;
          min-width: 36px !important;
          min-height: 36px !important;
        }
      }
'''
needle = '      @media (min-width: 768px) {'
if needle not in text:
    raise SystemExit('DesktopUiPolish insertion anchor not found')
text = text.replace(needle, insert + '\n' + needle, 1)
polish.write_text(text)

# Old portal is no longer needed and was a source of layout contention.
portal = repo / 'src/components/AdminNavPortal.tsx'
if portal.exists():
    portal.unlink()
