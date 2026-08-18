import { useEffect, useMemo, useState } from 'react';
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
