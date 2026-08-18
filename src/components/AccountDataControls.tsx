import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, ShieldCheck, Undo2, UserX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import { Button, Card, Modal, Textarea, useToast } from './UI';

type DeletionRequest = {
  id: string;
  user_id: string;
  reason?: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  requested_at: string;
};

export default function AccountDataControls() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [submittingDeletion, setSubmittingDeletion] = useState(false);

  const loadPendingRequest = useCallback(async () => {
    if (!user?.id) {
      setRequest(null);
      setLoadingRequest(false);
      return;
    }
    setLoadingRequest(true);
    const { data, error } = await supabase
      .from('account_deletion_requests')
      .select('id,user_id,reason,status,requested_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) console.warn('Não foi possível consultar a solicitação da conta:', error);
    setRequest((data as DeletionRequest | null) || null);
    setLoadingRequest(false);
  }, [user?.id]);

  useEffect(() => { void loadPendingRequest(); }, [loadPendingRequest]);

  const downloadMyData = async () => {
    if (!user?.id || exporting) return;
    setExporting(true);
    try {
      const sources = [
        { key: 'perfil_publico', request: supabase.from('users').select('id,name,account_type,avatar_url,reputation,created_at,updated_at').eq('id', user.id) },
        { key: 'relatos', request: supabase.from('posts').select('*').eq('author_id', user.id) },
        { key: 'comentarios', request: supabase.from('comments').select('*').eq('author_id', user.id) },
        { key: 'apoios', request: supabase.from('post_supports').select('*').eq('user_id', user.id) },
        { key: 'eventos_criados', request: supabase.from('events').select('*').eq('created_by', user.id) },
        { key: 'presencas_em_eventos', request: supabase.from('event_attendance').select('*').eq('user_id', user.id) },
        { key: 'bairros_seguidos', request: supabase.from('neighborhood_follows').select('*').eq('user_id', user.id) },
        { key: 'itens_salvos', request: supabase.from('saved_items').select('*').eq('user_id', user.id) },
        { key: 'curriculos', request: supabase.from('user_resumes').select('*').eq('user_id', user.id) },
        { key: 'candidaturas', request: supabase.from('job_applications').select('*').eq('user_id', user.id) },
        { key: 'notificacoes', request: supabase.from('notifications').select('*').eq('user_id', user.id) },
        { key: 'solicitacoes_de_exclusao', request: supabase.from('account_deletion_requests').select('*').eq('user_id', user.id) },
      ];
      const results = await Promise.all(sources.map(source => source.request));
      const data: Record<string, unknown> = {};
      const unavailable: string[] = [];
      results.forEach((result, index) => {
        const key = sources[index].key;
        if (result.error) unavailable.push(key);
        else data[key] = result.data || [];
      });

      const payload = {
        exportado_em: new Date().toISOString(),
        conta: {
          id: user.id,
          nome: user.name,
          email: user.email,
          tipo: user.accountType || 'resident',
          criada_em: user.createdAt,
        },
        dados: data,
        conjuntos_indisponiveis: unavailable,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nomeubairro-dados-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast(unavailable.length ? 'Seus dados foram baixados; alguns conjuntos indisponíveis foram identificados no arquivo.' : 'Seus dados foram baixados com sucesso!');
    } catch (error: any) {
      toast(error?.message || 'Não foi possível preparar seus dados.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const submitDeletionRequest = async () => {
    if (!user?.id || submittingDeletion) return;
    setSubmittingDeletion(true);
    try {
      const { data, error } = await supabase.from('account_deletion_requests').insert({
        user_id: user.id,
        reason: deletionReason.trim() || null,
        status: 'pending',
      }).select('id,user_id,reason,status,requested_at').single();
      if (error) {
        toast(error.code === '23505' ? 'Já existe uma solicitação pendente para esta conta.' : error.message, 'error');
        return;
      }
      setRequest(data as DeletionRequest);
      setDeletionReason('');
      setShowDeletionModal(false);
      toast('Solicitação registrada. A conta continuará ativa até a revisão administrativa.', 'info');
    } finally {
      setSubmittingDeletion(false);
    }
  };

  const cancelDeletionRequest = async () => {
    if (!request || submittingDeletion) return;
    setSubmittingDeletion(true);
    try {
      const { error } = await supabase.from('account_deletion_requests').delete().eq('id', request.id).eq('status', 'pending');
      if (error) {
        toast(error.message || 'Não foi possível cancelar a solicitação.', 'error');
        return;
      }
      setRequest(null);
      toast('Solicitação de exclusão cancelada.');
    } finally {
      setSubmittingDeletion(false);
    }
  };

  return (
    <>
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Seus dados e sua privacidade</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Baixe uma cópia em JSON ou peça a exclusão da conta. Somente os seus próprios registros são incluídos.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="secondary" className="min-h-11" onClick={() => void downloadMyData()} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {exporting ? 'Preparando...' : 'Baixar meus dados'}
          </Button>
          {!request && !loadingRequest && (
            <Button type="button" variant="secondary" className="min-h-11 !text-red-600 dark:!text-red-400" onClick={() => setShowDeletionModal(true)}>
              <UserX className="h-4 w-4" /> Solicitar exclusão
            </Button>
          )}
        </div>

        {loadingRequest && <p className="mt-3 text-xs text-slate-400">Verificando solicitações...</p>}
        {request && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Exclusão aguardando revisão</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">Solicitada em {new Date(request.requested_at).toLocaleString('pt-BR')}. Sua conta ainda está ativa.</p>
            <button type="button" onClick={() => void cancelDeletionRequest()} disabled={submittingDeletion} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-60 dark:bg-slate-900 dark:text-amber-300 dark:ring-amber-500/20">
              <Undo2 className="h-4 w-4" /> {submittingDeletion ? 'Cancelando...' : 'Cancelar solicitação'}
            </button>
          </div>
        )}
      </Card>

      <Modal open={showDeletionModal} onClose={() => setShowDeletionModal(false)} title="Solicitar exclusão da conta">
        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            Esta solicitação não apaga nada imediatamente. Um administrador revisará o pedido antes da exclusão definitiva da conta e dos dados associados.
          </div>
          <Textarea label="Motivo (opcional)" value={deletionReason} onChange={event => setDeletionReason(event.target.value.slice(0, 1000))} placeholder="Conte o motivo, se desejar." rows={4} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowDeletionModal(false)}>Voltar</Button>
            <Button type="button" className="flex-1 !bg-red-600 hover:!bg-red-700" onClick={() => void submitDeletionRequest()} disabled={submittingDeletion}>
              {submittingDeletion ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />} Confirmar solicitação
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
