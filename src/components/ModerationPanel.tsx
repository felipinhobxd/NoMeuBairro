import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { Card } from './UI';

type ModerationItem = {
  report_id: string;
  reason: string;
  report_status: string;
  reported_at: string;
  post_id?: string | null;
  comment_id?: string | null;
  event_id?: string | null;
  content_type: 'post' | 'comment' | 'event' | 'removed';
  content_title: string;
  content_preview: string;
  content_author_name: string;
  reporter_name: string;
};

const typeLabel: Record<ModerationItem['content_type'], string> = {
  post: 'Relato do Feed',
  comment: 'Comentário',
  event: 'Evento do Mural',
  removed: 'Conteúdo removido',
};

export default function ModerationPanel() {
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const loadQueue = async () => {
    setLoading(true);
    setMessage('');
    const { data, error } = await supabase.rpc('get_moderation_queue', { p_limit: 100 });
    if (error) {
      console.error('Erro ao carregar moderação:', error);
      setMessage('Não foi possível carregar a fila de denúncias.');
      setItems([]);
    } else {
      setItems(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    void supabase.rpc('is_moderator').then(({ data, error }) => {
      if (!active) return;
      const canModerate = !error && data === true;
      setAllowed(canModerate);
      setChecked(true);
      if (canModerate) void loadQueue();
    });
    return () => { active = false; };
  }, []);

  const act = async (item: ModerationItem, action: 'ignore' | 'remove') => {
    const label = typeLabel[item.content_type].toLowerCase();
    if (action === 'remove' && !window.confirm(`Excluir este ${label} da comunidade? Esta ação não pode ser desfeita.`)) return;

    setActingId(item.report_id);
    setMessage('');
    const { data, error } = await supabase.rpc('moderate_content_report', {
      p_report_id: item.report_id,
      p_action: action,
    });

    if (error || data !== true) {
      console.error('Erro ao moderar conteúdo:', error);
      setMessage('Não foi possível concluir esta ação.');
    } else {
      setMessage(action === 'remove'
        ? 'Conteúdo excluído e denúncias relacionadas resolvidas.'
        : 'Conteúdo mantido e denúncias relacionadas arquivadas.');
      await loadQueue();
    }
    setActingId(null);
  };

  if (!checked || !allowed) return null;

  return (
    <Card className="!p-0 overflow-hidden ring-1 ring-orange-200 dark:ring-orange-500/20">
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-orange-50/60 dark:bg-orange-500/5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-700 dark:text-orange-300" /> Área de administração
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Analise denúncias do Feed, comentários e eventos do Mural.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-orange-100 dark:bg-orange-500/10 px-2.5 py-1 text-xs font-black text-orange-800 dark:text-orange-300">
            {items.length} pendente{items.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => void loadQueue()}
            disabled={loading}
            className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 inline-flex items-center justify-center text-slate-500 hover:text-orange-700 disabled:opacity-50"
            aria-label="Atualizar denúncias"
          >
            <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {message && <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200">{message}</div>}

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Carregando denúncias...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center">
            <ShieldCheck className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <p className="font-bold text-slate-900 dark:text-white">Fila limpa</p>
            <p className="text-sm text-slate-500 mt-1">Nenhuma denúncia aguarda análise.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.report_id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wide text-red-600 dark:text-red-400">{typeLabel[item.content_type]}</span>
                      <span className="text-[10px] text-slate-400">{new Date(item.reported_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white mt-1 break-words">{item.content_title || 'Conteúdo'}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-4 whitespace-pre-line break-words">{item.content_preview || 'Conteúdo não disponível.'}</p>
                    <div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-600 dark:text-slate-300">
                      <strong>Motivo:</strong> {item.reason}
                      <br />
                      <span className="text-slate-500">Autor: {item.content_author_name || 'Morador'} · Denunciado por: {item.reporter_name || 'Não identificado'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={actingId === item.report_id}
                    onClick={() => void act(item, 'ignore')}
                    className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Check className="w-4 h-4" /> Manter conteúdo
                  </button>
                  <button
                    type="button"
                    disabled={actingId === item.report_id}
                    onClick={() => void act(item, 'remove')}
                    className="min-h-11 rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actingId === item.report_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Excluir conteúdo
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
