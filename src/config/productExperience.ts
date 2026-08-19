import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCircle,
} from 'lucide-react';

export type TourKey = 'feed' | 'create-post' | 'mapa' | 'dados' | 'empregos' | 'mural' | 'denuncias' | 'perfil' | 'more' | 'admin';

export type TourStep = {
  kind: 'intro' | 'target' | 'done';
  target?: TourKey;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
};

export const desktopTourSteps: TourStep[] = [
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

export const mobileTourSteps: TourStep[] = [
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

export const tourLabels: Partial<Record<TourKey, string>> = {
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

export const searchMeta: Record<string, { label: string; icon: LucideIcon; badge: string }> = {
  post: { label: 'Relato', icon: MessageSquare, badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' },
  event: { label: 'Evento', icon: CalendarDays, badge: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  job: { label: 'Vaga', icon: Briefcase, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  neighborhood: { label: 'Bairro', icon: MapPin, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
};
