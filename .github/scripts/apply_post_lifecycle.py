from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


path = 'src/pages/Estatisticas.tsx'
text = read(path)
text = replace_once(
    text,
    "  Clock, AlertCircle, TrendingUp, CalendarDays, Briefcase, Loader2, RefreshCw,\n",
    "  Clock, AlertCircle, TrendingUp, CalendarDays, Briefcase, Loader2, RefreshCw, ShieldCheck, Trash2, Eye,\n",
    'transparency icons',
)
text = replace_once(
    text,
    "type DailyStat = { date: string; count: number };\n",
    "type DailyStat = { date: string; count: number };\ntype ModerationTransparency = { periodDays: number; reportsReceived: number; pendingNow: number; handled: number; removed: number; kept: number; averageResponseHours: number; updatedAt?: string };\n",
    'transparency type',
)
text = replace_once(
    text,
    "  const [error, setError] = useState('');\n",
    "  const [error, setError] = useState('');\n  const [moderation, setModeration] = useState<ModerationTransparency | null>(null);\n",
    'transparency state',
)
old_load = """    const { data, error: queryError } = await supabase.rpc('get_public_dashboard_stats');
    if (queryError) {
      console.error('Erro ao carregar dados agregados:', queryError);
      setError('Não foi possível atualizar os dados agora.');
    } else {
      setStats(normalizeStats(data));
    }
    setLoading(false);"""
new_load = """    const [statsResult, moderationResult] = await Promise.all([
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
    setLoading(false);"""
text = replace_once(text, old_load, new_load, 'load transparency')

marker = """      <Card>
        <div className=\"flex items-center justify-between gap-3 mb-5\"><div><h3 className=\"font-bold text-slate-900 dark:text-white\">Novos relatos nos últimos 7 dias</h3><p className=\"text-xs text-slate-500 mt-1\">Contagem diária diretamente do banco</p></div><TrendingUp className=\"w-5 h-5 text-orange-700\" /></div>"""
transparency = """      {moderation && <Card className=\"!p-5 sm:!p-6\">
        <div className=\"flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5\">
          <div><h3 className=\"font-bold text-slate-900 dark:text-white flex items-center gap-2\"><ShieldCheck className=\"w-5 h-5 text-emerald-600\" /> Transparência da moderação</h3><p className=\"text-xs text-slate-500 mt-1 max-w-2xl\">Indicadores agregados dos últimos {moderation.periodDays} dias. Motivos, denunciantes e conteúdos individuais nunca aparecem aqui.</p></div>
          <span className=\"rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 self-start\">Dados públicos agregados</span>
        </div>
        <div className=\"grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3\">
          {[
            { label: 'Recebidas', value: moderation.reportsReceived, icon: AlertCircle, cls: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10' },
            { label: 'Analisadas', value: moderation.handled, icon: ShieldCheck, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
            { label: 'Removidos', value: moderation.removed, icon: Trash2, cls: 'text-red-600 bg-red-50 dark:bg-red-500/10' },
            { label: 'Mantidos', value: moderation.kept, icon: Eye, cls: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10' },
            { label: 'Pendentes agora', value: moderation.pendingNow, icon: Clock, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
          ].map(item => <div key={item.label} className=\"rounded-xl border border-slate-100 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-900/40\"><div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', item.cls)}><item.icon className=\"w-4 h-4\" /></div><p className=\"mt-2 text-xl font-black text-slate-900 dark:text-white\">{item.value}</p><p className=\"text-[10px] font-bold uppercase tracking-wide text-slate-500\">{item.label}</p></div>)}
        </div>
        <div className=\"mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2\"><div><p className=\"text-xs font-bold text-slate-800 dark:text-slate-200\">Tempo médio de análise</p><p className=\"text-[11px] text-slate-500\">Calculado somente sobre denúncias concluídas no período.</p></div><p className=\"text-lg font-black text-emerald-700 dark:text-emerald-300\">{moderation.averageResponseHours < 1 ? '< 1 hora' : moderation.averageResponseHours < 24 ? `${moderation.averageResponseHours.toFixed(1)} h` : `${(moderation.averageResponseHours / 24).toFixed(1)} dias`}</p></div>
      </Card>}

""" + marker
text = replace_once(text, marker, transparency, 'transparency card')
write(path, text)

migration = r'''create or replace function public.get_public_moderation_transparency()
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $$
  with recent as (
    select * from public.content_reports where created_at >= now() - interval '30 days'
  ), handled as (
    select * from public.content_reports
    where status in ('resolved','ignored') and archived_at is not null and archived_at >= now() - interval '30 days'
  )
  select jsonb_build_object(
    'periodDays', 30,
    'reportsReceived', (select count(*) from recent),
    'pendingNow', (select count(*) from public.content_reports where status = 'pending'),
    'handled', (select count(*) from handled),
    'removed', (select count(*) from handled where status = 'resolved'),
    'kept', (select count(*) from handled where status = 'ignored'),
    'averageResponseHours', coalesce((select round(avg(extract(epoch from (archived_at - created_at)) / 3600.0)::numeric, 1) from handled where archived_at >= created_at), 0),
    'updatedAt', now()
  );
$$;
revoke all on function public.get_public_moderation_transparency() from public;
grant execute on function public.get_public_moderation_transparency() to anon, authenticated;
'''
write('database/20260817_public_moderation_transparency.sql', migration)

print('Public moderation transparency upgrade applied successfully.')
