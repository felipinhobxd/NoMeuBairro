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
        raise RuntimeError(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


path = 'src/pages/Feed.tsx'
text = read(path)
text = replace_once(
    text,
    "  Trash2, Bus, Shield, HelpCircle, CornerDownRight, Send, X, Search, UserCheck, Sparkles, RefreshCw, ExternalLink, Share2, Bell,\n",
    "  Trash2, Bus, Shield, HelpCircle, CornerDownRight, Send, X, Search, UserCheck, Sparkles, RefreshCw, ExternalLink, Share2, Bell, CheckCircle2, CalendarDays, Briefcase,\n",
    'summary icons',
)
text = replace_once(
    text,
    "const CREATE_POST_INTENT_KEY = 'nmb-after-login-action';\n",
    "const CREATE_POST_INTENT_KEY = 'nmb-after-login-action';\n\ntype NeighborhoodWeeklySummary = {\n  area: string;\n  newReports: number;\n  previousReports: number;\n  resolvedReports: number;\n  upcomingEvents: number;\n  newJobs: number;\n  topCategory?: PostCategory | null;\n  topCategoryCount: number;\n  updatedAt?: string;\n};\n",
    'summary type',
)
text = replace_once(
    text,
    "  const [followLoading, setFollowLoading] = useState(false);\n",
    "  const [followLoading, setFollowLoading] = useState(false);\n  const [neighborhoodSummary, setNeighborhoodSummary] = useState<NeighborhoodWeeklySummary | null>(null);\n  const [summaryLoading, setSummaryLoading] = useState(false);\n",
    'summary state',
)
follow_effect_end = """  useEffect(() => {\n    let active = true;\n    if (!user?.id || !isNeighborhoodSelected || !currentNeighborhood.name) {\n      setIsFollowingNeighborhood(false);\n      setFollowLoading(false);\n      return () => { active = false; };\n    }\n    setFollowLoading(true);\n    const kind = currentNeighborhood.kind === 'locality' ? 'locality' : 'official';\n    void supabase.from('neighborhood_follows')\n      .select('area')\n      .eq('user_id', user.id)\n      .eq('area', currentNeighborhood.name)\n      .eq('kind', kind)\n      .maybeSingle()\n      .then(({ data, error }) => {\n        if (!active) return;\n        if (error) console.warn('Não foi possível verificar o bairro seguido:', error);\n        setIsFollowingNeighborhood(Boolean(data));\n        setFollowLoading(false);\n      });\n    return () => { active = false; };\n  }, [user?.id, isNeighborhoodSelected, currentNeighborhood.name, currentNeighborhood.kind]);\n"""
summary_effect = follow_effect_end + """\n  useEffect(() => {\n    let active = true;\n    if (!isNeighborhoodSelected || !currentNeighborhood.name) {\n      setNeighborhoodSummary(null);\n      setSummaryLoading(false);\n      return () => { active = false; };\n    }\n    setSummaryLoading(true);\n    const p_kind = currentNeighborhood.kind === 'locality' ? 'locality' : 'official';\n    void supabase.rpc('get_neighborhood_weekly_summary', { p_area: currentNeighborhood.name, p_kind })\n      .then(({ data, error }) => {\n        if (!active) return;\n        if (error) {\n          console.warn('Não foi possível carregar o resumo do bairro:', error);\n          setNeighborhoodSummary(null);\n        } else {\n          setNeighborhoodSummary(data as NeighborhoodWeeklySummary);\n        }\n        setSummaryLoading(false);\n      });\n    return () => { active = false; };\n  }, [isNeighborhoodSelected, currentNeighborhood.name, currentNeighborhood.kind]);\n"""
text = replace_once(text, follow_effect_end, summary_effect, 'summary load effect')
text = replace_once(
    text,
    "  const displayNeighborhood = currentNeighborhood.name || 'Todos os bairros';\n",
    "  const displayNeighborhood = currentNeighborhood.name || 'Todos os bairros';\n  const reportDelta = neighborhoodSummary ? neighborhoodSummary.newReports - neighborhoodSummary.previousReports : 0;\n  const topSummaryCategory = neighborhoodSummary?.topCategory ? postCategories[neighborhoodSummary.topCategory] : null;\n",
    'summary derived values',
)
header_end = """      <div className=\"flex items-start justify-between gap-3 sm:gap-4\"><div className=\"min-w-0\"><h1 className=\"text-2xl font-bold text-slate-900 dark:text-white tracking-tight\">Relatos Comunitários</h1><p className=\"text-sm text-slate-500 dark:text-slate-400 mt-1\">{isNeighborhoodSelected ? <>Bairro selecionado: <strong className=\"text-emerald-600 dark:text-emerald-400\">{displayNeighborhood}</strong></> : <>Mostrando relatos de <strong className=\"text-emerald-600 dark:text-emerald-400\">todos os bairros</strong></>}</p>{isNeighborhoodSelected && <p className=\"text-[11px] text-slate-400 mt-1\">Siga este bairro para receber novidades no No Meu Bairro.</p>}</div><div className=\"flex items-center gap-2 shrink-0\">{isNeighborhoodSelected && <button type=\"button\" onClick={() => void toggleNeighborhoodFollow()} disabled={followLoading} className={cn('min-h-10 inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl text-xs font-bold ring-1 transition-all disabled:opacity-60', isFollowingNeighborhood ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20' : 'bg-white text-slate-600 ring-slate-200 hover:text-emerald-700 hover:ring-emerald-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800')} aria-pressed={isFollowingNeighborhood} title={isFollowingNeighborhood ? `Deixar de seguir ${displayNeighborhood}` : `Seguir ${displayNeighborhood}`}><Bell className={cn('w-4 h-4', isFollowingNeighborhood && 'fill-current')} /><span className=\"hidden sm:inline\">{followLoading ? 'Salvando...' : isFollowingNeighborhood ? 'Seguindo' : 'Seguir bairro'}</span></button>}<button onClick={() => { fetchData(); toast('Atualizando relatos...', 'info'); }} disabled={loading} className=\"p-2.5 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all active:scale-90 disabled:opacity-50\" aria-label=\"Atualizar relatos\"><RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} /></button></div></div>\n"""
summary_card = header_end + """      {isNeighborhoodSelected && (\n        <Card className=\"!p-4 sm:!p-5 !bg-gradient-to-br !from-emerald-50/80 !to-white dark:!from-emerald-500/5 dark:!to-slate-900 !ring-emerald-100 dark:!ring-emerald-500/15\">\n          <div className=\"flex items-start justify-between gap-3\">\n            <div><p className=\"text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400\">O que mudou no seu bairro</p><h2 className=\"mt-1 text-base font-bold text-slate-900 dark:text-white\">{displayNeighborhood} · últimos 7 dias</h2></div>\n            {!summaryLoading && neighborhoodSummary && <span className={cn('shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold', reportDelta > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' : reportDelta < 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}>{reportDelta === 0 ? 'volume estável' : `${reportDelta > 0 ? '+' : ''}${reportDelta} relato${Math.abs(reportDelta) === 1 ? '' : 's'} vs. semana anterior`}</span>}\n          </div>\n          {summaryLoading ? (\n            <div className=\"mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2\">{[0,1,2,3].map(item => <div key={item} className=\"h-16 rounded-xl bg-white/70 dark:bg-slate-800/60 animate-pulse\" />)}</div>\n          ) : neighborhoodSummary ? (\n            <>\n              <div className=\"mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2\">\n                {[\n                  { label: 'Novos relatos', value: neighborhoodSummary.newReports, icon: MessageSquare, cls: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10' },\n                  { label: 'Resolvidos', value: neighborhoodSummary.resolvedReports, icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },\n                  { label: 'Eventos próximos', value: neighborhoodSummary.upcomingEvents, icon: CalendarDays, cls: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10' },\n                  { label: 'Novas vagas', value: neighborhoodSummary.newJobs, icon: Briefcase, cls: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10' },\n                ].map(item => <div key={item.label} className=\"rounded-xl bg-white/80 dark:bg-slate-900/70 p-3 ring-1 ring-slate-100 dark:ring-slate-800\"><div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', item.cls)}><item.icon className=\"w-4 h-4\" /></div><p className=\"mt-2 text-xl font-black text-slate-900 dark:text-white\">{item.value}</p><p className=\"text-[10px] font-bold uppercase tracking-wide text-slate-500\">{item.label}</p></div>)}\n              </div>\n              {topSummaryCategory && neighborhoodSummary.topCategoryCount > 0 && <p className=\"mt-3 text-xs text-slate-500 dark:text-slate-400\">Tema mais relatado na semana: <strong className=\"text-slate-700 dark:text-slate-200\">{topSummaryCategory.emoji} {topSummaryCategory.label}</strong> ({neighborhoodSummary.topCategoryCount}).</p>}\n            </>\n          ) : <p className=\"mt-3 text-xs text-slate-400\">O resumo deste bairro está temporariamente indisponível.</p>}\n        </Card>\n      )}\n"""
text = replace_once(text, header_end, summary_card, 'summary card')
write(path, text)

migration = r'''create or replace function public.get_neighborhood_weekly_summary(p_area text, p_kind text default 'official')
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_area text := trim(coalesce(p_area, ''));
  v_kind text := coalesce(p_kind, 'official');
  v_result jsonb;
begin
  if char_length(v_area) < 2 or v_kind not in ('official', 'locality') then
    return jsonb_build_object('area', v_area, 'newReports', 0, 'previousReports', 0, 'resolvedReports', 0, 'upcomingEvents', 0, 'newJobs', 0, 'topCategory', null, 'topCategoryCount', 0, 'updatedAt', now());
  end if;

  with recent_posts as (
    select p.id, p.category from public.posts p
    where p.is_anonymous is false and p.created_at >= now() - interval '7 days'
      and ((v_kind = 'official' and p.neighborhood = v_area) or (v_kind = 'locality' and p.locality = v_area))
  ), previous_posts as (
    select p.id from public.posts p
    where p.is_anonymous is false and p.created_at >= now() - interval '14 days' and p.created_at < now() - interval '7 days'
      and ((v_kind = 'official' and p.neighborhood = v_area) or (v_kind = 'locality' and p.locality = v_area))
  ), resolved_posts as (
    select distinct p.id from public.post_status_history h join public.posts p on p.id = h.post_id
    where h.new_status = 'resolved'::public.post_status and h.changed_at >= now() - interval '7 days' and p.is_anonymous is false
      and ((v_kind = 'official' and p.neighborhood = v_area) or (v_kind = 'locality' and p.locality = v_area))
  ), upcoming_events as (
    select e.id from public.events e
    where e.event_date >= current_date and e.event_date <= current_date + 7
      and ((v_kind = 'official' and e.neighborhood = v_area) or (v_kind = 'locality' and e.locality = v_area))
  ), new_jobs as (
    select j.id from public.job_posts j
    where j.is_active is true and j.created_at >= now() - interval '7 days' and (j.expires_at is null or j.expires_at >= current_date)
      and ((v_kind = 'official' and j.neighborhood = v_area) or (v_kind = 'locality' and j.locality = v_area))
  ), top_category as (
    select rp.category, count(*)::int as amount from recent_posts rp group by rp.category order by count(*) desc, rp.category limit 1
  )
  select jsonb_build_object(
    'area', v_area,
    'newReports', (select count(*) from recent_posts),
    'previousReports', (select count(*) from previous_posts),
    'resolvedReports', (select count(*) from resolved_posts),
    'upcomingEvents', (select count(*) from upcoming_events),
    'newJobs', (select count(*) from new_jobs),
    'topCategory', (select category::text from top_category),
    'topCategoryCount', coalesce((select amount from top_category), 0),
    'updatedAt', now()
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_neighborhood_weekly_summary(text, text) from public;
grant execute on function public.get_neighborhood_weekly_summary(text, text) to anon, authenticated;
'''
write('database/20260817_neighborhood_weekly_summary.sql', migration)

print('Weekly neighborhood summary upgrade applied successfully.')
