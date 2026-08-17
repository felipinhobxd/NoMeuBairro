import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3, Briefcase, CalendarDays, CheckCircle2, Download, FileText, LayoutGrid,
  Map as MapIcon, MapPin, MessageSquare, Search, ShieldCheck, Sparkles, UserCircle, X,
} from 'lucide-react';
import { curitibaNeighborhoods, neighborhoodSearchText, useNeighborhood } from '../contexts/NeighborhoodContext';
import { supabase } from '../utils/supabase';

type SearchResult = {
  result_type: 'post' | 'event' | 'job' | 'neighborhood' | string;
  id: string;
  title: string;
  subtitle: string;
  description: string;
  path: string;
  created_at?: string | null;
  score: number;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type OnboardingStep = {
  title: string;
  description: string;
  when: string;
  icon: LucideIcon;
  accent: string;
  detail?: string;
};

const ONBOARDING_KEY = 'nmb-onboarding-v2';
const INSTALL_DISMISS_KEY = 'nmb-pwa-install-dismissed-at';
const INSTALL_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

const onboardingSteps: OnboardingStep[] = [
  {
    title: 'Tudo do seu bairro em um só lugar',
    description: 'O No Meu Bairro organiza relatos, mapa, dados, vagas e eventos para você entender rapidamente o que está acontecendo perto de casa.',
    when: 'Comece pelo Feed e use as outras áreas quando precisar aprofundar.',
    icon: Sparkles,
    accent: 'from-emerald-500 to-teal-600',
    detail: 'Você não precisa decorar nada: cada área tem um objetivo bem específico.',
  },
  {
    title: 'Feed = problemas e relatos da comunidade',
    description: 'No Feed você vê o que moradores publicaram: buracos, iluminação, limpeza, segurança, transporte e outros assuntos do dia a dia.',
    when: 'Use quando quiser ver, apoiar, comentar ou acompanhar um problema do bairro.',
    icon: LayoutGrid,
    accent: 'from-orange-500 to-amber-600',
    detail: 'Ao abrir um relato, você encontra detalhes, comentários e a opção de ver a região no mapa.',
  },
  {
    title: 'Mapa e Dados = enxergar o bairro de outra forma',
    description: 'O Mapa junta relatos, eventos e vagas. A área Dados resume padrões e números para ficar fácil perceber o que mais acontece na região.',
    when: 'Use o Mapa para localização e Dados para ter uma visão geral.',
    icon: MapIcon,
    accent: 'from-sky-500 to-blue-600',
    detail: 'Quando houver muitos pontos próximos, o mapa agrupa os marcadores para continuar legível.',
  },
  {
    title: 'Empregos = oportunidades perto de você',
    description: 'A área Empregos mostra vagas cadastradas por empresas, com informações de modelo de trabalho, local e formas de contato quando disponíveis.',
    when: 'Use quando estiver procurando uma oportunidade ou quiser acompanhar vagas da região.',
    icon: Briefcase,
    accent: 'from-blue-600 to-indigo-600',
  },
  {
    title: 'Mural = eventos e atividades do bairro',
    description: 'Feiras, campanhas, reuniões, esporte, cultura e outras atividades ficam no Mural, separadas dos relatos de problemas.',
    when: 'Use quando quiser descobrir o que vai acontecer na comunidade e marcar presença.',
    icon: CalendarDays,
    accent: 'from-violet-500 to-purple-600',
  },
  {
    title: 'Denúncias e Perfil = segurança e participação',
    description: 'Denúncias servem para reportar conteúdo inadequado. No Perfil você acompanha sua conta e suas atividades. Administradores têm uma área separada de moderação.',
    when: 'Use Denúncias quando algo violar as regras e Perfil quando quiser gerenciar sua participação.',
    icon: ShieldCheck,
    accent: 'from-rose-500 to-red-600',
    detail: 'Pronto. Se esquecer alguma coisa, use “Como funciona” no rodapé para abrir este guia novamente.',
  },
];

const searchMeta: Record<string, { label: string; icon: LucideIcon; badge: string }> = {
  post: { label: 'Relato', icon: MessageSquare, badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' },
  event: { label: 'Evento', icon: CalendarDays, badge: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  job: { label: 'Vaga', icon: Briefcase, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  neighborhood: { label: 'Bairro', icon: MapPin, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
};

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function canonicalRoute(pathname: string) {
  if (/^\/post\//.test(pathname)) return '/post/:id';
  if (/^\/perfil\//.test(pathname)) return '/perfil/:id';
  if (/^\/empresa\//.test(pathname)) return '/empresa/:id';
  return pathname || '/';
}

export default function ProductExperience() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isNeighborhoodSelected, setNeighborhood } = useNeighborhood();
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null);
  const [footerTarget, setFooterTarget] = useState<HTMLElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const errorFingerprints = useRef(new Map<string, number>());

  useEffect(() => {
    const syncTargets = () => {
      const themeButton = document.querySelector<HTMLButtonElement>('header button[aria-label^="Ativar modo"]');
      setHeaderTarget(themeButton?.parentElement ?? null);
      setFooterTarget(document.querySelector<HTMLElement>('footer > div'));
    };
    syncTargets();
    const observer = new MutationObserver(syncTargets);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchError('');
      setSearching(false);
      return;
    }

    let active = true;
    setSearching(true);
    setSearchError('');
    const timer = window.setTimeout(() => {
      void supabase.rpc('global_search', { p_query: q, p_limit: 18 }).then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('Busca global indisponível:', error);
          setSearchResults([]);
          setSearchError('A busca online falhou. Ainda é possível buscar bairros abaixo.');
        } else {
          setSearchResults((data || []) as SearchResult[]);
        }
        setSearching(false);
      }).catch((error) => {
        if (!active) return;
        console.warn('Busca global indisponível:', error);
        setSearchResults([]);
        setSearchError('A busca online falhou. Ainda é possível buscar bairros abaixo.');
        setSearching(false);
      });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchOpen, searchQuery]);

  const fallbackNeighborhoods = useMemo(() => {
    const q = normalizeText(searchQuery.trim());
    if (q.length < 2) return [] as SearchResult[];
    const existing = new Set(searchResults.filter(item => item.result_type === 'neighborhood').map(item => item.id));
    return curitibaNeighborhoods
      .filter(item => !existing.has(item.name) && neighborhoodSearchText(item.name).includes(q))
      .slice(0, 5)
      .map((item) => ({
        result_type: 'neighborhood',
        id: item.name,
        title: item.name,
        subtitle: item.kind === 'locality' ? `Localidade de ${item.parentNeighborhood || 'Curitiba'}` : 'Bairro de Curitiba',
        description: item.aliases?.length ? `Também conhecido como: ${item.aliases.join(', ')}` : 'Filtrar a comunidade por este bairro.',
        path: '/',
        score: 40,
      }));
  }, [searchQuery, searchResults]);

  const visibleSearchResults = useMemo(() => [...searchResults, ...fallbackNeighborhoods].slice(0, 20), [searchResults, fallbackNeighborhoods]);

  const openSearchResult = (result: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery('');
    if (result.result_type === 'neighborhood') {
      setNeighborhood(result.id);
      navigate('/');
      return;
    }
    if (result.result_type === 'event') {
      try { sessionStorage.setItem('anb-mural-focus-event', result.id); } catch {}
      navigate('/mural');
      return;
    }
    if (result.result_type === 'job') {
      try { sessionStorage.setItem('anb-job-focus', result.id); } catch {}
      navigate('/empregos');
      return;
    }
    navigate(result.path || '/');
  };

  useEffect(() => {
    const suppressed = ['/login', '/privacidade', '/termos'].some(path => location.pathname.startsWith(path));
    if (!isNeighborhoodSelected || suppressed) return;
    let completed = false;
    try { completed = localStorage.getItem(ONBOARDING_KEY) === 'done'; } catch {}
    if (completed) return;
    const timer = window.setTimeout(() => setShowOnboarding(true), 700);
    return () => window.clearTimeout(timer);
  }, [isNeighborhoodSelected, location.pathname]);

  const completeOnboarding = () => {
    try { localStorage.setItem(ONBOARDING_KEY, 'done'); } catch {}
    setShowOnboarding(false);
    setOnboardingStep(0);
  };

  const reopenOnboarding = () => {
    setOnboardingStep(0);
    setShowOnboarding(true);
  };

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setInstallEvent(promptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setShowInstallPrompt(false);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!installEvent) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    let dismissedAt = 0;
    try { dismissedAt = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || '0'); } catch {}
    if (Date.now() - dismissedAt < INSTALL_DISMISS_MS) return;
    const timer = window.setTimeout(() => setShowInstallPrompt(true), 9000);
    return () => window.clearTimeout(timer);
  }, [installEvent]);

  const installApp = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'dismissed') {
      try { localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch {}
    }
    setShowInstallPrompt(false);
    setInstallEvent(null);
  };

  const dismissInstall = () => {
    try { localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch {}
    setShowInstallPrompt(false);
  };

  useEffect(() => {
    void supabase.rpc('track_page_view', { p_path: canonicalRoute(location.pathname) }).then(({ error }) => {
      if (error) console.warn('Analytics agregado indisponível:', error.message);
    }).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    const send = (message: string, stack?: string | null) => {
      const cleanMessage = String(message || 'Erro desconhecido').slice(0, 1000);
      const fingerprint = `${canonicalRoute(location.pathname)}|${cleanMessage}`;
      const now = Date.now();
      const last = errorFingerprints.current.get(fingerprint) || 0;
      if (now - last < 30_000) return;
      errorFingerprints.current.set(fingerprint, now);
      void supabase.rpc('log_client_error', {
        p_message: cleanMessage,
        p_stack: stack || null,
        p_component_stack: null,
        p_path: canonicalRoute(location.pathname),
        p_user_agent: navigator.userAgent,
      }).catch(() => {});
    };

    const onError = (event: ErrorEvent) => send(event.message || 'Erro de JavaScript', event.error instanceof Error ? event.error.stack : null);
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason instanceof Error) send(reason.message, reason.stack);
      else send(`Promise rejeitada: ${String(reason)}`);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [location.pathname]);

  const currentStep = onboardingSteps[onboardingStep];
  const StepIcon = currentStep?.icon || Sparkles;
  const progress = onboardingSteps.length > 1 ? ((onboardingStep + 1) / onboardingSteps.length) * 100 : 100;

  return (
    <>
      {headerTarget ? createPortal(
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/10 transition-all duration-200"
          aria-label="Buscar no site"
          title="Buscar no site (Ctrl/Cmd + K)"
        >
          <Search className="w-[18px] h-[18px]" />
        </button>,
        headerTarget,
      ) : null}

      {footerTarget ? createPortal(
        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <button type="button" onClick={reopenOnboarding} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Como funciona</button>
          <button type="button" onClick={() => navigate('/privacidade')} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Privacidade</button>
          <button type="button" onClick={() => navigate('/termos')} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Termos de uso</button>
          {installEvent ? <button type="button" onClick={() => void installApp()} className="inline-flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"><Download className="w-3.5 h-3.5" /> Instalar aplicativo</button> : null}
        </div>,
        footerTarget,
      ) : null}

      {searchOpen && (
        <div className="fixed inset-0 z-[180] bg-slate-950/60 backdrop-blur-sm flex items-start justify-center p-3 pt-[8vh] sm:pt-[12vh]" role="dialog" aria-modal="true" aria-label="Busca global">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-700">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar relato, bairro, evento ou vaga..."
                  className="min-w-0 flex-1 bg-transparent text-base sm:text-lg font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
                  aria-label="Digite o que deseja encontrar"
                />
                <button type="button" onClick={() => setSearchOpen(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar busca"><X className="w-5 h-5" /></button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-400">
                <span>Digite pelo menos 2 letras.</span>
                <span className="hidden sm:inline">Atalho: Ctrl/Cmd + K</span>
              </div>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-2 sm:p-3">
              {searchQuery.trim().length < 2 ? (
                <div className="p-8 text-center">
                  <div className="grid grid-cols-4 gap-2 max-w-sm mx-auto mb-4">
                    {[['Relatos', MessageSquare], ['Bairros', MapPin], ['Eventos', CalendarDays], ['Vagas', Briefcase]].map(([label, Icon]) => {
                      const SearchIcon = Icon as LucideIcon;
                      return <div key={String(label)} className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-3"><SearchIcon className="w-5 h-5 mx-auto text-slate-400 mb-1" /><span className="text-[10px] font-bold text-slate-500 dark:text-slate-300">{String(label)}</span></div>;
                    })}
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Encontre qualquer área do site sem precisar procurar aba por aba.</p>
                </div>
              ) : searching ? (
                <div className="p-10 text-center text-sm font-semibold text-slate-500">Buscando...</div>
              ) : visibleSearchResults.length === 0 ? (
                <div className="p-10 text-center">
                  <Search className="w-9 h-9 mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Nada encontrado para “{searchQuery.trim()}”</p>
                  <p className="text-xs text-slate-400 mt-1">Tente um bairro, assunto, evento ou nome de vaga.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {visibleSearchResults.map((result) => {
                    const meta = searchMeta[result.result_type] || searchMeta.post;
                    const ResultIcon = meta.icon;
                    return (
                      <button
                        type="button"
                        key={`${result.result_type}-${result.id}`}
                        onClick={() => openSearchResult(result)}
                        className="w-full text-left p-3 sm:p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex gap-3 group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"><ResultIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${meta.badge}`}>{meta.label}</span>
                            {result.subtitle && <span className="text-[11px] text-slate-400 truncate">{result.subtitle}</span>}
                          </div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">{result.title}</p>
                          {result.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{result.description}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {searchError && <p className="px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">{searchError}</p>}
            </div>
          </div>
        </div>
      )}

      {showOnboarding && currentStep && (
        <div className="fixed inset-0 z-[190] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Como funciona o No Meu Bairro">
          <div className="w-full max-w-xl rounded-[28px] overflow-hidden bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-white/10">
            <div className={`bg-gradient-to-br ${currentStep.accent} text-white p-6 sm:p-8 relative overflow-hidden`}>
              <div className="absolute inset-x-0 top-0 h-1.5 bg-white/20"><div className="h-full bg-white transition-all duration-300" style={{ width: `${progress}%` }} /></div>
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center"><StepIcon className="w-7 h-7" /></div>
                  <span className="text-xs font-black tracking-widest uppercase text-white/80">{onboardingStep + 1} de {onboardingSteps.length}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-6">{currentStep.title}</h2>
                <p className="text-sm sm:text-base leading-relaxed text-white/90 mt-3">{currentStep.description}</p>
              </div>
            </div>

            <div className="p-5 sm:p-7">
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Quando usar</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1 leading-relaxed">{currentStep.when}</p>
              </div>
              {currentStep.detail && <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-4">{currentStep.detail}</p>}

              <div className="flex items-center justify-between gap-3 mt-6">
                <button type="button" onClick={completeOnboarding} className="text-xs sm:text-sm font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-2">Pular guia</button>
                <div className="flex gap-2">
                  {onboardingStep > 0 && <button type="button" onClick={() => setOnboardingStep(step => Math.max(0, step - 1))} className="min-h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">Voltar</button>}
                  {onboardingStep < onboardingSteps.length - 1 ? (
                    <button type="button" onClick={() => setOnboardingStep(step => Math.min(onboardingSteps.length - 1, step + 1))} className="min-h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm">Próximo</button>
                  ) : (
                    <button type="button" onClick={completeOnboarding} className="min-h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Entendi, começar</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInstallPrompt && installEvent && (
        <div className="fixed left-4 right-4 bottom-24 md:left-6 md:right-auto md:bottom-6 z-[150] md:w-[360px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-4 animate-scale-in">
          <div className="flex gap-3">
            <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0"><img src="/logo.png" alt="" className="w-full h-full object-cover" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-900 dark:text-white">Instalar No Meu Bairro</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">Abra mais rápido pela tela inicial, como um aplicativo, sem perder nenhuma função do site.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={dismissInstall} className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Agora não</button>
            <button type="button" onClick={() => void installApp()} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5"><Download className="w-4 h-4" /> Instalar</button>
          </div>
        </div>
      )}
    </>
  );
}
