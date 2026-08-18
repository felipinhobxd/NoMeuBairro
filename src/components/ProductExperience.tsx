import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3, Briefcase, CalendarDays, CheckCircle2, Download, LayoutGrid,
  Map as MapIcon, MapPin, MessageSquare, MoreHorizontal, Plus, Search, Share2, ShieldAlert, ShieldCheck, Sparkles, UserCircle, X,
} from 'lucide-react';
import { curitibaNeighborhoods, neighborhoodSearchText, useNeighborhood } from '../contexts/NeighborhoodContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import { COOKIE_CONSENT_EVENT, hasCookieConsentChoice } from '../utils/cookieConsent';

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

type TourKey = 'feed' | 'create-post' | 'mapa' | 'dados' | 'empregos' | 'mural' | 'denuncias' | 'perfil' | 'more' | 'admin';

type TourStep = {
  kind: 'intro' | 'target' | 'done';
  target?: TourKey;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
};

type TourRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type InstallInstructions = {
  title: string;
  steps: string[];
  note?: string;
};

const ONBOARDING_KEY = 'nmb-onboarding-v6';
const INSTALL_DISMISS_KEY = 'nmb-pwa-install-dismissed-at';
const INSTALL_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

const tourSteps: TourStep[] = [
  {
    kind: 'intro',
    title: 'Aprenda clicando',
    description: 'Vou destacar os botões importantes. Clique neles para conhecer o site. Se precisar, você pode trocar a fonte pelo botão “Aa” no topo.',
    icon: Sparkles,
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    kind: 'target',
    target: 'feed',
    title: 'Feed',
    description: 'Aqui ficam os relatos. Buraco, iluminação, limpeza e transporte levam ao 156; água/esgoto à Sanepar; fios/energia à Copel; segurança à Guarda Municipal 153.',
    icon: LayoutGrid,
    accent: 'from-orange-500 to-amber-600',
  },
  {
    kind: 'target',
    target: 'create-post',
    title: 'Publicar relato',
    description: 'Use o “+” e escolha a categoria mais próxima do problema. O contato oficial correspondente aparece antes de publicar; o relato comunitário não abre protocolo sozinho.',
    icon: Plus,
    accent: 'from-emerald-500 to-green-600',
  },
  {
    kind: 'target',
    target: 'mapa',
    title: 'Mapa',
    description: 'Veja onde estão relatos, eventos e vagas perto de você.',
    icon: MapIcon,
    accent: 'from-sky-500 to-blue-600',
  },
  {
    kind: 'target',
    target: 'dados',
    title: 'Dados',
    description: 'Veja os números do bairro e os assuntos que mais aparecem.',
    icon: BarChart3,
    accent: 'from-cyan-500 to-sky-600',
  },
  {
    kind: 'target',
    target: 'empregos',
    title: 'Empregos',
    description: 'Encontre vagas e oportunidades publicadas por empresas da região.',
    icon: Briefcase,
    accent: 'from-blue-600 to-indigo-600',
  },
  {
    kind: 'target',
    target: 'mural',
    title: 'Mural',
    description: 'Feiras, campanhas, reuniões, esporte e outros eventos ficam aqui. Você pode explorar sem conta; para publicar ou participar, basta entrar ou criar uma conta.',
    icon: CalendarDays,
    accent: 'from-violet-500 to-purple-600',
  },
  {
    kind: 'target',
    target: 'denuncias',
    title: 'Denúncias',
    description: 'Canal anônimo para situações sérias e sensíveis, como violência, abuso, assédio, exploração, crime ambiental ou fraude.',
    icon: ShieldAlert,
    accent: 'from-rose-500 to-red-600',
  },
  {
    kind: 'target',
    target: 'perfil',
    title: 'Perfil',
    description: 'Aqui você acompanha sua conta e tudo o que já fez na comunidade.',
    icon: UserCircle,
    accent: 'from-emerald-600 to-green-700',
  },
  {
    kind: 'done',
    title: 'Pronto!',
    description: 'Agora você já sabe onde fica cada coisa. Lembre-se: publique para mobilizar o bairro e também use o canal oficial indicado para gerar um protocolo.',
    icon: CheckCircle2,
    accent: 'from-emerald-500 to-teal-600',
  },
];

const mobileTourSteps: TourStep[] = [
  {
    kind: 'intro',
    title: 'Aprenda tocando',
    description: 'Vou destacar a interface real. Toque nos botões indicados para conhecer o site. O tamanho da fonte pode ser alterado depois em “Mais”.',
    icon: Sparkles,
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    kind: 'target',
    target: 'feed',
    title: 'Feed',
    description: 'Os relatos ficam aqui. Buraco, iluminação, limpeza e transporte: 156; água/esgoto: Sanepar; fios/energia: Copel; segurança: Guarda Municipal 153.',
    icon: LayoutGrid,
    accent: 'from-orange-500 to-amber-600',
  },
  {
    kind: 'target',
    target: 'create-post',
    title: 'Publicar relato',
    description: 'Toque no “+” e escolha a categoria do problema. O contato oficial aparece antes de publicar; o relato não abre protocolo automaticamente.',
    icon: Plus,
    accent: 'from-emerald-500 to-green-600',
  },
  {
    kind: 'target',
    target: 'mapa',
    title: 'Mapa',
    description: 'Veja relatos, eventos e vagas espalhados pela cidade.',
    icon: MapIcon,
    accent: 'from-sky-500 to-blue-600',
  },
  {
    kind: 'target',
    target: 'empregos',
    title: 'Empregos',
    description: 'Vagas e oportunidades da região ficam neste atalho.',
    icon: Briefcase,
    accent: 'from-blue-600 to-indigo-600',
  },
  {
    kind: 'target',
    target: 'mural',
    title: 'Mural',
    description: 'Feiras, campanhas, reuniões e outros eventos ficam aqui. Para publicar ou participar do Mural, entre ou crie uma conta.',
    icon: CalendarDays,
    accent: 'from-violet-500 to-purple-600',
  },
  {
    kind: 'target',
    target: 'more',
    title: 'Mais',
    description: 'Aqui ficam Dados, Denúncias, Perfil e também Busca, tamanho da fonte, Instalar app, tema e Sair. Administradores também encontram o Admin aqui.',
    icon: MoreHorizontal,
    accent: 'from-slate-600 to-slate-800',
  },
  {
    kind: 'target',
    target: 'dados',
    title: 'Dados',
    description: 'Veja números do bairro e os assuntos que mais aparecem.',
    icon: BarChart3,
    accent: 'from-cyan-500 to-sky-600',
  },
  {
    kind: 'target',
    target: 'denuncias',
    title: 'Denúncias',
    description: 'Canal anônimo para situações sérias, como violência, abuso, assédio, exploração, crime ambiental ou fraude.',
    icon: ShieldAlert,
    accent: 'from-rose-500 to-red-600',
  },
  {
    kind: 'target',
    target: 'perfil',
    title: 'Perfil',
    description: 'Sua conta e suas atividades ficam aqui.',
    icon: UserCircle,
    accent: 'from-emerald-600 to-green-700',
  },
  {
    kind: 'target',
    target: 'admin',
    title: 'Admin',
    description: 'Como administrador, use esta área para moderação, histórico, uso e erros do site.',
    icon: ShieldCheck,
    accent: 'from-amber-500 to-orange-600',
  },
  {
    kind: 'done',
    title: 'Pronto!',
    description: 'Use o relato para mobilizar o bairro e o telefone indicado para abrir o protocolo oficial. Você pode rever este guia quando quiser.',
    icon: CheckCircle2,
    accent: 'from-emerald-500 to-teal-600',
  },
];

const tourLabels: Partial<Record<TourKey, string>> = {
  feed: 'Feed',
  mapa: 'Mapa',
  dados: 'Dados',
  empregos: 'Empregos',
  mural: 'Mural',
  denuncias: 'Denúncias',
  perfil: 'Perfil',
  more: 'Mais',
  admin: 'Admin',
};

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

function findTourTarget(key: TourKey, isMobile: boolean) {
  if (key === 'create-post') {
    return document.querySelector<HTMLButtonElement>('button[aria-label="Criar novo relato"]');
  }

  const label = tourLabels[key];
  if (!label) return null;

  if (isMobile) {
    if (key === 'more') {
      return document.querySelector<HTMLButtonElement>('nav[aria-label="Navegação mobile"] button[aria-label="Mais opções"]');
    }

    if (['dados', 'denuncias', 'perfil', 'admin'].includes(key)) {
      const sheet = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Mais opções"]');
      if (!sheet) return null;
      return Array.from(sheet.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
        (button.textContent || '').replace(/\s+/g, ' ').trim() === label,
      ) || null;
    }

    const nav = document.querySelector<HTMLElement>('nav[aria-label="Navegação mobile"]');
    if (!nav) return null;
    return Array.from(nav.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      (button.textContent || '').replace(/\s+/g, ' ').trim().includes(label),
    ) || null;
  }

  const nav = document.querySelector<HTMLElement>('header nav[aria-label="Navegação principal"]');
  if (!nav) return null;
  return Array.from(nav.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
    (button.textContent || '').replace(/\s+/g, ' ').trim().includes(label),
  ) || null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

function getInstallInstructions(): InstallInstructions {
  const ua = navigator.userAgent;
  const navigatorWithPlatform = navigator as Navigator & { platform?: string; maxTouchPoints?: number };
  const isiOS = /iPad|iPhone|iPod/i.test(ua)
    || (navigatorWithPlatform.platform === 'MacIntel' && (navigatorWithPlatform.maxTouchPoints || 0) > 1);
  const isAndroid = /Android/i.test(ua);
  const isFirefox = /Firefox/i.test(ua);

  if (isiOS) {
    return {
      title: 'Instalar no iPhone ou iPad',
      steps: [
        'Abra este site no Safari.',
        'Toque no botão Compartilhar.',
        'Escolha “Adicionar à Tela de Início”.',
        'Confirme em “Adicionar”.',
      ],
      note: 'No iPhone/iPad, a instalação é feita pelo menu Compartilhar do Safari.',
    };
  }

  if (isAndroid) {
    return {
      title: 'Instalar no Android',
      steps: [
        'Abra o menu do navegador (⋮).',
        'Toque em “Instalar app” ou “Adicionar à tela inicial”.',
        'Confirme a instalação.',
      ],
      note: 'Chrome, Edge e Brave normalmente oferecem essa opção no menu.',
    };
  }

  if (isFirefox) {
    return {
      title: 'Instalar no computador',
      steps: [
        'Abra o No Meu Bairro no Chrome, Edge ou Brave.',
        'Clique no ícone de instalação da barra de endereço ou abra o menu do navegador.',
        'Escolha “Instalar No Meu Bairro”.',
      ],
      note: 'O Firefox para desktop não oferece a mesma instalação de PWA dos navegadores Chromium.',
    };
  }

  return {
    title: 'Instalar no computador',
    steps: [
      'Procure o ícone de instalação no lado direito da barra de endereço.',
      'Ou abra o menu do navegador (⋮) e escolha “Instalar No Meu Bairro”.',
      'Confirme em “Instalar”.',
    ],
    note: 'No Chrome, Edge e Brave a instalação abre o site como um aplicativo separado.',
  };
}

export default function ProductExperience() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
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
  const [isMobileTour, setIsMobileTour] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches);
  const [tourRect, setTourRect] = useState<TourRect | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneMode());
  const [isAdmin, setIsAdmin] = useState(false);
  const [cookieChoiceMade, setCookieChoiceMade] = useState(() => hasCookieConsentChoice());
  const errorFingerprints = useRef(new Map<string, number>());

  const activeTourSteps = useMemo(() => {
    const source = isMobileTour ? mobileTourSteps : tourSteps;
    return source.filter((step) => {
      if (step.target === 'admin' && !isAdmin) return false;
      return true;
    });
  }, [isAuthenticated, isMobileTour, isAdmin]);
  const currentStep = activeTourSteps[onboardingStep];

  useEffect(() => {
    if (onboardingStep >= activeTourSteps.length) setOnboardingStep(Math.max(0, activeTourSteps.length - 1));
  }, [activeTourSteps.length, onboardingStep]);

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
    const media = window.matchMedia('(max-width: 1023px)');
    const sync = () => setIsMobileTour(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const acceptCurrentChoice = () => setCookieChoiceMade(true);
    const syncStoredChoice = () => setCookieChoiceMade(hasCookieConsentChoice());
    window.addEventListener(COOKIE_CONSENT_EVENT, acceptCurrentChoice);
    window.addEventListener('storage', syncStoredChoice);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, acceptCurrentChoice);
      window.removeEventListener('storage', syncStoredChoice);
    };
  }, []);

  useEffect(() => {
    const displayMedia = window.matchMedia('(display-mode: standalone)');
    const sync = () => setIsStandalone(isStandaloneMode());
    sync();
    displayMedia.addEventListener('change', sync);
    return () => displayMedia.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (!showOnboarding) setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setShowInstallHelp(false);
        if (showOnboarding) {
          try { localStorage.setItem(ONBOARDING_KEY, 'done'); } catch {}
          setShowOnboarding(false);
          setOnboardingStep(0);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showOnboarding]);

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
      void Promise.resolve(supabase.rpc('global_search', { p_query: q, p_limit: 18 })).then(({ data, error }) => {
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
    if (!cookieChoiceMade || !isNeighborhoodSelected || suppressed) return;
    let completed = false;
    try { completed = localStorage.getItem(ONBOARDING_KEY) === 'done'; } catch {}
    if (completed) return;
    const timer = window.setTimeout(() => {
      setSearchOpen(false);
      setShowInstallPrompt(false);
      setShowInstallHelp(false);
      setShowOnboarding(true);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [cookieChoiceMade, isNeighborhoodSelected, location.pathname]);

  useEffect(() => {
    if (!showOnboarding) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showOnboarding]);

  useEffect(() => {
    if (!showOnboarding || currentStep?.kind !== 'target' || !currentStep.target) {
      setTourRect(null);
      return;
    }

    let activeTarget: HTMLButtonElement | null = null;
    let frame = 0;

    const updateRect = () => {
      if (!activeTarget) return;
      const rect = activeTarget.getBoundingClientRect();
      setTourRect({
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      });
    };

    const onTargetClick = (event: MouseEvent) => {
      if (currentStep.target === 'create-post') {
        event.preventDefault();
        event.stopPropagation();
      }
      window.setTimeout(() => {
        setOnboardingStep((step) => Math.min(activeTourSteps.length - 1, step + 1));
      }, 60);
    };

    const attach = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (isMobileTour && ['dados', 'denuncias', 'perfil', 'admin'].includes(currentStep.target!)) {
          const sheet = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Mais opções"]');
          if (!sheet) {
            const moreButton = document.querySelector<HTMLButtonElement>('nav[aria-label="Navegação mobile"] button[aria-label="Mais opções"]');
            if (moreButton?.getAttribute('aria-expanded') !== 'true') moreButton?.click();
          }
        }
        const nextTarget = findTourTarget(currentStep.target!, isMobileTour);
        if (nextTarget !== activeTarget) {
          activeTarget?.removeEventListener('click', onTargetClick, true);
          activeTarget = nextTarget;
          activeTarget?.addEventListener('click', onTargetClick, true);
        }
        updateRect();
      });
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', attach);
    window.addEventListener('scroll', attach, true);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', attach);
      window.removeEventListener('scroll', attach, true);
      activeTarget?.removeEventListener('click', onTargetClick, true);
    };
  }, [showOnboarding, currentStep?.kind, currentStep?.target, isMobileTour, location.pathname, activeTourSteps.length]);

  const completeOnboarding = (goHome = false) => {
    try { localStorage.setItem(ONBOARDING_KEY, 'done'); } catch {}
    setShowOnboarding(false);
    setOnboardingStep(0);
    setTourRect(null);
    if (goHome) navigate('/');
  };

  const reopenOnboarding = () => {
    if (!cookieChoiceMade) return;
    setSearchOpen(false);
    setShowInstallPrompt(false);
    setShowInstallHelp(false);
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
      setShowInstallHelp(false);
      setIsStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (showOnboarding || isStandalone) return;
    let dismissedAt = 0;
    try { dismissedAt = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || '0'); } catch {}
    if (Date.now() - dismissedAt < INSTALL_DISMISS_MS) return;
    const timer = window.setTimeout(() => setShowInstallPrompt(true), 9000);
    return () => window.clearTimeout(timer);
  }, [showOnboarding, isStandalone]);

  const installApp = async () => {
    if (isStandalone) return;
    setShowInstallPrompt(false);
    if (!installEvent) {
      setShowInstallHelp(true);
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'dismissed') {
      try { localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch {}
    }
    setInstallEvent(null);
  };

  const dismissInstall = () => {
    try { localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch {}
    setShowInstallPrompt(false);
  };

  useEffect(() => {
    void Promise.resolve(supabase.rpc('track_page_view', { p_path: canonicalRoute(location.pathname) })).then(({ error }) => {
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
      void Promise.resolve(supabase.rpc('log_client_error', {
        p_message: cleanMessage,
        p_stack: stack || null,
        p_component_stack: null,
        p_path: canonicalRoute(location.pathname),
        p_user_agent: navigator.userAgent,
      })).catch(() => {});
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

  const targetStepNumber = currentStep?.kind === 'target'
    ? activeTourSteps.slice(0, onboardingStep + 1).filter(step => step.kind === 'target').length
    : 0;
  const targetStepTotal = activeTourSteps.filter(step => step.kind === 'target').length;
  const StepIcon = currentStep?.icon || Sparkles;
  const spotlightPadding = 9;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const tooltipLeft = tourRect
    ? clamp(tourRect.left + tourRect.width / 2 - 170, 12, Math.max(12, viewportWidth - 352))
    : 12;
  const installInstructions = typeof navigator !== 'undefined' ? getInstallInstructions() : { title: 'Instalar aplicativo', steps: [] };

  return (
    <>
      {headerTarget ? createPortal(
        <>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/10 transition-all duration-200"
            aria-label="Buscar no site"
            title="Buscar no site (Ctrl/Cmd + K)"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>
          {!isStandalone && (
            <button
              type="button"
              onClick={() => void installApp()}
              className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/10 transition-all duration-200"
              aria-label="Instalar aplicativo"
              title="Instalar No Meu Bairro"
            >
              <Download className="w-[18px] h-[18px]" />
            </button>
          )}
        </>,
        headerTarget,
      ) : null}

      {footerTarget ? createPortal(
        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <button type="button" onClick={reopenOnboarding} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Como funciona</button>
          <button type="button" onClick={() => navigate('/privacidade')} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Privacidade</button>
          <button type="button" onClick={() => navigate('/termos')} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Termos de uso</button>
          {!isStandalone && <button type="button" onClick={() => void installApp()} className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"><Download className="w-3.5 h-3.5" /> Instalar aplicativo</button>}
        </div>,
        footerTarget,
      ) : null}

      {searchOpen && !showOnboarding && (
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

      {showInstallHelp && !showOnboarding && !isStandalone && (
        <div className="fixed inset-0 z-[182] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Como instalar o aplicativo">
          <div className="w-full max-w-md rounded-[26px] bg-white dark:bg-slate-900 shadow-2xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700">
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0"><Download className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">{installInstructions.title}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">O No Meu Bairro pode ficar na sua tela como um aplicativo.</p>
              </div>
              <button type="button" onClick={() => setShowInstallHelp(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 sm:p-6">
              <ol className="space-y-3">
                {installInstructions.steps.map((step, index) => (
                  <li key={step} className="flex gap-3 items-start">
                    <span className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0">{index + 1}</span>
                    <span className="text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-200 pt-1">{step}</span>
                  </li>
                ))}
              </ol>
              {installInstructions.note && <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400 flex gap-2"><Share2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />{installInstructions.note}</div>}
              <button type="button" onClick={() => setShowInstallHelp(false)} className="mt-5 w-full min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black">Entendi</button>
            </div>
          </div>
        </div>
      )}

      {showOnboarding && currentStep?.kind === 'intro' && (
        <div className="fixed inset-0 z-[190] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Guia interativo do No Meu Bairro">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-white/10">
            <div className={`bg-gradient-to-br ${currentStep.accent} text-white p-6 sm:p-7`}>
              <div className="w-14 h-14 rounded-2xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center"><StepIcon className="w-7 h-7" /></div>
              <h2 className="text-2xl font-black tracking-tight mt-5">{currentStep.title}</h2>
              <p className="text-sm leading-relaxed text-white/90 mt-2">{currentStep.description}</p>
            </div>
            <div className="p-5 flex items-center justify-between gap-3">
              <button type="button" onClick={() => completeOnboarding(false)} className="px-2 py-2 text-sm font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">Pular</button>
              <button type="button" onClick={() => setOnboardingStep(1)} className="min-h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-sm">Começar tour</button>
            </div>
          </div>
        </div>
      )}

      {showOnboarding && currentStep?.kind === 'target' && tourRect && (
        <>
          <div className="fixed z-[185] bg-slate-950/70 backdrop-blur-[1px]" style={{ top: 0, left: 0, right: 0, height: Math.max(0, tourRect.top - spotlightPadding) }} />
          <div className="fixed z-[185] bg-slate-950/70 backdrop-blur-[1px]" style={{ top: tourRect.bottom + spotlightPadding, left: 0, right: 0, bottom: 0 }} />
          <div className="fixed z-[185] bg-slate-950/70 backdrop-blur-[1px]" style={{ top: Math.max(0, tourRect.top - spotlightPadding), left: 0, width: Math.max(0, tourRect.left - spotlightPadding), height: tourRect.height + spotlightPadding * 2 }} />
          <div className="fixed z-[185] bg-slate-950/70 backdrop-blur-[1px]" style={{ top: Math.max(0, tourRect.top - spotlightPadding), left: tourRect.right + spotlightPadding, right: 0, height: tourRect.height + spotlightPadding * 2 }} />

          <div
            className="fixed z-[188] pointer-events-none rounded-2xl border-[3px] border-emerald-400 shadow-[0_0_0_4px_rgba(255,255,255,0.92),0_0_0_10px_rgba(16,185,129,0.25),0_12px_35px_rgba(0,0,0,0.3)] animate-pulse"
            style={{
              top: tourRect.top - 6,
              left: tourRect.left - 6,
              width: tourRect.width + 12,
              height: tourRect.height + 12,
            }}
          />

          <div
            className="fixed z-[195] w-[calc(100vw-24px)] max-w-[340px] rounded-2xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-700 p-4"
            style={currentStep.target === 'create-post'
              ? (isMobileTour ? { left: 12, bottom: 205 } : { right: 20, bottom: 100 })
              : isMobileTour
                ? { left: 12, bottom: Math.max(92, window.innerHeight - tourRect.top + 14) }
                : { left: tooltipLeft, top: tourRect.bottom + 14 }}
            role="dialog"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${currentStep.accent} text-white flex items-center justify-center shrink-0 shadow-sm`}><StepIcon className="w-5 h-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-black text-slate-900 dark:text-white">{currentStep.title}</h2>
                  <span className="text-[10px] font-black text-slate-400 whitespace-nowrap">{targetStepNumber} de {targetStepTotal}</span>
                </div>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mt-1">{currentStep.description}</p>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-center">
              <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                {isMobileTour ? (currentStep.target === 'more' ? 'Toque em Mais para abrir as outras opções' : 'Toque no botão destacado para continuar') : 'Clique no botão destacado para continuar'}
              </p>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button type="button" onClick={() => completeOnboarding(false)} className="px-1.5 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">Sair do guia</button>
              {onboardingStep > 1 && (
                <button type="button" onClick={() => setOnboardingStep(step => Math.max(1, step - 1))} className="px-2 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-300 hover:text-emerald-600">Voltar</button>
              )}
            </div>
          </div>
        </>
      )}

      {showOnboarding && currentStep?.kind === 'target' && !tourRect && (
        <div className="fixed inset-0 z-[190] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" role="status">
          <div className="rounded-2xl bg-white dark:bg-slate-900 px-5 py-4 shadow-2xl text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-3">
            <span className="w-5 h-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" /> Preparando o próximo botão...
          </div>
        </div>
      )}

      {showOnboarding && currentStep?.kind === 'done' && (
        <div className="fixed inset-0 z-[190] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Fim do guia">
          <div className="w-full max-w-sm rounded-[26px] bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className={`bg-gradient-to-br ${currentStep.accent} p-6 text-white text-center`}>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white/15 flex items-center justify-center"><StepIcon className="w-7 h-7" /></div>
              <h2 className="text-2xl font-black mt-4">{currentStep.title}</h2>
              <p className="text-sm leading-relaxed text-white/90 mt-2">{currentStep.description}</p>
            </div>
            <div className="p-5">
              <button type="button" onClick={() => completeOnboarding(true)} className="w-full min-h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black inline-flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> Ir para o Feed</button>
            </div>
          </div>
        </div>
      )}

      {showInstallPrompt && !showOnboarding && !isStandalone && (
        <div className="fixed left-4 right-4 bottom-24 md:left-6 md:right-auto md:bottom-6 z-[150] md:w-[360px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-4 animate-scale-in">
          <div className="flex gap-3">
            <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0"><img src="/logo.png" alt="" className="w-full h-full object-cover" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-900 dark:text-white">Instalar No Meu Bairro</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">Coloque o No Meu Bairro na tela inicial e abra como um aplicativo.</p>
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
