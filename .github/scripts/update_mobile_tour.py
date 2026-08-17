from pathlib import Path

path = Path('src/components/ProductExperience.tsx')
text = path.read_text()

text = text.replace(
"  Map as MapIcon, MapPin, MessageSquare, Plus, Search, Share2, ShieldAlert, Sparkles, UserCircle, X,\n} from 'lucide-react';",
"  Map as MapIcon, MapPin, MessageSquare, MoreHorizontal, Plus, Search, Share2, ShieldAlert, ShieldCheck, Sparkles, UserCircle, X,\n} from 'lucide-react';",
1,
)

text = text.replace(
"type TourKey = 'feed' | 'create-post' | 'mapa' | 'dados' | 'empregos' | 'mural' | 'denuncias' | 'perfil';",
"type TourKey = 'feed' | 'create-post' | 'mapa' | 'dados' | 'empregos' | 'mural' | 'denuncias' | 'perfil' | 'more' | 'admin';",
1,
)

text = text.replace("const ONBOARDING_KEY = 'nmb-onboarding-v4';", "const ONBOARDING_KEY = 'nmb-onboarding-v5';", 1)

anchor = "const tourLabels: Partial<Record<TourKey, string>> = {"
if anchor not in text:
    raise SystemExit('tourLabels anchor not found')

mobile_steps = r'''const mobileTourSteps: TourStep[] = [
  {
    kind: 'intro',
    title: 'Aprenda tocando',
    description: 'Vou destacar a interface real. Toque nos botões indicados e, em poucos passos, você já sabe onde fica tudo.',
    icon: Sparkles,
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    kind: 'target',
    target: 'feed',
    title: 'Feed',
    description: 'Relatos e problemas publicados pela comunidade ficam aqui.',
    icon: LayoutGrid,
    accent: 'from-orange-500 to-amber-600',
  },
  {
    kind: 'target',
    target: 'create-post',
    title: 'Publicar relato',
    description: 'Para publicar um problema ou relato, toque no botão “+”.',
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
    description: 'Feiras, campanhas, reuniões e outros eventos ficam aqui.',
    icon: CalendarDays,
    accent: 'from-violet-500 to-purple-600',
  },
  {
    kind: 'target',
    target: 'more',
    title: 'Mais',
    description: 'Aqui ficam Dados, Denúncias, Perfil e também Busca, Instalar app, tema e Sair. Administradores também encontram o Admin aqui.',
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
    description: 'Os atalhos do dia a dia ficam embaixo. As opções secundárias ficam em “Mais”. Você pode rever este guia quando quiser.',
    icon: CheckCircle2,
    accent: 'from-emerald-500 to-teal-600',
  },
];

'''
text = text.replace(anchor, mobile_steps + anchor, 1)

text = text.replace(
"  perfil: 'Perfil',\n};",
"  perfil: 'Perfil',\n  more: 'Mais',\n  admin: 'Admin',\n};",
1,
)

old_find = r'''function findTourTarget(key: TourKey, isMobile: boolean) {
  if (key === 'create-post') {
    return document.querySelector<HTMLButtonElement>('button[aria-label="Criar novo relato"]');
  }

  const nav = document.querySelector<HTMLElement>(
    isMobile
      ? 'nav[aria-label="Navegação mobile"]'
      : 'header nav[aria-label="Navegação principal"]',
  );
  if (!nav) return null;
  const label = tourLabels[key];
  if (!label) return null;
  return Array.from(nav.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
    (button.textContent || '').replace(/\s+/g, ' ').trim().includes(label),
  ) || null;
}'''
new_find = r'''function findTourTarget(key: TourKey, isMobile: boolean) {
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
}'''
if old_find not in text:
    raise SystemExit('findTourTarget block not found')
text = text.replace(old_find, new_find, 1)

text = text.replace("  const { isAuthenticated } = useAuth();", "  const { isAuthenticated, user } = useAuth();", 1)
text = text.replace(
"  const [isStandalone, setIsStandalone] = useState(() => isStandaloneMode());\n  const errorFingerprints = useRef(new Map<string, number>());\n\n  const activeTourSteps = useMemo(\n    () => tourSteps.filter((step) => step.target !== 'create-post' || isAuthenticated),\n    [isAuthenticated],\n  );",
"  const [isStandalone, setIsStandalone] = useState(() => isStandaloneMode());\n  const [isAdmin, setIsAdmin] = useState(false);\n  const errorFingerprints = useRef(new Map<string, number>());\n\n  const activeTourSteps = useMemo(() => {\n    const source = isMobileTour ? mobileTourSteps : tourSteps;\n    return source.filter((step) => {\n      if (step.target === 'create-post' && !isAuthenticated) return false;\n      if (step.target === 'admin' && !isAdmin) return false;\n      return true;\n    });\n  }, [isAuthenticated, isMobileTour, isAdmin]);",
1,
)

state_anchor = "  const currentStep = activeTourSteps[onboardingStep];\n\n  useEffect(() => {\n    const syncTargets = () => {"
admin_effect = r'''  const currentStep = activeTourSteps[onboardingStep];

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
    const syncTargets = () => {'''
if state_anchor not in text:
    raise SystemExit('state anchor not found')
text = text.replace(state_anchor, admin_effect, 1)

attach_anchor = r'''    const attach = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nextTarget = findTourTarget(currentStep.target!, isMobileTour);'''
attach_new = r'''    const attach = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (isMobileTour && ['dados', 'denuncias', 'perfil', 'admin'].includes(currentStep.target!)) {
          const sheet = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Mais opções"]');
          if (!sheet) {
            const moreButton = document.querySelector<HTMLButtonElement>('nav[aria-label="Navegação mobile"] button[aria-label="Mais opções"]');
            if (moreButton?.getAttribute('aria-expanded') !== 'true') moreButton?.click();
          }
        }
        const nextTarget = findTourTarget(currentStep.target!, isMobileTour);'''
if attach_anchor not in text:
    raise SystemExit('attach anchor not found')
text = text.replace(attach_anchor, attach_new, 1)

# Keep step index valid if admin status or viewport changes while the guide is open.
index_anchor = "  const currentStep = activeTourSteps[onboardingStep];\n\n  useEffect(() => {\n    let active = true;"
index_new = "  const currentStep = activeTourSteps[onboardingStep];\n\n  useEffect(() => {\n    if (onboardingStep >= activeTourSteps.length) setOnboardingStep(Math.max(0, activeTourSteps.length - 1));\n  }, [activeTourSteps.length, onboardingStep]);\n\n  useEffect(() => {\n    let active = true;"
if index_anchor not in text:
    raise SystemExit('index guard anchor not found')
text = text.replace(index_anchor, index_new, 1)

# Improve helper phrase for the More sheet steps.
old_helper = "                {isMobileTour ? 'Toque no botão destacado para continuar' : 'Clique no botão destacado para continuar'}"
new_helper = "                {isMobileTour ? (currentStep.target === 'more' ? 'Toque em Mais para abrir as outras opções' : 'Toque no botão destacado para continuar') : 'Clique no botão destacado para continuar'}"
if old_helper not in text:
    raise SystemExit('helper phrase anchor not found')
text = text.replace(old_helper, new_helper, 1)

# Clean up temporary patch files after workflow execution.
path.write_text(text)
Path('.github/scripts/update_mobile_tour.py').unlink(missing_ok=True)
Path('.github/workflows/update-mobile-tour.yml').unlink(missing_ok=True)
