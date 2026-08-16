import type { AppNotification } from '../types';

export function notificationMessage(notification: AppNotification) {
  const actor = notification.actorName || 'Alguém';
  switch (notification.type) {
    case 'support':
      return `${actor} apoiou sua publicação`;
    case 'comment':
      return `${actor} comentou na sua publicação`;
    case 'reply':
      return `${actor} respondeu ao seu comentário`;
    case 'post_resolved':
      return notification.actorId ? `${actor} marcou um relato como resolvido` : 'Um relato foi marcado como resolvido';
    case 'job_interest':
      return `${actor} demonstrou interesse em sua vaga`;
    case 'application_viewed':
      return `${actor} visualizou seu currículo`;
    case 'application_contacted':
      return `${actor} atualizou sua candidatura para contato`;
    case 'event_attendance':
      return `${actor} confirmou presença no seu evento`;
    default:
      return 'Nova atividade no NoMeuBairro';
  }
}

export function notificationTargetTitle(notification: AppNotification) {
  return notification.postTitle || notification.jobTitle || notification.eventTitle || '';
}

export function notificationActionLabel(notification: AppNotification) {
  switch (notification.type) {
    case 'job_interest': return 'Ver interessados';
    case 'application_viewed':
    case 'application_contacted': return 'Ver candidaturas';
    case 'event_attendance': return 'Ver evento';
    case 'reply': return 'Ver resposta';
    case 'post_resolved': return 'Ver relato';
    default: return 'Ver publicação';
  }
}

export function notificationDestination(notification: AppNotification) {
  if (notification.postId && ['support', 'comment', 'reply', 'post_resolved'].includes(notification.type)) {
    return `/post/${notification.postId}`;
  }

  if (notification.type === 'job_interest') {
    try {
      if (notification.jobId) sessionStorage.setItem('anb-company-focus-job', notification.jobId);
    } catch {}
    return '/empresa';
  }

  if (notification.type === 'application_viewed' || notification.type === 'application_contacted') {
    try {
      sessionStorage.setItem('anb-open-applications', '1');
      if (notification.jobId) sessionStorage.setItem('anb-focus-job', notification.jobId);
    } catch {}
    return '/empregos';
  }

  if (notification.type === 'event_attendance') {
    try {
      if (notification.eventId) sessionStorage.setItem('anb-focus-event', notification.eventId);
    } catch {}
    return '/mural';
  }

  return '/notificacoes';
}
