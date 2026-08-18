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


hook = r'''import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/UI';
import { supabase } from '../utils/supabase';

export type SavedKind = 'post' | 'event' | 'job';

const savedColumns: Record<SavedKind, 'post_id' | 'event_id' | 'job_id'> = {
  post: 'post_id',
  event: 'event_id',
  job: 'job_id',
};

export function useSavedItems(kind: SavedKind) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const column = savedColumns[kind];

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setSavedIds(new Set());
      return () => { active = false; };
    }
    setLoading(true);
    void supabase.from('saved_items').select(column).eq('user_id', user.id).not(column, 'is', null).then(({ data, error }) => {
      if (!active) return;
      if (error) console.warn('Não foi possível carregar itens salvos:', error);
      const ids = new Set<string>();
      for (const row of data || []) {
        const id = (row as any)[column];
        if (id) ids.add(String(id));
      }
      setSavedIds(ids);
      setLoading(false);
    });
    return () => { active = false; };
  }, [user?.id, column]);

  const toggleSaved = useCallback(async (itemId: string) => {
    if (!user?.id) {
      toast('Entre ou crie uma conta para salvar itens.', 'info');
      navigate('/login');
      return false;
    }
    const currentlySaved = savedIds.has(itemId);
    const result = currentlySaved
      ? await supabase.from('saved_items').delete().eq('user_id', user.id).eq(column, itemId)
      : await supabase.from('saved_items').insert({ user_id: user.id, [column]: itemId });
    if (result.error) {
      toast(result.error.message || 'Não foi possível atualizar seus itens salvos.', 'error');
      return false;
    }
    setSavedIds(prev => {
      const next = new Set(prev);
      currentlySaved ? next.delete(itemId) : next.add(itemId);
      return next;
    });
    toast(currentlySaved ? 'Removido dos salvos.' : 'Salvo para ver depois!');
    return true;
  }, [user?.id, savedIds, column, toast, navigate]);

  return {
    savedIds,
    loading,
    isSaved: (itemId: string) => savedIds.has(itemId),
    toggleSaved,
  };
}
'''
write('src/hooks/useSavedItems.ts', hook)

saved_page = r'''import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, MessageSquare, CalendarDays, Briefcase, MapPin, Trash2, ArrowRight } from 'lucide-react';
import { Card, EmptyState, timeAgo, useToast } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import { cn } from '../utils/cn';

type SavedKind = 'post' | 'event' | 'job';
type SavedViewItem = {
  id: string;
  kind: SavedKind;
  targetId: string;
  title: string;
  description?: string;
  area?: string;
  subtitle?: string;
  createdAt: string;
};

const labels: Record<SavedKind, string> = { post: 'Relato', event: 'Evento', job: 'Vaga' };
const icons = { post: MessageSquare, event: CalendarDays, job: Briefcase };

export default function Saved() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<SavedViewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | SavedKind>('all');

  useEffect(() => {
    if (!user?.id) { navigate('/login'); return; }
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data: savedRows, error } = await supabase.from('saved_items').select('id,post_id,event_id,job_id,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(300);
      if (!active) return;
      if (error) { toast('Não foi possível carregar seus itens salvos.', 'error'); setLoading(false); return; }
      const rows = savedRows || [];
      const postIds = rows.map((row: any) => row.post_id).filter(Boolean);
      const eventIds = rows.map((row: any) => row.event_id).filter(Boolean);
      const jobIds = rows.map((row: any) => row.job_id).filter(Boolean);
      const [postsResult, eventsResult, jobsResult] = await Promise.all([
        postIds.length ? supabase.from('posts').select('id,title,description,neighborhood,locality,status').in('id', postIds) : Promise.resolve({ data: [], error: null } as any),
        eventIds.length ? supabase.from('events').select('id,title,description,event_date,neighborhood,locality').in('id', eventIds) : Promise.resolve({ data: [], error: null } as any),
        jobIds.length ? supabase.from('public_job_posts').select('id,title,description,company_name,neighborhood,locality').in('id', jobIds) : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (!active) return;
      const postMap = new Map((postsResult.data || []).map((row: any) => [row.id, row]));
      const eventMap = new Map((eventsResult.data || []).map((row: any) => [row.id, row]));
      const jobMap = new Map((jobsResult.data || []).map((row: any) => [row.id, row]));
      const mapped: SavedViewItem[] = [];
      for (const row of rows as any[]) {
        if (row.post_id) {
          const post: any = postMap.get(row.post_id);
          if (post) mapped.push({ id: row.id, kind: 'post', targetId: post.id, title: post.title, description: post.description, area: [post.locality, post.neighborhood].filter(Boolean).join(' · '), subtitle: post.status === 'resolved' ? 'Resolvido' : post.status === 'in_progress' ? 'Em andamento' : 'Aberto', createdAt: row.created_at });
        } else if (row.event_id) {
          const event: any = eventMap.get(row.event_id);
          if (event) mapped.push({ id: row.id, kind: 'event', targetId: event.id, title: event.title, description: event.description, area: [event.locality, event.neighborhood].filter(Boolean).join(' · '), subtitle: event.event_date ? new Date(`${event.event_date}T12:00:00`).toLocaleDateString('pt-BR') : undefined, createdAt: row.created_at });
        } else if (row.job_id) {
          const job: any = jobMap.get(row.job_id);
          if (job) mapped.push({ id: row.id, kind: 'job', targetId: job.id, title: job.title, description: job.description, area: [job.locality, job.neighborhood].filter(Boolean).join(' · '), subtitle: job.company_name || 'Empresa', createdAt: row.created_at });
        }
      }
      setItems(mapped);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [user?.id, navigate, toast]);

  const visible = useMemo(() => filter === 'all' ? items : items.filter(item => item.kind === filter), [items, filter]);
  const openItem = (item: SavedViewItem) => {
    if (item.kind === 'post') { navigate(`/post/${item.targetId}`); return; }
    if (item.kind === 'event') { try { sessionStorage.setItem('anb-mural-focus-event', item.targetId); } catch {} navigate('/mural'); return; }
    try { sessionStorage.setItem('anb-job-focus', item.targetId); } catch {}
    navigate('/empregos');
  };
  const removeItem = async (item: SavedViewItem) => {
    if (!user?.id) return;
    const { error } = await supabase.from('saved_items').delete().eq('id', item.id).eq('user_id', user.id);
    if (error) { toast('Não foi possível remover este item.', 'error'); return; }
    setItems(prev => prev.filter(value => value.id !== item.id));
    toast('Removido dos salvos.', 'info');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Bookmark className="w-6 h-6 text-orange-600 fill-orange-100 dark:fill-orange-500/10" /> Salvos</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Relatos, eventos e vagas que você guardou para consultar depois.</p></div>
      <Card className="!p-3"><div className="flex gap-1.5 overflow-x-auto no-scrollbar">{([['all','Todos'],['post','Relatos'],['event','Eventos'],['job','Vagas']] as const).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={cn('px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors', filter === value ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')}>{label}<span className="ml-1.5 opacity-70">{value === 'all' ? items.length : items.filter(item => item.kind === value).length}</span></button>)}</div></Card>
      {loading ? <div className="py-16 text-center text-sm text-slate-400">Carregando itens salvos...</div> : visible.length === 0 ? <Card><EmptyState icon={Bookmark} title={filter === 'all' ? 'Nenhum item salvo' : `Nenhum ${filter === 'post' ? 'relato' : filter === 'event' ? 'evento' : 'vaga'} salvo`} description="Use o botão Salvar nos conteúdos que você quiser reencontrar rapidamente." /></Card> : <div className="space-y-3">{visible.map(item => { const Icon = icons[item.kind]; return <Card key={item.id} className="!p-4 sm:!p-5"><div className="flex gap-3 sm:gap-4"><div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-orange-700 dark:text-orange-300" /></div><div className="flex-1 min-w-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{labels[item.kind]} · salvo {timeAgo(item.createdAt)}</p><h2 className="font-bold text-slate-900 dark:text-white mt-1 break-words">{item.title}</h2>{item.subtitle && <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mt-0.5">{item.subtitle}</p>}</div><button type="button" onClick={() => void removeItem(item)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label="Remover dos salvos"><Trash2 className="w-4 h-4" /></button></div>{item.description && <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">{item.description}</p>}{item.area && <p className="text-xs text-slate-500 mt-2 inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{item.area}</p>}<button type="button" onClick={() => openItem(item)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline">Abrir {labels[item.kind].toLowerCase()} <ArrowRight className="w-3.5 h-3.5" /></button></div></div></Card>; })}</div>}
    </div>
  );
}
'''
write('src/pages/Saved.tsx', saved_page)

# App route
path = 'src/App.tsx'
text = read(path)
text = replace_once(text, "const PostDetails = lazyWithRetry(() => import('./pages/PostDetails'), 'post');\n", "const PostDetails = lazyWithRetry(() => import('./pages/PostDetails'), 'post');\nconst Saved = lazyWithRetry(() => import('./pages/Saved'), 'salvos');\n", 'App saved lazy import')
text = replace_once(text, "                        <Route path=\"/post/:postId\" element={<PostDetails />} />\n", "                        <Route path=\"/post/:postId\" element={<PostDetails />} />\n                        <Route path=\"/salvos\" element={<Saved />} />\n", 'App saved route')
write(path, text)

# Layout secondary navigation
path = 'src/components/Layout.tsx'
text = read(path)
text = replace_once(text, "  ShieldCheck, MoreHorizontal, Download,\n", "  ShieldCheck, MoreHorizontal, Download, Bookmark,\n", 'Layout bookmark icon')
text = replace_once(text, "  const mobileMoreActive = ['/estatisticas', '/denuncias', '/perfil', '/admin'].some(path => isActive(path));", "  const mobileMoreActive = ['/estatisticas', '/denuncias', '/perfil', '/salvos', '/admin'].some(path => isActive(path));", 'Layout mobile more active')
text = replace_once(text, "              <NotificationBell />\n              {isAuthenticated && user ? (", "              <NotificationBell />\n              {isAuthenticated && <button onClick={() => navigate('/salvos')} className={cn('p-2.5 rounded-xl transition-all duration-200', isActive('/salvos') ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800')} aria-label=\"Itens salvos\" title=\"Itens salvos\"><Bookmark className=\"w-[18px] h-[18px]\" /></button>}\n              {isAuthenticated && user ? (", 'Layout desktop saved button')
text = replace_once(text, "                  { path: '/perfil', label: 'Perfil', icon: UserCircle },\n                  ...(isAdmin ?", "                  { path: '/perfil', label: 'Perfil', icon: UserCircle },\n                  ...(isAuthenticated ? [{ path: '/salvos', label: 'Salvos', icon: Bookmark }] : []),\n                  ...(isAdmin ?", 'Layout mobile saved item')
write(path, text)

# Feed save action
path = 'src/pages/Feed.tsx'
text = read(path)
text = replace_once(text, "  Trash2, Bus, Shield, HelpCircle, CornerDownRight, Send, X, Search, UserCheck, Sparkles, RefreshCw, ExternalLink, Share2, Bell, CheckCircle2, CalendarDays, Briefcase,\n", "  Trash2, Bus, Shield, HelpCircle, CornerDownRight, Send, X, Search, UserCheck, Sparkles, RefreshCw, ExternalLink, Share2, Bell, CheckCircle2, CalendarDays, Briefcase, Bookmark,\n", 'Feed bookmark icon')
text = replace_once(text, "import { shareContent } from '../utils/share';\n", "import { shareContent } from '../utils/share';\nimport { useSavedItems } from '../hooks/useSavedItems';\n", 'Feed saved hook import')
text = replace_once(text, "  const { toast } = useToast();\n", "  const { toast } = useToast();\n  const { isSaved: isPostSaved, toggleSaved: toggleSavedPost } = useSavedItems('post');\n", 'Feed saved hook')
needle = "<button type=\"button\" onClick={() => void handleSharePost(post)} className=\"flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg text-[11px] font-bold text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all\"><Share2 className=\"w-3.5 h-3.5\" />Compartilhar</button>{canManageStatus &&"
replacement = "<button type=\"button\" onClick={() => void handleSharePost(post)} className=\"flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg text-[11px] font-bold text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all\"><Share2 className=\"w-3.5 h-3.5\" />Compartilhar</button><button type=\"button\" onClick={() => void toggleSavedPost(post.id)} className={cn('flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg text-[11px] font-bold transition-all', isPostSaved(post.id) ? 'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-500/10' : 'text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10')} aria-pressed={isPostSaved(post.id)}><Bookmark className={cn('w-3.5 h-3.5', isPostSaved(post.id) && 'fill-current')} />{isPostSaved(post.id) ? 'Salvo' : 'Salvar'}</button>{canManageStatus &&"
text = replace_once(text, needle, replacement, 'Feed save button')
write(path, text)

# Post details save action
path = 'src/pages/PostDetails.tsx'
text = read(path)
text = replace_once(text, "import { ArrowLeft, MapPin, ShieldAlert, Heart, MessageSquare, Send, Trash2, Maximize2, X, CornerDownRight, Clock3, Settings2, Share2 } from 'lucide-react';", "import { ArrowLeft, MapPin, ShieldAlert, Heart, MessageSquare, Send, Trash2, Maximize2, X, CornerDownRight, Clock3, Settings2, Share2, Bookmark } from 'lucide-react';", 'PostDetails bookmark icon')
text = replace_once(text, "import { shareContent } from '../utils/share';\n", "import { shareContent } from '../utils/share';\nimport { useSavedItems } from '../hooks/useSavedItems';\n", 'PostDetails saved hook import')
text = replace_once(text, "  const { toast } = useToast();\n", "  const { toast } = useToast();\n  const { isSaved: isPostSaved, toggleSaved: toggleSavedPost } = useSavedItems('post');\n", 'PostDetails saved hook')
text = replace_once(text, "        <div className=\"grid grid-cols-3 gap-2 sm:gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800\">", "        <div className=\"grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800\">", 'PostDetails action grid saved')
share_button = """          <button type=\"button\" onClick={() => void handleShare()} className=\"flex items-center justify-center gap-1.5 sm:gap-2 py-3 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 text-xs sm:text-sm font-bold transition-all hover:bg-blue-100 dark:hover:bg-blue-500/20\">\n            <Share2 className=\"w-5 h-5\" /> Compartilhar\n          </button>\n"""
save_button = share_button + """          <button type=\"button\" onClick={() => post && void toggleSavedPost(post.id)} className={cn('flex items-center justify-center gap-1.5 sm:gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all', post && isPostSaved(post.id) ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300')} aria-pressed={post ? isPostSaved(post.id) : false}>\n            <Bookmark className={cn('w-5 h-5', post && isPostSaved(post.id) && 'fill-current')} /> {post && isPostSaved(post.id) ? 'Salvo' : 'Salvar'}\n          </button>\n"""
# cn is not imported in PostDetails yet; use a plain helper import.
text = replace_once(text, "import { shareContent } from '../utils/share';\nimport { useSavedItems } from '../hooks/useSavedItems';\n", "import { shareContent } from '../utils/share';\nimport { useSavedItems } from '../hooks/useSavedItems';\nimport { cn } from '../utils/cn';\n", 'PostDetails cn import')
text = replace_once(text, share_button, save_button, 'PostDetails save button')
write(path, text)

# Mural save action
path = 'src/pages/Mural.tsx'
text = read(path)
text = replace_once(text, "import { CalendarDays, MapPin, Plus, Clock, Trash2, Users, CheckCircle2, RefreshCw, Search, X, LocateFixed, Map, AlertTriangle } from 'lucide-react';", "import { CalendarDays, MapPin, Plus, Clock, Trash2, Users, CheckCircle2, RefreshCw, Search, X, LocateFixed, Map, AlertTriangle, Bookmark } from 'lucide-react';", 'Mural bookmark icon')
text = replace_once(text, "import type { EventType } from '../types';\n", "import type { EventType } from '../types';\nimport { useSavedItems } from '../hooks/useSavedItems';\n", 'Mural saved hook import')
text = replace_once(text, "  const { toast } = useToast();\n", "  const { toast } = useToast();\n  const { isSaved: isEventSaved, toggleSaved: toggleSavedEvent } = useSavedItems('event');\n", 'Mural saved hook')
needle = "                      <button onClick={() => { if (!isAuthenticated) { navigate('/login'); return; } setShowReport({ eventId: ev.id, title: ev.title }); }} className=\"inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors\"><AlertTriangle className=\"w-3.5 h-3.5\" />Denunciar</button>\n"
replacement = needle + "                      <button type=\"button\" onClick={() => void toggleSavedEvent(ev.id)} className={cn('inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors', isEventSaved(ev.id) ? 'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-500/10' : 'text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10')} aria-pressed={isEventSaved(ev.id)}><Bookmark className={cn('w-3.5 h-3.5', isEventSaved(ev.id) && 'fill-current')} />{isEventSaved(ev.id) ? 'Salvo' : 'Salvar'}</button>\n"
text = replace_once(text, needle, replacement, 'Mural save button')
write(path, text)

# Jobs save action
path = 'src/pages/Empregos.tsx'
text = read(path)
text = replace_once(text, "  Pencil, Loader2, Undo2, LocateFixed,\n", "  Pencil, Loader2, Undo2, LocateFixed, Bookmark,\n", 'Empregos bookmark icon')
text = replace_once(text, "import { neighborhoodSearchText, normalizeNeighborhoodText } from '../contexts/NeighborhoodContext';\n", "import { neighborhoodSearchText, normalizeNeighborhoodText } from '../contexts/NeighborhoodContext';\nimport { useSavedItems } from '../hooks/useSavedItems';\nimport { cn } from '../utils/cn';\n", 'Empregos saved imports')
text = replace_once(text, "  const { user } = useAuth();\n", "  const { user } = useAuth();\n  const { isSaved: isJobSaved, toggleSaved: toggleSavedJob } = useSavedItems('job');\n", 'Empregos saved hook')
text = replace_once(text, "            return <Card key={job.id} id={`job-${job.id}`} className=\"!p-4 sm:!p-6 scroll-mt-28\">\n              <div className=\"flex flex-col sm:flex-row gap-3 sm:gap-4\">", "            return <Card key={job.id} id={`job-${job.id}`} className=\"relative !p-4 sm:!p-6 scroll-mt-28\">\n              <button type=\"button\" onClick={() => void toggleSavedJob(job.id)} className={cn('absolute top-4 right-4 sm:top-5 sm:right-5 z-10 w-10 h-10 rounded-xl flex items-center justify-center ring-1 transition-all', isJobSaved(job.id) ? 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20' : 'bg-white/95 dark:bg-slate-900/95 text-slate-400 ring-slate-200 dark:ring-slate-700 hover:text-orange-600')} aria-label={isJobSaved(job.id) ? 'Remover vaga dos salvos' : 'Salvar vaga'} aria-pressed={isJobSaved(job.id)}><Bookmark className={cn('w-4.5 h-4.5', isJobSaved(job.id) && 'fill-current')} /></button>\n              <div className=\"flex flex-col sm:flex-row gap-3 sm:gap-4 pr-11 sm:pr-12\">", 'Empregos save button')
write(path, text)

# Fix notification deep-link keys to match the actual page listeners.
path = 'src/utils/notificationActivity.ts'
text = read(path)
text = text.replace("sessionStorage.setItem('anb-focus-job', notification.jobId)", "sessionStorage.setItem('anb-job-focus', notification.jobId)")
text = text.replace("sessionStorage.setItem('anb-focus-event', notification.eventId)", "sessionStorage.setItem('anb-mural-focus-event', notification.eventId)")
write(path, text)

migration = r'''create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  job_id uuid references public.job_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_items_single_target_check check (num_nonnulls(post_id, event_id, job_id) = 1)
);
create unique index if not exists saved_items_post_unique on public.saved_items(user_id, post_id) where post_id is not null;
create unique index if not exists saved_items_event_unique on public.saved_items(user_id, event_id) where event_id is not null;
create unique index if not exists saved_items_job_unique on public.saved_items(user_id, job_id) where job_id is not null;
create index if not exists saved_items_user_created_idx on public.saved_items(user_id, created_at desc);
alter table public.saved_items enable row level security;
revoke all on table public.saved_items from anon, authenticated;
grant select, insert, delete on table public.saved_items to authenticated;
drop policy if exists saved_items_select_own on public.saved_items;
create policy saved_items_select_own on public.saved_items for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists saved_items_insert_own on public.saved_items;
create policy saved_items_insert_own on public.saved_items for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists saved_items_delete_own on public.saved_items;
create policy saved_items_delete_own on public.saved_items for delete to authenticated using ((select auth.uid()) = user_id);
'''
write('database/20260817_saved_items.sql', migration)

print('Saved items upgrade applied successfully.')
