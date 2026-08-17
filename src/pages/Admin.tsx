import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, History as HistoryIcon, MessageSquare, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
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

const typeMeta: Record<string, { label: string; icon: typeof MessageSquare }> = {
  post: { label: 'Post do feed', icon: MessageSquare },
  comment: { label: 'Comentário', icon: MessageSquare },
  event: { label: 'Evento do mural', icon: CalendarDays },
};

export default function Admin() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [historyItems, setHistoryItems] = useState<ModerationHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');

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
      }
    };
    void check();
    return () => { active = false; };
  }, [isAuthenticated, loadQueue, loadHistory]);

  const counts = useMemo(() => items.reduce((acc, item) => {
    const key = item.content_type || 'post';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [items]);

  const historyCounts = useMemo(() => historyItems.reduce((acc, item) => {
    if (item.moderation_action === 'ignore') acc.kept += 1;
    else acc.removed += 1;
    return acc;
  }, { kept: 0, removed: 0 }), [historyItems]);

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
      navigate('/mural');
      return;
    }
    if (item.post_id) navigate(`/post/${item.post_id}`);
  };

  const refreshActiveTab = () => {
    if (activeTab === 'history') void loadHistory();
    else void loadQueue();
  };

  if (checkingAccess) return <div className="py-16 text-center text-sm text-slate-400">Verificando acesso administrativo...</div>;

  if (!isAuthenticated) return (
    <div className="max-w-xl mx-auto py-10">
      <Card className="text-center">
        <ShieldCheck className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Área administrativa</h1>
        <p className="text-sm text-slate-500 mt-2">Entre em uma conta administrativa para acessar a moderação.</p>
        <Button className="mt-5" onClick={() => navigate('/login')}>Entrar</Button>
      </Card>
    </div>
  );

  if (!allowed) return (
    <div className="max-w-xl mx-auto py-10">
      <Card className="text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Acesso restrito</h1>
        <p className="text-sm text-slate-500 mt-2">Sua conta não possui permissão de administrador ou moderador.</p>
        <Button variant="secondary" className="mt-5" onClick={() => navigate('/')}>Voltar ao feed</Button>
      </Card>
    </div>
  );

  const refreshing = activeTab === 'history' ? historyLoading : loading;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-1"><ShieldCheck className="w-5 h-5" /><span className="text-xs font-black uppercase tracking-widest">Administração</span></div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Moderação</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Analise denúncias pendentes e consulte todas as decisões administrativas já tomadas.</p>
        </div>
        <button onClick={refreshActiveTab} disabled={refreshing} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 text-slate-500 hover:text-emerald-600 disabled:opacity-50" aria-label="Atualizar moderação">
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="inline-flex w-full sm:w-auto rounded-2xl bg-slate-100 dark:bg-slate-900 p-1" role="tablist" aria-label="Seções da moderação">
        <button type="button" role="tab" aria-selected={activeTab === 'pending'} onClick={() => setActiveTab('pending')} className={`flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
          <AlertTriangle className="w-4 h-4" /> Pendentes
          <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 text-[11px] flex items-center justify-center">{items.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'history'} onClick={() => setActiveTab('history')} className={`flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
          <HistoryIcon className="w-4 h-4" /> Histórico
          <span className="min-w-5 h-5 px-1.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] flex items-center justify-center">{historyItems.length}</span>
        </button>
      </div>

      {activeTab === 'pending' ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Pendentes</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{items.length}</p></Card>
            <Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Posts</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{counts.post || 0}</p></Card>
            <Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Comentários</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{counts.comment || 0}</p></Card>
            <Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Mural</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{counts.event || 0}</p></Card>
          </div>

          {error && <Card className="!border-red-200 dark:!border-red-500/20"><p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p></Card>}

          {!loading && !error && items.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Nenhuma denúncia pendente" description="A fila de moderação está em dia." />
          ) : (
            <div className="space-y-3">
              {items.map(item => {
                const meta = typeMeta[item.content_type] || typeMeta.post;
                const Icon = meta.icon;
                const busy = actingId === item.report_id;
                return (
                  <Card key={item.report_id} className="!p-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{meta.label}</span>
                            <span className="text-[11px] text-slate-400">{new Date(item.reported_at).toLocaleString('pt-BR')}</span>
                          </div>
                          <h2 className="text-base font-bold text-slate-900 dark:text-white mt-2">{item.content_title || 'Conteúdo denunciado'}</h2>
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line line-clamp-4">{item.content_preview || 'Sem prévia disponível.'}</p>
                        </div>
                      </div>

                      <div className="rounded-xl bg-red-50/70 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Motivo da denúncia</p>
                        <p className="text-sm font-semibold text-red-700 dark:text-red-300 mt-1">{item.reason}</p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <p><strong className="text-slate-700 dark:text-slate-300">Autor:</strong> {item.content_author_name || 'Não identificado'}</p>
                        <p><strong className="text-slate-700 dark:text-slate-300">Denunciante:</strong> {item.reporter_name || 'Não identificado'}</p>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                        {(item.post_id || item.event_id) && <Button variant="secondary" size="sm" onClick={() => openContent(item)}>Ver conteúdo</Button>}
                        <Button variant="secondary" size="sm" disabled={Boolean(actingId)} onClick={() => void moderate(item, 'ignore')}><Check className="w-4 h-4" />Deixar</Button>
                        <Button size="sm" disabled={Boolean(actingId)} className="!bg-red-600 hover:!bg-red-700 !text-white" onClick={() => void moderate(item, 'remove')}>
                          {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Excluir
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Decisões</p><p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{historyItems.length}</p></Card>
            <Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Mantidos</p><p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{historyCounts.kept}</p></Card>
            <Card className="!p-4"><p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Excluídos</p><p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{historyCounts.removed}</p></Card>
          </div>

          {historyError && <Card className="!border-red-200 dark:!border-red-500/20"><p className="text-sm font-semibold text-red-600 dark:text-red-400">{historyError}</p></Card>}

          {!historyLoading && !historyError && historyItems.length === 0 ? (
            <EmptyState icon={HistoryIcon} title="Nenhuma decisão registrada" description="As decisões de moderação aparecerão aqui." />
          ) : (
            <div className="space-y-3">
              {historyItems.map(item => {
                const meta = typeMeta[item.content_type] || typeMeta.post;
                const Icon = meta.icon;
                const kept = item.moderation_action === 'ignore';
                return (
                  <Card key={item.report_id} className="!p-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${kept ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
                          <Icon className={`w-5 h-5 ${kept ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{meta.label}</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${kept ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300'}`}>{kept ? 'Mantido' : 'Excluído'}</span>
                            <span className="text-[11px] text-slate-400">{new Date(item.moderated_at).toLocaleString('pt-BR')}</span>
                          </div>
                          <h2 className="text-base font-bold text-slate-900 dark:text-white mt-2">{item.content_title || 'Conteúdo moderado'}</h2>
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line line-clamp-4">{item.content_preview || 'Sem prévia arquivada.'}</p>
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo original da denúncia</p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">{item.reason}</p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                        <p><strong className="text-slate-700 dark:text-slate-300">Autor:</strong> {item.content_author_name || 'Não identificado'}</p>
                        <p><strong className="text-slate-700 dark:text-slate-300">Denunciante:</strong> {item.reporter_name || 'Não identificado'}</p>
                        <p><strong className="text-slate-700 dark:text-slate-300">Moderado por:</strong> {item.moderator_name || 'Administrador'}</p>
                        <p><strong className="text-slate-700 dark:text-slate-300">Denunciado em:</strong> {new Date(item.reported_at).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
