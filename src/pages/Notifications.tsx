import { Bell, CheckCheck, Heart, MessageSquare, Trash2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { timeAgo, Card, EmptyState } from '../components/UI';

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markNotificationsAsRead, deleteAllNotifications } = useData();

  const openNotification = (postId: string) => {
    navigate('/');
    window.setTimeout(() => {
      const element = document.getElementById(`post-${postId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (element) {
        element.classList.add('ring-2', 'ring-emerald-500', 'ring-offset-2');
        window.setTimeout(() => element.classList.remove('ring-2', 'ring-emerald-500', 'ring-offset-2'), 2500);
      }
    }, 150);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="text-emerald-600" /> Notificações
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount === 1 ? '' : 's'}` : 'Tudo em dia'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => void markNotificationsAsRead()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-semibold"
            >
              <CheckCheck className="w-4 h-4" /> Marcar todas como lidas
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Deseja apagar todas as notificações?')) void deleteAllNotifications();
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-sm font-semibold"
            >
              <Trash2 className="w-4 h-4" /> Apagar tudo
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bell}
            title="Nenhuma notificação"
            description="Quando alguém apoiar ou comentar uma publicação sua, a atividade aparecerá aqui."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => openNotification(notification.postId)}
              className={`w-full text-left rounded-2xl border p-4 sm:p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                notification.isRead
                  ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  : 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5'
              }`}
            >
              <div className="flex gap-3">
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  {notification.actorAvatarUrl ? (
                    <img src={notification.actorAvatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-slate-400">{notification.actorName?.charAt(0)?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      <strong className="text-slate-900 dark:text-white">{notification.actorName || 'Alguém'}</strong>{' '}
                      {notification.type === 'support' ? 'apoiou sua publicação' : 'comentou na sua publicação'}
                      {notification.postTitle && <> <span className="text-emerald-700 dark:text-emerald-400 font-semibold">“{notification.postTitle}”</span></>}
                    </p>
                    {!notification.isRead && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1" />}
                  </div>
                  {notification.content && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-3">“{notification.content}”</p>
                  )}
                  <div className="flex items-center justify-between gap-3 mt-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                      {notification.type === 'support' ? <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> : <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />}
                      {timeAgo(notification.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Ver publicação <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
