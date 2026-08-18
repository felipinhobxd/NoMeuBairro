import { useEffect, useState } from 'react';
import {
  Bell, CheckCheck, Heart, MessageSquare, Trash2, ArrowRight, Reply,
  CheckCircle2, Briefcase, Eye, PhoneCall, CalendarCheck, MapPin, BellRing, BellOff, Smartphone,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { timeAgo, Card, EmptyState, useToast } from '../components/UI';
import type { AppNotification } from '../types';
import {
  notificationActionLabel,
  notificationDestination,
  notificationMessage,
  notificationTargetTitle,
} from '../utils/notificationActivity';
import { disablePushNotifications, enablePushNotifications, inspectPushState, type PushState } from '../utils/pushNotifications';

function ActivityIcon({ notification }: { notification: AppNotification }) {
  switch (notification.type) {
    case 'support': return <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />;
    case 'comment': return <MessageSquare className="w-4 h-4 text-orange-600" />;
    case 'reply': return <Reply className="w-4 h-4 text-violet-600" />;
    case 'post_resolved': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    case 'job_interest': return <Briefcase className="w-4 h-4 text-blue-600" />;
    case 'application_viewed': return <Eye className="w-4 h-4 text-sky-600" />;
    case 'application_contacted': return <PhoneCall className="w-4 h-4 text-emerald-600" />;
    case 'event_attendance': return <CalendarCheck className="w-4 h-4 text-purple-600" />;
    case 'neighborhood_post': return <MapPin className="w-4 h-4 text-orange-600" />;
    case 'neighborhood_event': return <CalendarCheck className="w-4 h-4 text-violet-600" />;
    case 'neighborhood_job': return <Briefcase className="w-4 h-4 text-blue-600" />;
    default: return <Bell className="w-4 h-4 text-slate-500" />;
  }
}

function pushDescription(state: PushState | null) {
  if (!state) return 'Verificando este dispositivo...';
  if (!state.supported) return 'Este navegador não oferece Web Push. No iPhone/iPad, instale o site na Tela de Início e tente novamente.';
  if (state.permission === 'denied') return 'As notificações estão bloqueadas nas permissões deste site. Libere-as nas configurações do navegador para ativar.';
  if (state.enabled) return 'Ativas neste dispositivo. Você pode receber avisos mesmo com o No Meu Bairro fechado.';
  return 'Ative para receber respostas, atualizações e novidades dos bairros que você segue.';
}

export default function Notifications() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pushState, setPushState] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const {
    notifications,
    unreadCount,
    markNotificationAsRead,
    markNotificationsAsRead,
    deleteAllNotifications,
  } = useData();

  useEffect(() => {
    let active = true;
    void inspectPushState().then((state) => { if (active) setPushState(state); }).catch(() => {
      if (active) setPushState({ supported: false, permission: 'unsupported', enabled: false });
    });
    return () => { active = false; };
  }, []);

  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const next = pushState?.enabled ? await disablePushNotifications() : await enablePushNotifications();
      setPushState(next);
      if (next.enabled) toast('Notificações ativadas neste dispositivo!');
      else if (next.permission === 'denied') toast('A permissão de notificações foi bloqueada pelo navegador.', 'info');
      else if (!next.supported) toast('Web Push não está disponível neste navegador.', 'info');
      else toast('Notificações neste dispositivo foram desativadas.', 'info');
    } catch (error: any) {
      console.error('Erro ao configurar Web Push:', error);
      toast(error?.message || 'Não foi possível configurar as notificações neste dispositivo.', 'error');
      try { setPushState(await inspectPushState()); } catch {}
    } finally {
      setPushBusy(false);
    }
  };

  const openNotification = async (notification: AppNotification) => {
    await markNotificationAsRead(notification.id);
    navigate(notificationDestination(notification));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="text-orange-600 dark:text-orange-400" /> Notificações
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount === 1 ? '' : 's'}` : 'Tudo em dia'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unreadCount > 0 && <button onClick={() => void markNotificationsAsRead()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-800 dark:text-orange-300 text-sm font-semibold border border-orange-200 dark:border-orange-500/20"><CheckCheck className="w-4 h-4" /> Marcar todas como lidas</button>}
          {notifications.length > 0 && <button onClick={() => { if (window.confirm('Deseja apagar todas as notificações?')) void deleteAllNotifications(); }} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-sm font-semibold"><Trash2 className="w-4 h-4" /> Apagar tudo</button>}
        </div>
      </div>

      <Card className="!p-4 sm:!p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${pushState?.enabled ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
            {pushState?.enabled ? <BellRing className="w-5 h-5 text-emerald-600" /> : pushState?.permission === 'denied' ? <BellOff className="w-5 h-5 text-red-500" /> : <Smartphone className="w-5 h-5 text-slate-500" />}
          </div>
          <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><h2 className="text-sm font-bold text-slate-900 dark:text-white">Notificações neste dispositivo</h2>{pushState?.enabled && <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Ativas</span>}</div><p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{pushDescription(pushState)}</p><p className="text-[10px] text-slate-400 mt-1">A ativação é opcional e vale somente para este navegador/dispositivo.</p></div>
          <button type="button" onClick={() => void togglePush()} disabled={pushBusy || pushState?.permission === 'denied' || pushState?.supported === false} className={`min-h-11 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors disabled:opacity-50 ${pushState?.enabled ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>{pushBusy ? 'Aguarde...' : pushState?.enabled ? 'Desativar' : 'Ativar'}</button>
        </div>
      </Card>

      {notifications.length === 0 ? (
        <Card><EmptyState icon={Bell} title="Nenhuma notificação" description="Apoios, comentários, respostas e novidades dos bairros que você segue aparecerão aqui." /></Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const targetTitle = notificationTargetTitle(notification);
            return <button key={notification.id} onClick={() => void openNotification(notification)} className={`w-full text-left rounded-2xl border p-4 sm:p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${notification.isRead ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900' : 'border-orange-200 dark:border-orange-500/30 bg-orange-50/60 dark:bg-orange-500/5'}`}><div className="flex gap-3"><div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">{notification.actorAvatarUrl ? <img src={notification.actorAvatarUrl} alt="" className="w-full h-full object-cover" /> : <ActivityIcon notification={notification} />}</div><div className="flex-1 min-w-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">{notificationMessage(notification)}</p>{targetTitle && <p className="text-sm text-orange-800 dark:text-orange-300 font-semibold mt-0.5 line-clamp-2">“{targetTitle}”</p>}</div>{!notification.isRead && <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0 mt-1" />}</div>{notification.content && <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-3">“{notification.content}”</p>}<div className="flex items-center justify-between gap-3 mt-3"><span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><ActivityIcon notification={notification} />{timeAgo(notification.createdAt)}</span><span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 dark:text-orange-300">{notificationActionLabel(notification)} <ArrowRight className="w-3.5 h-3.5" /></span></div></div></div></button>;
          })}
        </div>
      )}
    </div>
  );
}
