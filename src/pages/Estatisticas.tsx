import { useEffect, useMemo, useState } from 'react';
import { Card, postCategories } from '../components/UI';
import {
  BarChart3, PieChart, Activity, CheckCircle2,
  Clock, AlertCircle, TrendingUp, CalendarDays, Briefcase, Loader2, RefreshCw, ShieldCheck, Trash2, Eye,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { supabase } from '../utils/supabase';

type CategoryStat = { category: string; count: number };
type DailyStat = { date: string; count: number };
type ModerationTransparency = { periodDays: number; reportsReceived: number; pendingNow: number; handled: number; removed: number; kept: number; averageResponseHours: number; updatedAt?: string };
type DashboardStats = {
  totalReports: number;
  pending: number;
  inProgress: number;
  resolved: number;
  categories: CategoryStat[];
  dailyReports: DailyStat[];
  upcomingEvents: number;
  eventsNext7Days: number;
  activeJobs: number;
  updatedAt?: string;
};

function normalizeStats(value: any): DashboardStats {
  return {
    totalReports: Number(value?.totalReports || 0),
    pending: Number(value?.pending || 0),
    inProgress: Number(value?.inProgress || 0),
    resolved: Number(value?.resolved || 0),
    categories: Array.isArray(value?.categories)
      ? value.categories.map((item: any) => ({ category: String(item.category || 'outros'), count: Number(item.count || 0) }))
      : [],
    dailyReports: Array.isArray(value?.dailyReports)
      ? value.dailyReports.map((item: any) => ({ date: String(item.date || ''), count: Number(item.count || 0) }))
      : [],
    upcomingEvents: Number(value?.upcomingEvents || 0),
    eventsNext7Days: Number(value?.eventsNext7Days || 0),
    activeJobs: Number(value?.activeJobs || 0),
    updatedAt: value?.updatedAt || undefined,
  };
}

export default function Estatisticas() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moderation, setModeration] = useState<ModerationTransparency | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError('');
    const [statsResult, moderationResult] = await Promise.all([
      supabase.rpc('get_public_dashboard_stats'),
      supabase.rpc('get_public_moderation_transparency'),
    ]);
    if (statsResult.error) {
      console.error('Erro ao carregar dados agregados:', statsResult.error);
      setError('Não foi possível atualizar os dados agora.');
    } else {
      setStats(normalizeStats(statsResult.data));
    }
    if (moderationResult.error) {
      console.warn('Erro ao carregar transparência da moderação:', moderationResult.error);
      setModeration(null);
    } else if (moderationResult.data) {
      const value: any = moderationResult.data;
      setModeration({
        periodDays: Number(value.periodDays || 30),
        reportsReceived: Number(value.reportsReceived || 0),
        pendingNow: Number(value.pendingNow || 0),
        handled: Number(value.handled || 0),
        removed: Number(value.removed || 0),
        kept: Number(value.kept || 0),
        averageResponseHours: Number(value.averageResponseHours || 0),
        updatedAt: value.updatedAt || undefined,
      });
    }
    setLoading(false);
  };

  useEffect(() => { void loadStats(); }, []);

  const derived = useMemo(() => {
    if (!stats) return null;
    const resolutionRate = stats.totalReports > 0 ? (stats.resolved / stats.totalReports) * 100 : 0;
    const open = stats.pending + stats.inProgress;
    const maxDaily = Math.max(1, ...stats.dailyReports.map((item) => item.count));
    const mostCommon = stats.categories[0] || null;
    return { resolutionRate, open, maxDaily, mostCommon };
  }, [stats]);

  if (loading && !stats) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <Loader2 className="w-10 h-10 text-orange-700 animate-spin mb-4" />
        <p className="font-semibold text-slate-600 dark:text-slate-300">Calculando os dados da comunidade...</p>
      </div>
    );
  }

  if (!stats || !derived) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Activity className="w-16 h-16 text-slate-200 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Dados indisponíveis</h2>
        <p className="text-slate-500 max-w-sm mt-2">{error || 'Ainda não foi possível calcular os indicadores comunitários.'}</p>
        <button type="button" onClick={() => void loadStats()} className="mt-5 min-h-11 rounded-xl bg-orange-700 px-4 py-2.5 text-sm font-bold text-white inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" />Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-orange-700 dark:text-orange-300" />
            </div>
            Dados da Comunidade
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Indicadores calculados diretamente no banco, sem dados fictícios.</p>
        </div>
        <button type="button" onClick={() => void loadStats()} disabled={loading} className="min-h-11 self-start rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 disabled:opacity-60">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Atualizar
        </button>
      </div>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total de relatos', value: stats.totalReports, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { label: 'Resolvidos', value: stats.resolved, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-500/10' },
          { label: 'Taxa de solução', value: `${derived.resolutionRate.toFixed(1)}%`, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-500/10' },
          { label: 'Em aberto', value: derived.open, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
        ].map((item) => (
          <Card key={item.label} className="!p-4 flex flex-col items-center text-center">
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center mb-2', item.bg)}><item.icon className={cn('w-5 h-5', item.color)} /></div>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{item.value}</span>
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mt-1">{item.label}</span>
          </Card>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0"><CalendarDays className="w-6 h-6 text-violet-600" /></div>
          <div><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.upcomingEvents}</p><p className="text-sm font-bold text-slate-700 dark:text-slate-200">Eventos futuros</p><p className="text-xs text-slate-500 mt-0.5">{stats.eventsNext7Days} nos próximos 7 dias</p></div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0"><Briefcase className="w-6 h-6 text-blue-600" /></div>
          <div><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.activeJobs}</p><p className="text-sm font-bold text-slate-700 dark:text-slate-200">Vagas ativas</p><p className="text-xs text-slate-500 mt-0.5">Oportunidades ainda não expiradas</p></div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6"><PieChart className="w-4 h-4 text-orange-700" /> Relatos por categoria</h3>
          {stats.categories.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Ainda não existem relatos para comparar.</p> : <div className="space-y-4">
            {stats.categories.map(({ category, count }) => {
              const percentage = stats.totalReports > 0 ? (count / stats.totalReports) * 100 : 0;
              const categoryInfo = postCategories[category as keyof typeof postCategories] || { label: category, emoji: '❓' };
              return (
                <div key={category} className="space-y-1.5">
                  <div className="flex justify-between gap-3 text-xs font-bold"><span className="text-slate-700 dark:text-slate-300">{categoryInfo.emoji} {categoryInfo.label}</span><span className="text-slate-500">{count} · {percentage.toFixed(0)}%</span></div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-orange-600 rounded-full" style={{ width: `${Math.max(percentage, count > 0 ? 2 : 0)}%` }} /></div>
                </div>
              );
            })}
          </div>}
        </Card>

        <Card>
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6"><Clock className="w-4 h-4 text-orange-700" /> Situação dos relatos</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Aberto', count: stats.pending, cls: 'bg-amber-500' },
              { label: 'Em andamento', count: stats.inProgress, cls: 'bg-blue-500' },
              { label: 'Resolvido', count: stats.resolved, cls: 'bg-green-600' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 text-center"><div className={cn('w-3 h-3 rounded-full mx-auto mb-2', item.cls)} /><p className="text-xl font-black text-slate-900 dark:text-white">{item.count}</p><p className="text-[10px] sm:text-xs font-bold text-slate-500 mt-1">{item.label}</p></div>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4">
            <p className="text-xs font-bold text-slate-900 dark:text-white">Leitura rápida</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              {derived.mostCommon
                ? <>A categoria mais registrada é <strong>{postCategories[derived.mostCommon.category as keyof typeof postCategories]?.label || derived.mostCommon.category}</strong>, com {derived.mostCommon.count} relato{derived.mostCommon.count === 1 ? '' : 's'}.</>
                : 'Os primeiros relatos ainda estão sendo registrados.'}
            </p>
          </div>
        </Card>
      </div>

      {moderation && <Card className="!p-5 sm:!p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div><h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Transparência da moderação</h3><p className="text-xs text-slate-500 mt-1 max-w-2xl">Indicadores agregados dos últimos {moderation.periodDays} dias. Motivos, denunciantes e conteúdos individuais nunca aparecem aqui.</p></div>
          <span className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 self-start">Dados públicos agregados</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
          {[
            { label: 'Recebidas', value: moderation.reportsReceived, icon: AlertCircle, cls: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10' },
            { label: 'Analisadas', value: moderation.handled, icon: ShieldCheck, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
            { label: 'Removidos', value: moderation.removed, icon: Trash2, cls: 'text-red-600 bg-red-50 dark:bg-red-500/10' },
            { label: 'Mantidos', value: moderation.kept, icon: Eye, cls: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10' },
            { label: 'Pendentes agora', value: moderation.pendingNow, icon: Clock, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
          ].map(item => <div key={item.label} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-900/40"><div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', item.cls)}><item.icon className="w-4 h-4" /></div><p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{item.value}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p></div>)}
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"><div><p className="text-xs font-bold text-slate-800 dark:text-slate-200">Tempo médio de análise</p><p className="text-[11px] text-slate-500">Calculado somente sobre denúncias concluídas no período.</p></div><p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{moderation.averageResponseHours < 1 ? '< 1 hora' : moderation.averageResponseHours < 24 ? `${moderation.averageResponseHours.toFixed(1)} h` : `${(moderation.averageResponseHours / 24).toFixed(1)} dias`}</p></div>
      </Card>}

      <Card>
        <div className="flex items-center justify-between gap-3 mb-5"><div><h3 className="font-bold text-slate-900 dark:text-white">Novos relatos nos últimos 7 dias</h3><p className="text-xs text-slate-500 mt-1">Contagem diária diretamente do banco</p></div><TrendingUp className="w-5 h-5 text-orange-700" /></div>
        <div className="grid grid-cols-7 gap-2 h-44 items-end">
          {stats.dailyReports.map((item) => {
            const height = (item.count / derived.maxDaily) * 100;
            const date = item.date ? new Date(`${item.date}T12:00:00`) : null;
            return (
              <div key={item.date} className="h-full flex flex-col justify-end items-center gap-2 min-w-0">
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">{item.count}</span>
                <div className="w-full max-w-10 rounded-t-lg bg-orange-600 min-h-1" style={{ height: `${Math.max(height, item.count > 0 ? 8 : 2)}%` }} />
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">{date ? date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') : '-'}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="text-center text-[10px] text-slate-400 uppercase tracking-[0.16em] font-bold">Dados agregados · nenhuma informação pessoal é exibida</p>
    </div>
  );
}
