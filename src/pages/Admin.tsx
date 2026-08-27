import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Bug, CalendarDays, Check, Filter, History as HistoryIcon,
  MessageSquare, RefreshCw, ShieldCheck, Trash2, UserX, Ban,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, useToast } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';

type ModerationItem = {
  report_id: string;
  reason: string;
  report_status: string;
  reported_at: string;
  post_id?: string | null;
  comment_id?: string | null;
  event_id?: string | null;
  content_type: 'post' | 'comment' | 'event' | string;
  content_title: string;
  content_preview: string;
  content_author_name: string;
  reporter_name: string;
};

type ModerationHistoryItem = {
  report_id: string;
  reason: string;
  report_status: string;
  reported_at: string;
  moderated_at: string;
  moderator_id: string | null;
  moderator_name: string;
  moderation_action: 'ignore' | 'remove' | string;
  content_type: 'post' | 'comment' | 'event' | string;
  content_title: string;
  content_preview: string;
  content_author_name: string;
  reporter_name: string;
};

type UsageRow = { day: string; path: string; views: number | string };
type ClientErrorItem = {
  id: number | string;
  created_at: string;
  user_id?: string | null;
  user_name: string;
  path: string;
  message: string;
  stack?: string | null;
  component_stack?: string | null;
  user_agent?: string | null;
};

type AccountDeletionRequest = {
  id: string;
  user_id: string;
  user_name: string;
  reason?: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  requested_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
};

type AdminTab = 'pending' | 'history' | 'accounts' | 'usage' | 'errors';

const typeMeta: Record<string, { label: string; icon: typeof MessageSquare }> = {
  post: { label: 'Post do feed', icon: MessageSquare },
  comment: { label: 'Comentário', icon: MessageSquare },
  event: { label: 'Evento do mural', icon: CalendarDays },
};

const routeLabels: Record<string, string> = {
  '/': 'Feed',
  '/mapa': 'Mapa',
  '/estatisticas': 'Dados',
  '/empregos': 'Empregos',
  '/mural': 'Mural',
  '/denuncias': 'Denúncias',
  '/perfil': 'Perfil',
  '/perfil/:id': 'Perfil público',
  '/post/:id': 'Detalhe de relato',
  '/empresa': 'Área da empresa',
  '/empresa/:id': 'Perfil de empresa',
  '/notificacoes': 'Notificações',
  '/admin': 'Admin',
  '/privacidade': 'Privacidade',
  '/termos': 'Termos',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

export default function Admin() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('pending');
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [historyItems, setHistoryItems] = useState<ModerationHistoryItem[]>([]);
  const [usageItems, setUsageItems] = useState<UsageRow[]>([]);
  const [errorItems, setErrorItems] = useState<ClientErrorItem[]>([]);
  const [accountRequests, setAccountRequests] = useState<AccountDeletionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [usageError, setUsageError] = useState('');
  const [clientError, setClientError] = useState('');
  const [accountsError, setAccountsError] = useState('');
  const [historyAction, setHistoryAction] = useState('all');
  const [historyType, setHistoryType] = useState('all');
  const [historyModerator, setHistoryModerator] = useState('all');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let result = await supabase.rpc('get_moderation_queue_v2', { p_limit: 100 });
      if (result.error && /get_moderation_queue_v2/i.test(result.error.message || '')) {
        result = await supabase.rpc('get_moderation_queue', { p_limit: 100 });
      }
      if (result.error) throw result.error;
      setItems((result.data || []) as ModerationItem[]);
    } catch (err: any) {
      setItems([]);
      setError(err?.message || 'Não foi possível carregar as denúncias.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const result = await supabase.rpc('get_moderation_history', { p_limit: 200 });
      if (result.error) throw result.error;
      setHistoryItems((result.data || []) as ModerationHistoryItem[]);
    } catch (err: any) {
      setHistoryItems([]);
      setHistoryError(err?.message || 'Não foi possível carregar o histórico de moderação.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    setUsageError('');
    try {
      const result = await supabase.rpc('get_usage_analytics', { p_days: 30 });
      if (result.error) throw result.error;
      setUsageItems((result.data || []) as UsageRow[]);
    } catch (err: any) {
      setUsageItems([]);
      setUsageError(err?.message || 'Não foi possível carregar as métricas de uso.');
    } finally {
      setUsageLoading(false);
    }
  }, []);

  const loadErrors = useCallback(async () => {
    setErrorsLoading(true);
    setClientError('');
    try {
      const result = await supabase.rpc('get_client_error_logs', { p_limit: 150 });
      if (result.error) throw result.error;
      setErrorItems((result.data || []) as ClientErrorItem[]);
    } catch (err: any) {
      setErrorItems([]);
      setClientError(err?.message || 'Não foi possível carregar os erros do aplicativo.');
    } finally {
      setErrorsLoading(false);
    }
  }, []);

  const loadAccountRequests = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError('');
    try {
      const result = await supabase.from('account_deletion_requests')
        .select('id,user_id,reason,status,requested_at,reviewed_at,reviewed_by')
        .order('requested_at', { ascending: false })
        .limit(200);
      if (result.error) throw result.error;
      const rows = result.data || [];
      const userIds = Array.from(new Set(rows.map(row => row.user_id).filter(Boolean)));
      const names = new Map<string, string>();
      if (userIds.length) {
        const profiles = await supabase.from('users').select('id,name').in('id', userIds);
        if (!profiles.error) for (const profile of profiles.data || []) names.set(profile.id, profile.name || 'Morador');
      }
      setAccountRequests(rows.map(row => ({ ...row, user_name: names.get(row.user_id) || 'Morador' })) as AccountDeletionRequest[]);
    } catch (err: any) {
      setAccountRequests([]);
      setAccountsError(err?.message || 'Não foi possível carregar as solicitações de conta.');
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!isAuthenticated) {
        setCheckingAccess(false);
        setAllowed(false);
        return;
      }
      const { data, error: accessError } = await supabase.rpc('is_moderator');
      if (!active) return;
      const canModerate = !accessError && Boolean(data);
      setAllowed(canModerate);
      setCheckingAccess(false);
      if (canModerate) {
        void loadQueue();
        void loadHistory();
        void loadUsage();
        void loadErrors();
        void loadAccountRequests();
      }
    };
    void check();
    return () => { active = false; };
  }, [isAuthenticated, loadQueue, loadHistory, loadUsage, loadErrors, loadAccountRequests]);

  const counts = useMemo(() => items.reduce((acc, item) => {
    const key = item.content_type || 'post';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [items]);

  const moderators = useMemo(() => Array.from(new Set(historyItems.map(item => item.moderator_name).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [historyItems]);

  const filteredHistory = useMemo(() => historyItems.filter((item) => {
    if (historyAction !== 'all' && item.moderation_action !== historyAction) return false;
    if (historyType !== 'all' && item.content_type !== historyType) return false;
    if (historyModerator !== 'all' && item.moderator_name !== historyModerator) return false;
    const moderatedAt = new Date(item.moderated_at).getTime();
    if (historyFrom) {
      const start = new Date(`${historyFrom}T00:00:00`).getTime();
      if (moderatedAt < start) return false;
    }
    if (historyTo) {
      const end = new Date(`${historyTo}T23:59:59.999`).getTime();
      if (moderatedAt > end) return false;
    }
    return true;
  }), [historyItems, historyAction, historyType, historyModerator, historyFrom, historyTo]);

  const historyCounts = useMemo(() => filteredHistory.reduce((acc, item) => {
    if (item.moderation_action === 'ignore') acc.kept += 1;
    else acc.removed += 1;
    return acc;
  }, { kept: 0, removed: 0 }), [filteredHistory]);

  const usageByPath = useMemo(() => {
    const out = new Map<string, number>();
    for (const row of usageItems) out.set(row.path, (out.get(row.path) || 0) + Number(row.views || 0));
    return Array.from(out.entries()).map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views);
  }, [usageItems]);
  const totalViews = useMemo(() => usageByPath.reduce((sum, row) => sum + row.views, 0), [usageByPath]);
  const activeDays = useMemo(() => new Set(usageItems.map(row => row.day)).size, [usageItems]);
  const maxPathViews = Math.max(1, ...usageByPath.map(row => row.views));

  const recentErrorCount = useMemo(() => {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    return errorItems.filter(item => new Date(item.created_at).getTime() >= since).length;
  }, [errorItems]);

  const pendingAccountRequests = useMemo(() => accountRequests.filter(item => item.status === 'pending'), [accountRequests]);

  const reviewAccountRequest = async (item: AccountDeletionRequest, status: 'completed' | 'cancelled') => {
    if (!user?.id || actingId) return;
    if (status === 'completed' && !window.confirm('Confirme somente se a conta já foi excluída no Supabase Auth. Esta ação apenas fecha o registro da solicitação.')) return;
    setActingId(item.id);
    try {
      const { error: reviewError } = await supabase.from('account_deletion_requests').update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      }).eq('id', item.id).eq('status', 'pending');
      if (reviewError) throw reviewError;
      setAccountRequests(previous => previous.map(requestItem => requestItem.id === item.id ? {
        ...requestItem,
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      } : requestItem));
      toast(status === 'completed' ? 'Solicitação marcada como concluída.' : 'Solicitação cancelada.', status === 'completed' ? 'success' : 'info');
    } catch (err: any) {
      toast(err?.message || 'Não foi possível revisar a solicitação.', 'error');
    } finally {
      setActingId(null);
    }
  };

  const moderate = async (item: ModerationItem, action: 'ignore' | 'remove') => {
    if (actingId) return;
    if (action === 'remove' && !window.confirm(`Excluir definitivamente este ${item.content_type === 'event' ? 'evento' : item.content_type === 'comment' ? 'comentário' : 'post'}?`)) return;
    setActingId(item.report_id);
    try {
      const { data, error: moderationError } = await supabase.rpc('moderate_content_report', {
        p_report_id: item.report_id,
        p_action: action,
      });
      if (moderationError || !data) throw moderationError || new Error('A ação não foi concluída.');
      setItems(previous => previous.filter(report => report.report_id !== item.report_id));
      void loadHistory();
      toast(action === 'remove' ? 'Conteúdo excluído e denúncia resolvida.' : 'Conteúdo mantido e denúncia arquivada.', action === 'remove' ? 'info' : 'success');
    } catch (err: any) {
      toast(err?.message || 'Não foi possível concluir a moderação.', 'error');
    } finally {
      setActingId(null);
    }
  };

  const openContent = (item: ModerationItem) => {
    if (item.event_id) {
      try { sessionStorage.setItem('anb-mural-focus-event', item.event_id); } catch {}
      navigate('/mural');
      return;
    }
    if (item.post_id) navigate(`/post/${item.post_id}`);
  };

  const refreshActiveTab = () => {
    if (activeTab === 'history') void loadHistory();
    else if (activeTab === 'accounts') void loadAccountRequests();
    else if (activeTab === 'usage') void loadUsage();
    else if (activeTab === 'errors') void loadErrors();
    else void loadQueue();
  };

  if (checkingAccess) return <div className="py-16 text-center text-sm text-slate-400">Verificando acesso administrativo...</div>;

  if (!isAuthenticated) return (
    <div className="max-w-xl mx-auto py-10"><Card className="text-center"><ShieldCheck className="w-12 h-12 mx-auto text-slate-300 mb-4" /><h1 className="text-xl font-bold text-slate-900 dark:text-white">Área administrativa</h1><p className="text-sm text-slate-500 mt-2">Entre em uma conta administrativa para acessar a moderação.</p><Button className="mt-5" onClick={() => navigate('/login')}>Entrar</Button></Card></div>
  );

  if (!allowed) return (
    <div className="max-w-xl mx-auto py-10"><Card className="text-center"><AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" /><h1 className="text-xl font-bold text-slate-900 dark:text-white">Acesso restrito</h1><p className="text-sm text-slate-500 mt-2">Sua conta não possui permissão de administrador ou moderador.</p><Button variant="secondary" className="mt-5" onClick={() => navigate('/')}>Voltar ao feed</Button></Card></div>
  );

  const refreshing = activeTab === 'history' ? historyLoading : activeTab === 'accounts' ? accountsLoading : activeTab === 'usage' ? usageLoading : activeTab === 'errors' ? errorsLoading : loading;
  const tabs: { id: AdminTab; label: string; icon: typeof AlertTriangle; count?: number }[] = [
    { id: 'pending', label: 'Pendentes', icon: AlertTriangle, count: items.length },
    { id: 'history', label: 'Histórico', icon: HistoryIcon, count: historyItems.length },
    { id: 'accounts', label: 'Contas', icon: UserX, count: pendingAccountRequests.length },
    { id: 'usage', label: 'Uso', icon: BarChart3 },
    { id: 'errors', label: 'Erros', icon: Bug, count: recentErrorCount },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-1"><ShieldCheck className="w-5 h-5" /><span className="text-xs font-black uppercase tracking-widest">Administração</span></div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Painel administrativo</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Modere a comunidade, acompanhe decisões, veja uso agregado e identifique falhas do aplicativo.</p>
        </div>
        <button onClick={refreshActiveTab} disabled={refreshing} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 text-slate-500 hover:text-emerald-600 disabled:opacity-50" aria-label="Atualizar painel"><RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} /></button>
      </div>

      <div className="flex w-full overflow-x-auto no-scrollbar rounded-2xl bg-slate-100 dark:bg-slate-900 p-1" role="tablist" aria-label="Seções administrativas">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`min-w-max flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><Icon className="w-4 h-4" />{tab.label}{typeof tab.count === 'number' && <span className="min-w-5 h-5 px-1.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[11px] flex items-center justify-center">{tab.count}</span>}</button>;
        })}
      </div>

      {activeTab === 'pending' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Pendentes</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{items.length}</p></Card>
            <Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Posts</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{counts.post || 0}</p></Card>
            <Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Comentários</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{counts.comment || 0}</p></Card>
            <Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Mural</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{counts.event || 0}</p></Card>
          </div>
          {error && <Card className="!border-red-200 dark:!border-red-500/20"><p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p></Card>}
          {!loading && !error && items.length === 0 ? <EmptyState icon={ShieldCheck} title="Nenhuma denúncia pendente" description="A fila de moderação está em dia." /> : (
            <div className="space-y-3">{items.map(item => {
              const meta = typeMeta[item.content_type] || typeMeta.post; const Icon = meta.icon; const busy = actingId === item.report_id;
              return <Card key={item.report_id} className="!p-5"><div className="flex flex-col gap-4">
                <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-red-600 dark:text-red-400" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{meta.label}</span><span className="text-[11px] text-slate-400">{formatDate(item.reported_at)}</span></div><h2 className="text-base font-bold text-slate-900 dark:text-white mt-2">{item.content_title || 'Conteúdo denunciado'}</h2><p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line line-clamp-4">{item.content_preview || 'Sem prévia disponível.'}</p></div></div>
                <div className="rounded-xl bg-red-50/70 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-red-500">Motivo da denúncia</p><p className="text-sm font-semibold text-red-700 dark:text-red-300 mt-1">{item.reason}</p></div>
                <div className="grid sm:grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400"><p><strong className="text-slate-700 dark:text-slate-300">Autor:</strong> {item.content_author_name || 'Não identificado'}</p><p><strong className="text-slate-700 dark:text-slate-300">Denunciante:</strong> {item.reporter_name || 'Não identificado'}</p></div>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">{(item.post_id || item.event_id) && <Button variant="secondary" size="sm" onClick={() => openContent(item)}>Ver conteúdo</Button>}<Button variant="secondary" size="sm" disabled={Boolean(actingId)} onClick={() => void moderate(item, 'ignore')}><Check className="w-4 h-4" />Deixar</Button><Button size="sm" disabled={Boolean(actingId)} className="!bg-red-600 hover:!bg-red-700 !text-white" onClick={() => void moderate(item, 'remove')}>{busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Excluir</Button></div>
              </div></Card>;
            })}</div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <>
          <div className="grid grid-cols-3 gap-3"><Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Exibindo</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{filteredHistory.length}</p></Card><Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Mantidos</p><p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{historyCounts.kept}</p></Card><Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Excluídos</p><p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{historyCounts.removed}</p></Card></div>

          <Card className="!p-4"><div className="flex items-center gap-2 mb-3"><Filter className="w-4 h-4 text-slate-500" /><h2 className="text-sm font-black text-slate-800 dark:text-slate-100">Filtros do histórico</h2></div><div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-2">
            <select value={historyAction} onChange={e => setHistoryAction(e.target.value)} className="min-h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold"><option value="all">Todas as decisões</option><option value="ignore">Mantidos</option><option value="remove">Excluídos</option></select>
            <select value={historyType} onChange={e => setHistoryType(e.target.value)} className="min-h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold"><option value="all">Todos os tipos</option><option value="post">Posts</option><option value="comment">Comentários</option><option value="event">Mural</option></select>
            <select value={historyModerator} onChange={e => setHistoryModerator(e.target.value)} className="min-h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold"><option value="all">Todos os moderadores</option>{moderators.map(name => <option key={name} value={name}>{name}</option>)}</select>
            <input type="date" aria-label="Data inicial" value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} className="min-h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold" />
            <input type="date" aria-label="Data final" value={historyTo} onChange={e => setHistoryTo(e.target.value)} className="min-h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold" />
          </div></Card>

          {historyError && <Card className="!border-red-200 dark:!border-red-500/20"><p className="text-sm font-semibold text-red-600 dark:text-red-400">{historyError}</p></Card>}
          {!historyLoading && !historyError && filteredHistory.length === 0 ? <EmptyState icon={HistoryIcon} title="Nenhuma decisão com esses filtros" description="Altere os filtros ou aguarde novas decisões de moderação." /> : (
            <div className="space-y-3">{filteredHistory.map(item => {
              const meta = typeMeta[item.content_type] || typeMeta.post; const Icon = meta.icon; const kept = item.moderation_action === 'ignore';
              return <Card key={item.report_id} className="!p-5"><div className="flex flex-col gap-4"><div className="flex items-start gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${kept ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}><Icon className={`w-5 h-5 ${kept ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{meta.label}</span><span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${kept ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300'}`}>{kept ? 'Mantido' : 'Excluído'}</span><span className="text-[11px] text-slate-400">{formatDate(item.moderated_at)}</span></div><h2 className="text-base font-bold text-slate-900 dark:text-white mt-2">{item.content_title || 'Conteúdo moderado'}</h2><p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line line-clamp-4">{item.content_preview || 'Sem prévia arquivada.'}</p></div></div><div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo original</p><p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">{item.reason}</p></div><div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400"><p><strong className="text-slate-700 dark:text-slate-300">Autor:</strong> {item.content_author_name || 'Não identificado'}</p><p><strong className="text-slate-700 dark:text-slate-300">Denunciante:</strong> {item.reporter_name || 'Não identificado'}</p><p><strong className="text-slate-700 dark:text-slate-300">Moderado por:</strong> {item.moderator_name || 'Administrador'}</p><p><strong className="text-slate-700 dark:text-slate-300">Denunciado em:</strong> {formatDate(item.reported_at)}</p></div></div></Card>;
            })}</div>
          )}
        </>
      )}

      {activeTab === 'accounts' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Pendentes</p><p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{pendingAccountRequests.length}</p></Card>
            <Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Concluídas</p><p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{accountRequests.filter(item => item.status === 'completed').length}</p></Card>
            <Card className="!p-4 col-span-2 sm:col-span-1"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Canceladas</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{accountRequests.filter(item => item.status === 'cancelled').length}</p></Card>
          </div>
          <Card className="!p-4 bg-sky-50/60 dark:bg-sky-500/5 !border-sky-100 dark:!border-sky-500/15">
            <p className="text-xs leading-relaxed text-sky-800 dark:text-sky-200"><strong>Importante:</strong> marcar como concluída não apaga o usuário do Supabase Auth. Faça a exclusão efetiva pelo painel seguro do Supabase e só depois encerre a solicitação aqui.</p>
          </Card>
          {accountsError && <Card className="!border-red-200 dark:!border-red-500/20"><p className="text-sm font-semibold text-red-600 dark:text-red-400">{accountsError}</p></Card>}
          {!accountsLoading && !accountsError && accountRequests.length === 0 ? (
            <EmptyState icon={UserX} title="Nenhuma solicitação de exclusão" description="Quando um morador solicitar a exclusão da conta, ela aparecerá aqui." />
          ) : (
            <div className="space-y-3">
              {accountRequests.map(item => {
                const pending = item.status === 'pending';
                const busy = actingId === item.id;
                return (
                  <Card key={item.id} className="!p-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${pending ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : item.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}><UserX className="h-5 w-5" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{item.user_name}</h2>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${pending ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : item.status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{pending ? 'Pendente' : item.status === 'completed' ? 'Concluída' : 'Cancelada'}</span>
                          </div>
                          <p className="mt-1 break-all font-mono text-[10px] text-slate-400">ID: {item.user_id}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Solicitada em {formatDate(item.requested_at)}</p>
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo informado</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">{item.reason || 'Nenhum motivo informado.'}</p>
                      </div>
                      {pending && (
                        <div className="flex flex-col justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row">
                          <Button type="button" variant="secondary" size="sm" disabled={Boolean(actingId)} onClick={() => void reviewAccountRequest(item, 'cancelled')}><Ban className="h-4 w-4" /> Cancelar pedido</Button>
                          <Button type="button" size="sm" disabled={Boolean(actingId)} onClick={() => void reviewAccountRequest(item, 'completed')}>{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar exclusão concluída</Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'usage' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Visualizações</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalViews}</p></Card><Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Dias com dados</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{activeDays}</p></Card><Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Rotas usadas</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{usageByPath.length}</p></Card><Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Período</p><p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-2">30 dias</p></Card></div>
          <Card className="!p-4 bg-sky-50/50 dark:bg-sky-500/5 !border-sky-100 dark:!border-sky-500/15"><p className="text-xs leading-relaxed text-sky-800 dark:text-sky-200"><strong>Privacidade:</strong> estas métricas são apenas contagens por página e dia. Não armazenam IP, e-mail, ID do usuário ou dispositivo.</p></Card>
          {usageError && <Card className="!border-red-200 dark:!border-red-500/20"><p className="text-sm font-semibold text-red-600 dark:text-red-400">{usageError}</p></Card>}
          {!usageLoading && !usageError && usageByPath.length === 0 ? <EmptyState icon={BarChart3} title="Métricas ainda vazias" description="Os números começarão a aparecer conforme o novo monitoramento receber acessos." /> : <Card className="!p-5"><div className="space-y-4">{usageByPath.map(row => <div key={row.path}><div className="flex items-center justify-between gap-3 mb-1.5"><div className="min-w-0"><p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{routeLabels[row.path] || row.path}</p><p className="text-[10px] text-slate-400 font-mono">{row.path}</p></div><span className="text-sm font-black text-slate-900 dark:text-white">{row.views}</span></div><div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(3, (row.views / maxPathViews) * 100)}%` }} /></div></div>)}</div></Card>}
        </>
      )}

      {activeTab === 'errors' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3"><Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Últimas 24h</p><p className={`text-2xl font-black mt-1 ${recentErrorCount ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{recentErrorCount}</p></Card><Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Carregados</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{errorItems.length}</p></Card><Card className="!p-4 col-span-2 sm:col-span-1"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Retenção</p><p className="text-lg font-black text-slate-900 dark:text-white mt-2">até 90 dias</p></Card></div>
          <Card className="!p-4 bg-amber-50/60 dark:bg-amber-500/5 !border-amber-100 dark:!border-amber-500/15"><div className="flex gap-2"><Activity className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" /><p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">O navegador envia falhas não tratadas e erros de renderização. O registro ajuda a corrigir problemas antes de muitos usuários encontrarem o mesmo erro.</p></div></Card>
          {clientError && <Card className="!border-red-200 dark:!border-red-500/20"><p className="text-sm font-semibold text-red-600 dark:text-red-400">{clientError}</p></Card>}
          {!errorsLoading && !clientError && errorItems.length === 0 ? <EmptyState icon={ShieldCheck} title="Nenhum erro registrado" description="Ótimo sinal: ainda não houve falhas de navegador capturadas pelo novo monitoramento." /> : <div className="space-y-3">{errorItems.map(item => <Card key={String(item.id)} className="!p-5"><div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0"><Bug className="w-5 h-5 text-red-600 dark:text-red-400" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400"><span className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{item.path}</span><span>{formatDate(item.created_at)}</span></div><p className="text-sm font-bold text-slate-900 dark:text-white mt-2 break-words">{item.message}</p><p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Usuário: {item.user_name || (item.user_id ? item.user_id : 'Visitante')}</p>{(item.stack || item.component_stack || item.user_agent) && <details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-emerald-700 dark:text-emerald-400">Ver detalhes técnicos</summary><div className="mt-2 space-y-2">{item.user_agent && <p className="text-[11px] text-slate-500 break-words"><strong>Navegador:</strong> {item.user_agent}</p>}{item.stack && <pre className="text-[10px] leading-relaxed whitespace-pre-wrap break-words bg-slate-950 text-slate-200 rounded-xl p-3 max-h-56 overflow-auto">{item.stack}</pre>}{item.component_stack && <pre className="text-[10px] leading-relaxed whitespace-pre-wrap break-words bg-slate-950 text-slate-200 rounded-xl p-3 max-h-56 overflow-auto">{item.component_stack}</pre>}</div></details>}</div></div></Card>)}</div>}
        </>
      )}
    </div>
  );
}
