import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Gauge, RefreshCw, Send, Server } from 'lucide-react';
import { Button, Card, EmptyState, useToast } from './UI';
import { supabase } from '../utils/supabase';

type MonitoringSummary = {
  openAlerts: number; criticalOpenAlerts: number; clientErrorsToday: number;
  apiFailuresToday: number; slowPagesToday: number; slowApisToday: number;
  latestEventAt: string | null;
};
type ProductionAlert = {
  id: number; fingerprint: string; event_type: string; severity: 'warning' | 'error' | 'critical';
  path: string; target: string | null; message: string; code: string; is_test: boolean;
  status_code: number | null; occurrences: number; status: 'open' | 'resolved';
  first_triggered_at: string; last_triggered_at: string; resolved_at: string | null;
};
type ProductionEvent = Pick<ProductionAlert, 'fingerprint' | 'event_type' | 'severity' | 'path' | 'target' | 'message' | 'code' | 'is_test' | 'status_code'> & {
  day: string; device_class: string | null; release: string | null; samples: number;
  avg_duration_ms: number | null; max_duration_ms: number | null; last_seen_at: string;
};
type MonitoringPayload = {
  schemaVersion: 2; generatedAt: string; summary: MonitoringSummary;
  alerts: ProductionAlert[]; events: ProductionEvent[];
};
const typeLabels: Record<string, string> = {
  client_error: 'Erro do navegador', render_error: 'Falha de interface', resource_error: 'Arquivo essencial',
  api_error: 'Falha de API', api_slow: 'API lenta', page_slow: 'Página lenta',
};
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString('pt-BR') : 'Ainda sem registro';
const duration = (value: number) => value >= 1000 ? (value / 1000).toFixed(1) + ' s' : value + ' ms';
const workflowUrl = 'https://github.com/felipinhobxd/NoMeuBairro/actions/workflows/production-monitor.yml';

export default function ProductionMonitoringPanel({ refreshToken = 0 }: { refreshToken?: number }) {
  const { toast } = useToast();
  const [payload, setPayload] = useState<MonitoringPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const mounted = useRef(false);
  const pending = useRef<Promise<void> | null>(null);

  const load = useCallback((quiet = false): Promise<void> => {
    if (pending.current) return pending.current;
    if (!quiet) setLoading(true);
    const request = async () => {
      try {
        const result = await supabase.rpc('get_production_monitoring', { p_days: 7 });
        if (result.error || result.data?.schemaVersion !== 2 || !result.data.summary
          || !Array.isArray(result.data.alerts) || !Array.isArray(result.data.events)) throw new Error('monitor_unavailable');
        if (mounted.current) { setPayload(result.data as MonitoringPayload); setError(''); }
      } catch {
        if (mounted.current) setError('Não foi possível atualizar o monitoramento. Os dados anteriores, se houver, podem estar desatualizados.');
      } finally { if (mounted.current) setLoading(false); }
    };
    pending.current = request().finally(() => { pending.current = null; });
    return pending.current;
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    const refreshVisible = () => { if (document.visibilityState === 'visible') void load(true); };
    const timer = window.setInterval(refreshVisible, 60_000);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => { mounted.current = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshVisible); };
  }, [load, refreshToken]);

  const resolveAlert = async (alert: ProductionAlert) => {
    if (resolvingId !== null) return;
    setResolvingId(alert.id);
    try {
      const result = await supabase.rpc('resolve_production_alert', { p_alert_id: alert.id });
      if (result.error) throw result.error;
      toast(result.data ? 'Registro marcado como resolvido.' : 'Este registro já foi atualizado.');
      await load(true);
    } catch { toast('Não foi possível resolver o registro. Tente novamente.', 'error'); }
    finally { if (mounted.current) setResolvingId(null); }
  };
  const sendTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const result = await supabase.rpc('test_production_monitoring');
      if (result.error) throw result.error;
      if (result.data?.accepted) toast('Teste registrado. O GitHub enviará o aviso na próxima verificação programada.');
      else toast(result.data?.reason === 'test_already_requested' ? 'Já existe um teste pendente ou solicitado nos últimos 15 minutos.' : 'O coletor está ocupado. Tente novamente em um minuto.', 'error');
      await load(true);
    } catch { toast('Não foi possível solicitar o teste de alerta.', 'error'); }
    finally { if (mounted.current) setTesting(false); }
  };

  if (loading && !payload) return <Card><p className="flex items-center justify-center gap-3 py-8 text-sm font-semibold text-slate-500 dark:text-slate-400"><RefreshCw className="h-5 w-5 animate-spin" /> Carregando monitoramento...</p></Card>;
  const summary = payload?.summary;
  const known = Boolean(payload && !error);
  const attention = (summary?.openAlerts || 0) > 0;
  const open = (payload?.alerts || []).filter(alert => alert.status === 'open');
  const resolved = (payload?.alerts || []).filter(alert => alert.status === 'resolved');

  return (
    <div className="space-y-4">
      <Card className={'!p-4 sm:!p-5 ' + (!known ? '!border-amber-300' : attention ? '!border-red-300' : '!border-emerald-300 dark:!border-emerald-500/30')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {known && !attention ? <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-7 w-7 shrink-0 text-amber-600" />}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{!known ? 'Estado do monitoramento não confirmado' : attention ? 'Incidentes aguardando verificação' : 'Sem incidentes abertos'}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{error || 'O painel atualiza a cada minuto enquanto esta aba estiver visível. Ausência de eventos não garante ausência de falhas.'}</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Último evento real: {formatDate(summary?.latestEventAt)} · Atualizado: {formatDate(payload?.generatedAt)}</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load(true)}><RefreshCw className="h-4 w-4" /> Atualizar monitoramento</Button>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {([
          ['Incidentes abertos', summary?.openAlerts], ['Falhas de API · hoje', summary?.apiFailuresToday],
          ['Páginas lentas · hoje', summary?.slowPagesToday], ['APIs lentas · hoje', summary?.slowApisToday], ['Erros do app · hoje', summary?.clientErrorsToday],
        ] as const).map(([label, value]) => <Card key={label} className="!p-3 sm:!p-4"><p className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{value ?? '—'}</p></Card>)}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">Amostras agrupadas e limitadas; não são contagens de pessoas. “Hoje” usa o horário de Brasília. Testes não entram nos indicadores reais.</p>
      <Card className="!p-4">
        <h3 className="font-bold text-slate-900 dark:text-white">Alertas e privacidade</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">O GitHub verifica a produção a cada 15 minutos e após o build da versão principal. Cria um aviso atribuído ao responsável quando o estado muda e encerra o aviso após a recuperação. A agenda pode sofrer atrasos; notificações por e-mail dependem das preferências do GitHub.</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">A coleta usa códigos fixos, página genérica, arquivo do aplicativo, versão, tipo de tela, duração e código HTTP. Não envia conteúdo digitado, fotos, senhas, tokens, IP ou identificação do usuário. O aviso público contém somente o estado do serviço.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="sm" disabled={testing} onClick={() => void sendTest()}>{testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar teste de alerta</Button>
          <a href={workflowUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-orange-700 underline underline-offset-4 dark:text-orange-300">Ver execuções no GitHub</a>
          <a href="/api/health" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-slate-600 underline underline-offset-4 dark:text-slate-300">Verificar conexão</a>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">O teste cria um aviso claramente identificado, sem simular uma queda. Depois de confirmar a entrega no GitHub, marque o teste como resolvido abaixo.</p>
      </Card>
      <section aria-labelledby="production-alerts-title" className="space-y-3">
        <h2 id="production-alerts-title" className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white"><AlertTriangle className="h-5 w-5" /> Incidentes e testes abertos</h2>
        {!known && <p role="alert" className="text-sm font-semibold text-amber-700 dark:text-amber-300">A listagem não pôde ser confirmada. Atualize o painel para tentar novamente.</p>}
        {known && open.length === 0 && <Card><EmptyState icon={CheckCircle2} title="Nenhum registro aberto" description="Falhas coletadas e testes de entrega aparecerão aqui." /></Card>}
        {open.map(alert => <Card key={alert.id} className="!p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className={'rounded-full px-2 py-1 ' + (alert.is_test ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200')}>{alert.is_test ? 'Teste · não é incidente' : alert.severity === 'critical' ? 'Crítico' : alert.severity === 'error' ? 'Erro' : 'Aviso'}</span>
                <span className="text-slate-600 dark:text-slate-300">{typeLabels[alert.event_type]}</span><span className="text-slate-500 dark:text-slate-400">{alert.occurrences} ocorrência(s)</span>
              </div>
              <p className="mt-2 break-words text-sm font-semibold text-slate-900 dark:text-white">{alert.message}</p>
              <p className="mt-2 break-all font-mono text-xs text-slate-500 dark:text-slate-400">{alert.code} · {alert.path} · {alert.target}{alert.status_code ? ' · HTTP ' + alert.status_code : ''}</p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Primeiro: {formatDate(alert.first_triggered_at)} · Último: {formatDate(alert.last_triggered_at)}</p>
            </div>
            <Button type="button" size="sm" variant="secondary" disabled={resolvingId !== null} onClick={() => void resolveAlert(alert)}>{resolvingId === alert.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Marcar resolvido</Button>
          </div>
        </Card>)}
        {resolved.length > 0 && <details className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><summary className="cursor-pointer text-sm font-bold text-slate-700 dark:text-slate-200">Histórico recente de resoluções ({resolved.length})</summary><ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">{resolved.map(alert => <li key={alert.id}>{alert.is_test ? 'Teste' : typeLabels[alert.event_type]} · {alert.message} · {formatDate(alert.resolved_at)}</li>)}</ul></details>}
      </section>
      <section aria-labelledby="production-events-title" className="space-y-3">
        <h2 id="production-events-title" className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white"><Gauge className="h-5 w-5" /> Eventos dos últimos 7 dias</h2>
        {known && payload?.events.length === 0 && <Card><EmptyState icon={Activity} title="Nenhum evento recebido neste período" description="A lista recebe erros e medições acima dos limites. Use o teste de alerta para conferir o caminho de entrega." /></Card>}
        {(payload?.events || []).map(event => <Card key={event.day + '-' + event.fingerprint} className="!p-4">
          <div className="flex items-start gap-3">
            {event.event_type.startsWith('api_') ? <Server className="h-5 w-5 shrink-0 text-blue-600" /> : event.event_type === 'page_slow' ? <Clock3 className="h-5 w-5 shrink-0 text-amber-600" /> : <Activity className="h-5 w-5 shrink-0 text-orange-600" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white">{event.is_test ? 'Teste de entrega' : typeLabels[event.event_type]} <span className="font-normal text-slate-500 dark:text-slate-400">· {event.samples} amostra(s){event.device_class ? ' · ' + event.device_class : ''}</span></p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{event.message}</p>
              <p className="mt-2 break-all font-mono text-xs text-slate-500 dark:text-slate-400">{event.code} · {event.path} · {event.target}{event.status_code ? ' · HTTP ' + event.status_code : ''}{event.release ? ' · ' + event.release : ''}</p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{event.avg_duration_ms != null ? 'Média ' + duration(event.avg_duration_ms) + ' · Máx. ' + duration(event.max_duration_ms || 0) + ' · ' : ''}{formatDate(event.last_seen_at)}</p>
            </div>
          </div>
        </Card>)}
      </section>
    </div>
  );
}
