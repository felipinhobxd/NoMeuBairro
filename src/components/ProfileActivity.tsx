import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, CalendarDays, ChevronRight, Heart, Loader2, MapPin, MessageSquare, ShieldAlert,
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { Card } from './UI';
import { cn } from '../utils/cn';
import type { AccountType } from '../types';

type ActivityTab = 'posts' | 'comments' | 'supports' | 'events' | 'applications';

type ActivityData = {
  posts: any[];
  comments: any[];
  supports: any[];
  events: any[];
  applications: any[];
};

type ActivityCounts = Record<ActivityTab, number>;

const EMPTY_DATA: ActivityData = { posts: [], comments: [], supports: [], events: [], applications: [] };
const EMPTY_COUNTS: ActivityCounts = { posts: 0, comments: 0, supports: 0, events: 0, applications: 0 };

const tabs: Array<{ id: ActivityTab; label: string; shortLabel: string; icon: typeof MessageSquare }> = [
  { id: 'posts', label: 'Meus relatos', shortLabel: 'Relatos', icon: ShieldAlert },
  { id: 'comments', label: 'Meus comentários', shortLabel: 'Comentários', icon: MessageSquare },
  { id: 'supports', label: 'Meus apoios', shortLabel: 'Apoios', icon: Heart },
  { id: 'events', label: 'Meus eventos', shortLabel: 'Eventos', icon: CalendarDays },
  { id: 'applications', label: 'Minhas candidaturas', shortLabel: 'Candidaturas', icon: Briefcase },
];

const postStatus: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' },
  in_progress: { label: 'Em andamento', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
  resolved: { label: 'Resolvido', cls: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
};

const applicationStatus: Record<string, { label: string; cls: string }> = {
  interested: { label: 'Interesse enviado', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
  viewed: { label: 'Currículo visualizado', cls: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' },
  contacted: { label: 'Empresa entrou em contato', cls: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' },
  withdrawn: { label: 'Interesse retirado', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

function activityDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getAnonymousIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem('anb-my-anonymous-ids') || '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string').slice(0, 50) : [];
  } catch {
    return [];
  }
}

export default function ProfileActivity({ userId, accountType }: { userId: string; accountType?: AccountType }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActivityTab>('posts');
  const [data, setData] = useState<ActivityData>(EMPTY_DATA);
  const [counts, setCounts] = useState<ActivityCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      const anonymousIds = getAnonymousIds();

      const ownPostsQuery = supabase
        .from('posts')
        .select('id,title,description,status,category,location,created_at,is_anonymous', { count: 'exact' })
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      const anonymousPostsQuery = anonymousIds.length
        ? supabase
            .from('posts')
            .select('id,title,description,status,category,location,created_at,is_anonymous')
            .in('id', anonymousIds)
            .eq('is_anonymous', true)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as any[], error: null });

      const commentsQuery = supabase
        .from('comments')
        .select('id,post_id,content,created_at,posts:post_id(id,title,status)', { count: 'exact' })
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      const supportsQuery = supabase
        .from('post_supports')
        .select('id,post_id,created_at,posts:post_id(id,title,status,location)', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      const eventsQuery = supabase
        .from('events')
        .select('id,title,description,event_date,location,type,created_at', { count: 'exact' })
        .eq('created_by', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      const applicationsQuery = accountType === 'resident'
        ? supabase
            .from('job_applications')
            .select('id,job_id,status,created_at', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] as any[], error: null, count: 0 });

      const [ownPosts, anonymousPosts, comments, supports, events, applications] = await Promise.all([
        ownPostsQuery, anonymousPostsQuery, commentsQuery, supportsQuery, eventsQuery, applicationsQuery,
      ]);

      if (!active) return;

      const hasError = [ownPosts, anonymousPosts, comments, supports, events, applications].some((result: any) => result.error);
      if (hasError) setError('Algumas atividades não puderam ser carregadas agora.');

      const mergedPosts = [...(ownPosts.data || []), ...(anonymousPosts.data || [])]
        .filter((item, index, array) => array.findIndex((other) => other.id === item.id) === index)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 30);

      let mappedApplications = applications.data || [];
      const jobIds = [...new Set(mappedApplications.map((item: any) => item.job_id).filter(Boolean))];
      if (jobIds.length) {
        const jobsResult = await supabase
          .from('public_job_posts')
          .select('id,title,company_name,neighborhood,is_active')
          .in('id', jobIds);
        if (!active) return;
        if (!jobsResult.error) {
          const jobsById = new Map((jobsResult.data || []).map((job: any) => [job.id, job]));
          mappedApplications = mappedApplications.map((item: any) => ({ ...item, job: jobsById.get(item.job_id) }));
        }
      }

      setData({
        posts: mergedPosts,
        comments: comments.data || [],
        supports: supports.data || [],
        events: events.data || [],
        applications: mappedApplications,
      });
      setCounts({
        posts: (ownPosts.count || 0) + (anonymousPosts.data?.length || 0),
        comments: comments.count || 0,
        supports: supports.count || 0,
        events: events.count || 0,
        applications: applications.count || 0,
      });
      setLoading(false);
    };

    void load();
    return () => { active = false; };
  }, [userId, accountType]);

  const visibleTabs = useMemo(
    () => tabs.filter((tab) => accountType === 'resident' || tab.id !== 'applications'),
    [accountType],
  );

  useEffect(() => {
    if (accountType !== 'resident' && activeTab === 'applications') setActiveTab('posts');
  }, [accountType, activeTab]);

  const openEvent = (eventId: string) => {
    navigate('/mural');
    window.setTimeout(() => {
      document.getElementById(`ev-${eventId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);
  };

  const emptyMessages: Record<ActivityTab, string> = {
    posts: 'Você ainda não publicou nenhum relato.',
    comments: 'Você ainda não comentou em nenhum relato.',
    supports: 'Você ainda não apoiou nenhum relato.',
    events: 'Você ainda não publicou nenhum evento.',
    applications: 'Você ainda não demonstrou interesse em nenhuma vaga.',
  };

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Minha atividade</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Acompanhe tudo o que você fez no No Meu Bairro em um só lugar.</p>
      </div>

      <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label="Tipos de atividade">
          {visibleTabs.map(({ id, label, shortLabel, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'min-h-11 shrink-0 inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold transition-colors',
                activeTab === id
                  ? 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
              )}
              title={label}
            >
              <Icon className="w-4 h-4" />
              <span>{shortLabel}</span>
              <span className={cn(
                'min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs',
                activeTab === id ? 'bg-orange-200/70 dark:bg-orange-500/20' : 'bg-slate-100 dark:bg-slate-700',
              )}>{counts[id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5 min-h-48">
        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Carregando sua atividade...</div>
        ) : (
          <>
            {error && <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">{error}</div>}
            {data[activeTab].length === 0 ? (
              <div className="py-10 text-center">
                <p className="font-semibold text-slate-800 dark:text-slate-100">Nada por aqui ainda</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{emptyMessages[activeTab]}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeTab === 'posts' && data.posts.map((post) => {
                  const status = postStatus[post.status] || postStatus.pending;
                  return (
                    <button key={post.id} type="button" onClick={() => navigate(`/post/${post.id}`)} className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><p className="font-bold text-slate-900 dark:text-white truncate">{post.title}</p><p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mt-1">{post.description}</p></div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                        <span className={cn('rounded-full px-2.5 py-1 font-bold', status.cls)}>{status.label}</span>
                        {post.is_anonymous && <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-semibold text-slate-600 dark:text-slate-300">Denúncia anônima deste navegador</span>}
                        <span className="text-slate-500">{activityDate(post.created_at)}</span>
                      </div>
                    </button>
                  );
                })}

                {activeTab === 'comments' && data.comments.map((comment) => (
                  <button key={comment.id} type="button" onClick={() => navigate(`/post/${comment.post_id}`)} className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-orange-700 dark:text-orange-300">Comentário em {comment.posts?.title || 'relato'}</p><p className="text-sm text-slate-800 dark:text-slate-100 mt-1.5 line-clamp-3">“{comment.content}”</p><p className="text-xs text-slate-500 mt-2">{activityDate(comment.created_at)}</p></div><ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" /></div>
                  </button>
                ))}

                {activeTab === 'supports' && data.supports.map((support) => (
                  <button key={support.id} type="button" onClick={() => navigate(`/post/${support.post_id}`)} className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-start gap-3"><div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center shrink-0"><Heart className="w-4 h-4 text-rose-500 fill-rose-500" /></div><div className="flex-1 min-w-0"><p className="font-bold text-slate-900 dark:text-white truncate">{support.posts?.title || 'Relato'}</p><div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">{support.posts?.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{support.posts.location}</span>}<span>{activityDate(support.created_at)}</span></div></div><ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" /></div>
                  </button>
                ))}

                {activeTab === 'events' && data.events.map((event) => (
                  <button key={event.id} type="button" onClick={() => openEvent(event.id)} className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-start gap-3"><div className="w-11 h-11 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0"><CalendarDays className="w-5 h-5 text-violet-600 dark:text-violet-300" /></div><div className="flex-1 min-w-0"><p className="font-bold text-slate-900 dark:text-white truncate">{event.title}</p><p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mt-1">{event.description}</p><div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500"><span>{new Date(`${event.event_date}T12:00:00`).toLocaleDateString('pt-BR')}</span>{event.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}</div></div><ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" /></div>
                  </button>
                ))}

                {activeTab === 'applications' && data.applications.map((application) => {
                  const status = applicationStatus[application.status] || applicationStatus.interested;
                  return (
                    <button key={application.id} type="button" onClick={() => navigate('/empregos')} className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0"><Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-300" /></div><div className="flex-1 min-w-0"><p className="font-bold text-slate-900 dark:text-white truncate">{application.job?.title || 'Vaga'}</p><p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{application.job?.company_name || 'Empresa'}</p><div className="flex flex-wrap items-center gap-2 mt-2"><span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', status.cls)}>{status.label}</span>{application.job?.neighborhood && <span className="text-xs text-slate-500 inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{application.job.neighborhood}</span>}<span className="text-xs text-slate-500">{activityDate(application.created_at)}</span></div></div><ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" /></div>
                    </button>
                  );
                })}
              </div>
            )}

            {counts[activeTab] > data[activeTab].length && (
              <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-4">Mostrando as {data[activeTab].length} atividades mais recentes de {counts[activeTab]}.</p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
