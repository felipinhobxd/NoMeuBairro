from pathlib import Path
import re

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


# 1) Shared status wording: the persisted enum stays `pending` for compatibility,
# but the product language is now "Aberto".
ui_path = 'src/components/UI.tsx'
ui = read(ui_path)
ui = replace_once(
    ui,
    "pending: { label: 'Pendente', cls:",
    "pending: { label: 'Aberto', cls:",
    'UI pending label',
)
write(ui_path, ui)

stats_path = 'src/pages/Estatisticas.tsx'
stats = read(stats_path)
stats = replace_once(
    stats,
    "{ label: 'Pendente', count: stats.pending, cls: 'bg-amber-500' },",
    "{ label: 'Aberto', count: stats.pending, cls: 'bg-amber-500' },",
    'Stats pending label',
)
write(stats_path, stats)

# 2) Feed: moderators can manage lifecycle, and wording becomes clearer.
feed_path = 'src/pages/Feed.tsx'
feed = read(feed_path)
feed = replace_once(
    feed,
    "import { cn } from '../utils/cn';\n",
    "import { cn } from '../utils/cn';\nimport { supabase } from '../utils/supabase';\n",
    'Feed supabase import',
)
feed = replace_once(
    feed,
    "{ id: 'all', label: 'Todos' }, { id: 'pending', label: 'Pendente' },",
    "{ id: 'all', label: 'Todos' }, { id: 'pending', label: 'Aberto' },",
    'Feed status filter label',
)
feed = replace_once(
    feed,
    "  const [fi, setFi] = useState('');\n",
    "  const [fi, setFi] = useState('');\n  const [canModerate, setCanModerate] = useState(false);\n",
    'Feed moderator state',
)
intent_effect = """  useEffect(() => {\n    if (!isAuthenticated || !user) return;\n    try {\n      if (sessionStorage.getItem(CREATE_POST_INTENT_KEY) === 'create-post') {\n        sessionStorage.removeItem(CREATE_POST_INTENT_KEY);\n        setShowCreate(true);\n      }\n    } catch {}\n  }, [isAuthenticated, user]);\n"""
moderator_effect = intent_effect + """\n  useEffect(() => {\n    let active = true;\n    if (!user?.id) { setCanModerate(false); return () => { active = false; }; }\n    void supabase.from('app_roles').select('role').eq('user_id', user.id).maybeSingle().then(({ data }) => {\n      if (!active) return;\n      setCanModerate(data?.role === 'admin' || data?.role === 'moderator');\n    });\n    return () => { active = false; };\n  }, [user?.id]);\n"""
feed = replace_once(feed, intent_effect, moderator_effect, 'Feed moderator effect')
feed = replace_once(
    feed,
    "const labels: Record<string, string> = { pending: 'Pendente', in_progress: 'Em andamento', resolved: 'Resolvido' };",
    "const labels: Record<string, string> = { pending: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido' };",
    'Feed toast status label',
)
feed = replace_once(
    feed,
    "            const resolvedArea = post.locality && post.neighborhood ? `${post.locality} · ${post.neighborhood}` : post.locality || post.neighborhood;\n            return <Card",
    "            const resolvedArea = post.locality && post.neighborhood ? `${post.locality} · ${post.neighborhood}` : post.locality || post.neighborhood;\n            const canManageStatus = isMyPost(post) || canModerate;\n            return <Card",
    'Feed canManageStatus',
)
feed = replace_once(
    feed,
    "</button>{isMyPost(post) && <div className=\"flex items-center gap-1.5 ml-auto overflow-x-auto no-scrollbar pb-1\">",
    "</button>{canManageStatus && <div className=\"flex items-center gap-1.5 ml-auto overflow-x-auto no-scrollbar pb-1\">",
    'Feed status manager visibility',
)
feed = replace_once(
    feed,
    ">Pendente</button>}{post.status !== 'in_progress'",
    ">Aberto</button>}{post.status !== 'in_progress'",
    'Feed open button label',
)
write(feed_path, feed)

# 3) DataContext: anonymous owners continue using the protected Edge Function,
# while moderators can update anonymous posts directly through RLS.
data_path = 'src/contexts/DataContext.tsx'
data = read(data_path)
pattern = re.compile(
    r"  const updatePostStatus = useCallback\(async \(postId: string, status: PostStatus\): Promise<ActionResult> => \{.*?\n  \}, \[posts, getAnonTokens\]\);",
    re.S,
)
replacement = """  const updatePostStatus = useCallback(async (postId: string, status: PostStatus): Promise<ActionResult> => {\n    const target = posts.find(post => post.id === postId);\n    let isAnonymous = target?.authorId === 'anonymous';\n    if (!target) {\n      const { data: row, error: lookupError } = await supabase.from('posts').select('is_anonymous').eq('id', postId).maybeSingle();\n      if (lookupError) return { ok: false, error: lookupError.message };\n      isAnonymous = Boolean(row?.is_anonymous);\n    }\n\n    const anonToken = getAnonTokens()[postId] || '';\n    const canUseAnonymousControl = isAnonymous && (Boolean(anonToken) || managedAnonIds.has(postId));\n    if (canUseAnonymousControl) {\n      const { data: result, error } = await supabase.functions.invoke('anonymous-post-control', { body: { action: 'update_status', postId, status, editToken: anonToken } });\n      if (error || !result?.ok) return { ok: false, error: result?.error || error?.message || 'Não foi possível atualizar o status.' };\n      setPosts(prev => prev.map(post => post.id === postId ? { ...post, status, updatedAt: new Date().toISOString() } : post));\n      return { ok: true };\n    }\n\n    const { error } = await supabase.from('posts').update({ status }).eq('id', postId);\n    if (error) return { ok: false, error: error.message };\n    setPosts(prev => prev.map(post => post.id === postId ? { ...post, status, updatedAt: new Date().toISOString() } : post));\n    return { ok: true };\n  }, [posts, getAnonTokens, managedAnonIds]);"""
data, count = pattern.subn(replacement, data, count=1)
if count != 1:
    raise RuntimeError(f'DataContext updatePostStatus: expected 1 block, found {count}')
write(data_path, data)

# 4) Post details: lifecycle controls + persistent history timeline.
details_path = 'src/pages/PostDetails.tsx'
details = read(details_path)
details = replace_once(
    details,
    "import { ArrowLeft, MapPin, ShieldAlert, Heart, MessageSquare, Send, Trash2, Maximize2, X, CornerDownRight } from 'lucide-react';",
    "import { ArrowLeft, MapPin, ShieldAlert, Heart, MessageSquare, Send, Trash2, Maximize2, X, CornerDownRight, Clock3, Settings2 } from 'lucide-react';",
    'PostDetails icons',
)
details = replace_once(
    details,
    "import type { Comment, Post } from '../types';",
    "import type { Comment, Post, PostStatus } from '../types';\n\ntype StatusHistoryItem = { id: string; old_status?: PostStatus | null; new_status: PostStatus; source: string; changed_at: string };\nconst lifecycleLabels: Record<PostStatus, string> = { pending: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido' };\nconst lifecycleClasses: Record<PostStatus, string> = {\n  pending: 'bg-amber-500',\n  in_progress: 'bg-blue-500',\n  resolved: 'bg-emerald-600',\n};",
    'PostDetails lifecycle types',
)
details = replace_once(
    details,
    "  const { supportPost, addComment, commentsByPost, loadComments, deleteComment } = useData();",
    "  const { supportPost, addComment, commentsByPost, loadComments, deleteComment, updatePostStatus, isMyPost } = useData();",
    'PostDetails data actions',
)
details = replace_once(
    details,
    "  const [deletingComment, setDeletingComment] = useState<string | null>(null);\n",
    "  const [deletingComment, setDeletingComment] = useState<string | null>(null);\n  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);\n  const [canModerate, setCanModerate] = useState(false);\n  const [updatingStatus, setUpdatingStatus] = useState<PostStatus | null>(null);\n",
    'PostDetails lifecycle state',
)
details = replace_once(
    details,
    "      const supportPromise = user?.id\n        ? supabase.from('post_supports').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()\n        : Promise.resolve({ data: null } as any);\n\n      const [postResult, , supportResult] = await Promise.all([postPromise, commentsPromise, supportPromise]);",
    "      const supportPromise = user?.id\n        ? supabase.from('post_supports').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()\n        : Promise.resolve({ data: null } as any);\n      const historyPromise = supabase\n        .from('post_status_history')\n        .select('id,old_status,new_status,source,changed_at')\n        .eq('post_id', postId)\n        .order('changed_at', { ascending: false })\n        .limit(30);\n\n      const [postResult, , supportResult, historyResult] = await Promise.all([postPromise, commentsPromise, supportPromise, historyPromise]);",
    'PostDetails history query',
)
details = replace_once(
    details,
    "      setSupported(Boolean(supportResult?.data));\n      setCommentsLoading(false);",
    "      setSupported(Boolean(supportResult?.data));\n      setStatusHistory((historyResult?.data || []) as StatusHistoryItem[]);\n      setCommentsLoading(false);",
    'PostDetails history state load',
)
main_effect_end = "  }, [postId, user?.id, loadComments]);\n"
details = replace_once(
    details,
    main_effect_end,
    main_effect_end + """\n  useEffect(() => {\n    let active = true;\n    if (!user?.id) { setCanModerate(false); return () => { active = false; }; }\n    void supabase.from('app_roles').select('role').eq('user_id', user.id).maybeSingle().then(({ data }) => {\n      if (!active) return;\n      setCanModerate(data?.role === 'admin' || data?.role === 'moderator');\n    });\n    return () => { active = false; };\n  }, [user?.id]);\n""",
    'PostDetails moderator effect',
)
handle_delete_end = """  const handleDeleteComment = async (commentId: string) => {\n    if (!postId || deletingComment) return;\n    if (!isAuthenticated) { navigate('/login'); return; }\n    if (!confirm('Excluir este comentário?')) return;\n    setDeletingComment(commentId);\n    try {\n      await deleteComment(commentId);\n      setPost(prev => prev ? { ...prev, commentsCount: Math.max(0, prev.commentsCount - 1) } : prev);\n      if (replyingTo === commentId) setReplyingTo(null);\n    } finally {\n      setDeletingComment(null);\n    }\n  };\n"""
status_handler = handle_delete_end + """\n  const handleStatusChange = async (status: PostStatus) => {\n    if (!postId || !post || updatingStatus || post.status === status) return;\n    setUpdatingStatus(status);\n    try {\n      const result = await updatePostStatus(postId, status);\n      if (!result.ok) return;\n      setPost(prev => prev ? { ...prev, status, updatedAt: new Date().toISOString() } : prev);\n      const { data } = await supabase.from('post_status_history').select('id,old_status,new_status,source,changed_at').eq('post_id', postId).order('changed_at', { ascending: false }).limit(30);\n      if (data) setStatusHistory(data as StatusHistoryItem[]);\n    } finally {\n      setUpdatingStatus(null);\n    }\n  };\n"""
details = replace_once(details, handle_delete_end, status_handler, 'PostDetails status handler')
details = replace_once(
    details,
    "  const area = post.locality && post.neighborhood ? `${post.locality} · ${post.neighborhood}` : post.locality || post.neighborhood;\n",
    "  const area = post.locality && post.neighborhood ? `${post.locality} · ${post.neighborhood}` : post.locality || post.neighborhood;\n  const canManageStatus = isMyPost(post) || canModerate;\n",
    'PostDetails canManageStatus',
)
controls = """        {canManageStatus && (\n          <div className=\"mt-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-4\">\n            <div className=\"flex items-start gap-3\">\n              <div className=\"w-9 h-9 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center ring-1 ring-slate-200 dark:ring-slate-700 shrink-0\"><Settings2 className=\"w-4 h-4 text-slate-500\" /></div>\n              <div className=\"min-w-0 flex-1\">\n                <p className=\"text-sm font-bold text-slate-900 dark:text-white\">Atualizar andamento</p>\n                <p className=\"text-xs text-slate-500 dark:text-slate-400 mt-0.5\">Mantenha a comunidade informada sobre a situação deste relato.</p>\n              </div>\n            </div>\n            <div className=\"grid grid-cols-3 gap-2 mt-3\">\n              {(['pending', 'in_progress', 'resolved'] as PostStatus[]).map(status => (\n                <button key={status} type=\"button\" onClick={() => void handleStatusChange(status)} disabled={post.status === status || updatingStatus !== null} className={`min-h-11 rounded-xl px-2 py-2 text-[11px] sm:text-xs font-bold transition-all ${post.status === status ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-emerald-400'} disabled:opacity-70`}>\n                  {updatingStatus === status ? 'Salvando...' : lifecycleLabels[status]}\n                </button>\n              ))}\n            </div>\n          </div>\n        )}\n\n"""
details = replace_once(
    details,
    "        <div className=\"grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800\">",
    controls + "        <div className=\"grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800\">",
    'PostDetails controls insertion',
)
history_card = """      <Card>\n        <div className=\"flex items-start justify-between gap-3 mb-4\">\n          <div>\n            <div className=\"flex items-center gap-2\"><Clock3 className=\"w-5 h-5 text-emerald-600\" /><h2 className=\"text-lg font-bold text-slate-900 dark:text-white\">Histórico do relato</h2></div>\n            <p className=\"text-xs text-slate-500 mt-1\">As mudanças de situação ficam registradas para dar mais transparência ao acompanhamento.</p>\n          </div>\n        </div>\n        {statusHistory.length === 0 ? (\n          <p className=\"text-sm text-slate-400\">Ainda não há mudanças registradas.</p>\n        ) : (\n          <div className=\"space-y-0\">\n            {statusHistory.map((item, index) => (\n              <div key={item.id} className=\"relative flex gap-3 pb-4 last:pb-0\">\n                {index < statusHistory.length - 1 && <span className=\"absolute left-[7px] top-4 bottom-0 w-px bg-slate-200 dark:bg-slate-700\" />}\n                <span className={`relative mt-1 w-3.5 h-3.5 rounded-full ring-4 ring-white dark:ring-slate-900 shrink-0 ${lifecycleClasses[item.new_status]}`} />\n                <div className=\"min-w-0\">\n                  <p className=\"text-sm font-bold text-slate-800 dark:text-slate-200\">{lifecycleLabels[item.new_status]}</p>\n                  <p className=\"text-xs text-slate-400 mt-0.5\">{new Date(item.changed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>\n                </div>\n              </div>\n            ))}\n          </div>\n        )}\n      </Card>\n\n"""
details = replace_once(
    details,
    "      <Card id=\"post-comments\" className=\"scroll-mt-24\">",
    history_card + "      <Card id=\"post-comments\" className=\"scroll-mt-24\">",
    'PostDetails history card insertion',
)
write(details_path, details)

# 5) Keep the database change versioned beside the code.
migration = r'''-- Post lifecycle tracking: Aberto -> Em andamento -> Resolvido
-- The persisted enum keeps `pending` for backwards compatibility; the UI calls it "Aberto".

create table if not exists public.post_status_history (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  old_status public.post_status,
  new_status public.post_status not null,
  changed_by uuid references public.users(id) on delete set null,
  source text not null default 'system',
  changed_at timestamptz not null default now(),
  constraint post_status_history_source_check check (
    source = any (array['created'::text,'author'::text,'anonymous_owner'::text,'moderation'::text,'system'::text,'baseline'::text])
  )
);

create index if not exists idx_post_status_history_post_changed
  on public.post_status_history (post_id, changed_at desc);

alter table public.post_status_history enable row level security;

revoke all on table public.post_status_history from anon, authenticated;
grant select (id, post_id, old_status, new_status, source, changed_at)
  on public.post_status_history to anon, authenticated;

drop policy if exists post_status_history_select on public.post_status_history;
create policy post_status_history_select
  on public.post_status_history
  for select
  to public
  using (true);

create or replace function public.log_post_status_history()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_source text;
begin
  v_source := case
    when auth.uid() is not null and public.is_moderator() then 'moderation'
    when auth.uid() is not null and new.author_id = auth.uid() then 'author'
    when new.is_anonymous is true then 'anonymous_owner'
    else 'system'
  end;

  if tg_op = 'INSERT' then
    insert into public.post_status_history(post_id, old_status, new_status, changed_by, source, changed_at)
    values (new.id, null, new.status, auth.uid(), 'created', coalesce(new.created_at, now()));
  elsif old.status is distinct from new.status then
    insert into public.post_status_history(post_id, old_status, new_status, changed_by, source)
    values (new.id, old.status, new.status, auth.uid(), v_source);
  end if;

  return new;
end;
$$;

revoke all on function public.log_post_status_history() from public, anon, authenticated;

drop trigger if exists trg_log_post_status_history on public.posts;
create trigger trg_log_post_status_history
after insert or update of status on public.posts
for each row execute function public.log_post_status_history();

insert into public.post_status_history(post_id, old_status, new_status, changed_by, source, changed_at)
select p.id, null, p.status, null, 'baseline', p.created_at
from public.posts p
where not exists (
  select 1 from public.post_status_history h where h.post_id = p.id
);

drop policy if exists posts_update on public.posts;
create policy posts_update
  on public.posts
  for update
  to authenticated
  using ((select auth.uid()) = author_id or public.is_moderator())
  with check ((select auth.uid()) = author_id or public.is_moderator());
'''
write('database/20260817_post_lifecycle_history.sql', migration)

print('Post lifecycle upgrade applied successfully.')
