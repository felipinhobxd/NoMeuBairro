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


# Notification model
path = 'src/types/index.ts'
text = read(path)
text = replace_once(
    text,
    "  | 'application_contacted'\n  | 'event_attendance';",
    "  | 'application_contacted'\n  | 'event_attendance'\n  | 'neighborhood_post'\n  | 'neighborhood_event'\n  | 'neighborhood_job';",
    'notification type union',
)
write(path, text)

# Notification wording and destinations
path = 'src/utils/notificationActivity.ts'
text = read(path)
text = replace_once(
    text,
    "    case 'event_attendance':\n      return `${actor} confirmou presença no seu evento`;",
    "    case 'event_attendance':\n      return `${actor} confirmou presença no seu evento`;\n    case 'neighborhood_post':\n      return `${actor} publicou um novo relato em um bairro que você segue`;\n    case 'neighborhood_event':\n      return `${actor} publicou um novo evento em um bairro que você segue`;\n    case 'neighborhood_job':\n      return 'Nova vaga publicada em um bairro que você segue';",
    'notification messages',
)
text = replace_once(
    text,
    "    case 'post_resolved': return 'Ver relato';\n    default: return 'Ver publicação';",
    "    case 'post_resolved':\n    case 'neighborhood_post': return 'Ver relato';\n    case 'neighborhood_event': return 'Ver evento';\n    case 'neighborhood_job': return 'Ver vaga';\n    default: return 'Ver publicação';",
    'notification action labels',
)
text = replace_once(
    text,
    "  if (notification.postId && ['support', 'comment', 'reply', 'post_resolved'].includes(notification.type)) {",
    "  if (notification.postId && ['support', 'comment', 'reply', 'post_resolved', 'neighborhood_post'].includes(notification.type)) {",
    'notification post destination',
)
text = replace_once(
    text,
    "  if (notification.type === 'event_attendance') {\n    try {\n      if (notification.eventId) sessionStorage.setItem('anb-focus-event', notification.eventId);\n    } catch {}\n    return '/mural';\n  }",
    "  if (notification.type === 'event_attendance' || notification.type === 'neighborhood_event') {\n    try {\n      if (notification.eventId) sessionStorage.setItem('anb-focus-event', notification.eventId);\n    } catch {}\n    return '/mural';\n  }\n\n  if (notification.type === 'neighborhood_job') {\n    try {\n      if (notification.jobId) sessionStorage.setItem('anb-focus-job', notification.jobId);\n    } catch {}\n    return '/empregos';\n  }",
    'notification event/job destinations',
)
write(path, text)

# Notification icons and empty-state copy
path = 'src/pages/Notifications.tsx'
text = read(path)
text = replace_once(
    text,
    "  CheckCircle2, Briefcase, Eye, PhoneCall, CalendarCheck,\n",
    "  CheckCircle2, Briefcase, Eye, PhoneCall, CalendarCheck, MapPin,\n",
    'notification map icon import',
)
text = replace_once(
    text,
    "    case 'event_attendance': return <CalendarCheck className=\"w-4 h-4 text-purple-600\" />;",
    "    case 'event_attendance': return <CalendarCheck className=\"w-4 h-4 text-purple-600\" />;\n    case 'neighborhood_post': return <MapPin className=\"w-4 h-4 text-orange-600\" />;\n    case 'neighborhood_event': return <CalendarCheck className=\"w-4 h-4 text-violet-600\" />;\n    case 'neighborhood_job': return <Briefcase className=\"w-4 h-4 text-blue-600\" />;",
    'notification local activity icons',
)
text = replace_once(
    text,
    'description="Apoios, comentários, respostas, candidaturas, eventos e outras atividades importantes aparecerão aqui."',
    'description="Apoios, comentários, respostas e novidades dos bairros que você segue aparecerão aqui."',
    'notification empty state',
)
write(path, text)

# Feed follow control
path = 'src/pages/Feed.tsx'
text = read(path)
text = replace_once(
    text,
    "  Trash2, Bus, Shield, HelpCircle, CornerDownRight, Send, X, Search, UserCheck, Sparkles, RefreshCw, ExternalLink, Share2,\n",
    "  Trash2, Bus, Shield, HelpCircle, CornerDownRight, Send, X, Search, UserCheck, Sparkles, RefreshCw, ExternalLink, Share2, Bell,\n",
    'feed bell icon',
)
text = replace_once(
    text,
    "  const [canModerate, setCanModerate] = useState(false);\n",
    "  const [canModerate, setCanModerate] = useState(false);\n  const [isFollowingNeighborhood, setIsFollowingNeighborhood] = useState(false);\n  const [followLoading, setFollowLoading] = useState(false);\n",
    'feed follow state',
)
moderator_effect = """  useEffect(() => {\n    let active = true;\n    if (!user?.id) { setCanModerate(false); return () => { active = false; }; }\n    void supabase.from('app_roles').select('role').eq('user_id', user.id).maybeSingle().then(({ data }) => {\n      if (!active) return;\n      setCanModerate(data?.role === 'admin' || data?.role === 'moderator');\n    });\n    return () => { active = false; };\n  }, [user?.id]);\n"""
follow_effect = moderator_effect + """\n  useEffect(() => {\n    let active = true;\n    if (!user?.id || !isNeighborhoodSelected || !currentNeighborhood.name) {\n      setIsFollowingNeighborhood(false);\n      setFollowLoading(false);\n      return () => { active = false; };\n    }\n    setFollowLoading(true);\n    const kind = currentNeighborhood.kind === 'locality' ? 'locality' : 'official';\n    void supabase.from('neighborhood_follows')\n      .select('area')\n      .eq('user_id', user.id)\n      .eq('area', currentNeighborhood.name)\n      .eq('kind', kind)\n      .maybeSingle()\n      .then(({ data, error }) => {\n        if (!active) return;\n        if (error) console.warn('Não foi possível verificar o bairro seguido:', error);\n        setIsFollowingNeighborhood(Boolean(data));\n        setFollowLoading(false);\n      });\n    return () => { active = false; };\n  }, [user?.id, isNeighborhoodSelected, currentNeighborhood.name, currentNeighborhood.kind]);\n"""
text = replace_once(text, moderator_effect, follow_effect, 'feed follow query effect')
share_handler = """  const handleSharePost = useCallback(async (post: { id: string; title: string; description: string }) => { const result = await shareContent({ title: `${post.title} · No Meu Bairro`, text: post.description.slice(0, 180), url: `/post/${post.id}` }); if (result === 'copied') toast('Link do relato copiado!'); else if (result === 'failed') toast('Não foi possível compartilhar este relato.', 'error'); }, [toast]);\n"""
toggle_handler = share_handler + """  const toggleNeighborhoodFollow = useCallback(async () => {\n    if (!isNeighborhoodSelected || !currentNeighborhood.name) { toast('Selecione um bairro para acompanhá-lo.', 'info'); return; }\n    if (!user?.id) { toast('Entre ou crie uma conta para seguir bairros.', 'info'); navigate('/login'); return; }\n    if (followLoading) return;\n    setFollowLoading(true);\n    const area = currentNeighborhood.name;\n    const kind = currentNeighborhood.kind === 'locality' ? 'locality' : 'official';\n    try {\n      const request = isFollowingNeighborhood\n        ? supabase.from('neighborhood_follows').delete().eq('user_id', user.id).eq('area', area).eq('kind', kind)\n        : supabase.from('neighborhood_follows').insert({ user_id: user.id, area, kind });\n      const { error } = await request;\n      if (error) { toast(error.message || 'Não foi possível atualizar o bairro seguido.', 'error'); return; }\n      setIsFollowingNeighborhood(!isFollowingNeighborhood);\n      toast(isFollowingNeighborhood ? `Você deixou de seguir ${area}.` : `Agora você segue ${area}.`);\n    } finally {\n      setFollowLoading(false);\n    }\n  }, [isNeighborhoodSelected, currentNeighborhood.name, currentNeighborhood.kind, user?.id, followLoading, isFollowingNeighborhood, navigate, toast]);\n"""
text = replace_once(text, share_handler, toggle_handler, 'feed follow toggle handler')
old_header = """      <div className=\"flex items-start justify-between gap-4\"><div><h1 className=\"text-2xl font-bold text-slate-900 dark:text-white tracking-tight\">Relatos Comunitários</h1><p className=\"text-sm text-slate-500 dark:text-slate-400 mt-1\">{isNeighborhoodSelected ? <>Bairro selecionado: <strong className=\"text-emerald-600 dark:text-emerald-400\">{displayNeighborhood}</strong></> : <>Mostrando relatos de <strong className=\"text-emerald-600 dark:text-emerald-400\">todos os bairros</strong></>}</p></div><button onClick={() => { fetchData(); toast('Atualizando relatos...', 'info'); }} disabled={loading} className=\"mt-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all active:scale-90 disabled:opacity-50\" aria-label=\"Atualizar relatos\"><RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} /></button></div>\n"""
new_header = """      <div className=\"flex items-start justify-between gap-3 sm:gap-4\"><div className=\"min-w-0\"><h1 className=\"text-2xl font-bold text-slate-900 dark:text-white tracking-tight\">Relatos Comunitários</h1><p className=\"text-sm text-slate-500 dark:text-slate-400 mt-1\">{isNeighborhoodSelected ? <>Bairro selecionado: <strong className=\"text-emerald-600 dark:text-emerald-400\">{displayNeighborhood}</strong></> : <>Mostrando relatos de <strong className=\"text-emerald-600 dark:text-emerald-400\">todos os bairros</strong></>}</p>{isNeighborhoodSelected && <p className=\"text-[11px] text-slate-400 mt-1\">Siga este bairro para receber novidades no No Meu Bairro.</p>}</div><div className=\"flex items-center gap-2 shrink-0\">{isNeighborhoodSelected && <button type=\"button\" onClick={() => void toggleNeighborhoodFollow()} disabled={followLoading} className={cn('min-h-10 inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl text-xs font-bold ring-1 transition-all disabled:opacity-60', isFollowingNeighborhood ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20' : 'bg-white text-slate-600 ring-slate-200 hover:text-emerald-700 hover:ring-emerald-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800')} aria-pressed={isFollowingNeighborhood} title={isFollowingNeighborhood ? `Deixar de seguir ${displayNeighborhood}` : `Seguir ${displayNeighborhood}`}><Bell className={cn('w-4 h-4', isFollowingNeighborhood && 'fill-current')} /><span className=\"hidden sm:inline\">{followLoading ? 'Salvando...' : isFollowingNeighborhood ? 'Seguindo' : 'Seguir bairro'}</span></button>}<button onClick={() => { fetchData(); toast('Atualizando relatos...', 'info'); }} disabled={loading} className=\"p-2.5 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all active:scale-90 disabled:opacity-50\" aria-label=\"Atualizar relatos\"><RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} /></button></div></div>\n"""
text = replace_once(text, old_header, new_header, 'feed follow header control')
write(path, text)

migration = r'''create table if not exists public.neighborhood_follows (
  user_id uuid not null references public.users(id) on delete cascade,
  area text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, area, kind),
  constraint neighborhood_follows_area_check check (char_length(trim(area)) between 2 and 100),
  constraint neighborhood_follows_kind_check check (kind = any (array['official'::text, 'locality'::text]))
);

create index if not exists idx_neighborhood_follows_area on public.neighborhood_follows (kind, area);
alter table public.neighborhood_follows enable row level security;
revoke all on table public.neighborhood_follows from anon, authenticated;
grant select, insert, delete on table public.neighborhood_follows to authenticated;

drop policy if exists neighborhood_follows_select_own on public.neighborhood_follows;
create policy neighborhood_follows_select_own on public.neighborhood_follows for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists neighborhood_follows_insert_own on public.neighborhood_follows;
create policy neighborhood_follows_insert_own on public.neighborhood_follows for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists neighborhood_follows_delete_own on public.neighborhood_follows;
create policy neighborhood_follows_delete_own on public.neighborhood_follows for delete to authenticated using ((select auth.uid()) = user_id);

create unique index if not exists notifications_neighborhood_post_unique on public.notifications (user_id, post_id, type) where type = 'neighborhood_post' and post_id is not null;
create unique index if not exists notifications_neighborhood_event_unique on public.notifications (user_id, event_id, type) where type = 'neighborhood_event' and event_id is not null;
create unique index if not exists notifications_neighborhood_job_unique on public.notifications (user_id, job_id, type) where type = 'neighborhood_job' and job_id is not null;

create or replace function public.notify_neighborhood_followers_post()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  if new.is_anonymous is true then return new; end if;
  insert into public.notifications(user_id, actor_id, type, post_id)
  select f.user_id, new.author_id, 'neighborhood_post', new.id
  from public.neighborhood_follows f
  where ((f.kind = 'official' and new.neighborhood is not null and f.area = new.neighborhood)
      or (f.kind = 'locality' and new.locality is not null and f.area = new.locality))
    and f.user_id is distinct from new.author_id
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.notify_neighborhood_followers_event()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  insert into public.notifications(user_id, actor_id, type, event_id)
  select f.user_id, new.created_by, 'neighborhood_event', new.id
  from public.neighborhood_follows f
  where ((f.kind = 'official' and new.neighborhood is not null and f.area = new.neighborhood)
      or (f.kind = 'locality' and new.locality is not null and f.area = new.locality))
    and f.user_id is distinct from new.created_by
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.notify_neighborhood_followers_job()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  if new.is_active is not true then return new; end if;
  insert into public.notifications(user_id, actor_id, type, job_id)
  select f.user_id, null, 'neighborhood_job', new.id
  from public.neighborhood_follows f
  where ((f.kind = 'official' and new.neighborhood is not null and f.area = new.neighborhood)
      or (f.kind = 'locality' and new.locality is not null and f.area = new.locality))
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.notify_neighborhood_followers_post() from public, anon, authenticated;
revoke all on function public.notify_neighborhood_followers_event() from public, anon, authenticated;
revoke all on function public.notify_neighborhood_followers_job() from public, anon, authenticated;

drop trigger if exists trg_notify_neighborhood_followers_post on public.posts;
create trigger trg_notify_neighborhood_followers_post after insert on public.posts for each row execute function public.notify_neighborhood_followers_post();
drop trigger if exists trg_notify_neighborhood_followers_event on public.events;
create trigger trg_notify_neighborhood_followers_event after insert on public.events for each row execute function public.notify_neighborhood_followers_event();
drop trigger if exists trg_notify_neighborhood_followers_job on public.job_posts;
create trigger trg_notify_neighborhood_followers_job after insert on public.job_posts for each row execute function public.notify_neighborhood_followers_job();
'''
write('database/20260817_neighborhood_follows.sql', migration)

print('Neighborhood follow upgrade applied successfully.')
