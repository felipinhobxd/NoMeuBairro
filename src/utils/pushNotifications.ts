import { supabase } from './supabase';

export type PushState = {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  enabled: boolean;
};

function supportsPush() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function ensureServiceWorker() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js');
}

async function registerWithServer(subscription: PushSubscription) {
  const serialized = subscription.toJSON();
  const p256dh = serialized.keys?.p256dh;
  const auth = serialized.keys?.auth;
  if (!serialized.endpoint || !p256dh || !auth) throw new Error('Inscrição de notificação incompleta.');
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: serialized.endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_user_agent: navigator.userAgent.slice(0, 500),
  });
  if (error) throw error;
}

export async function inspectPushState(): Promise<PushState> {
  if (!supportsPush()) return { supported: false, permission: 'unsupported', enabled: false };
  const permission = Notification.permission;
  if (permission !== 'granted') return { supported: true, permission, enabled: false };
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return { supported: true, permission, enabled: false };
  const subscription = await registration.pushManager.getSubscription();
  return { supported: true, permission, enabled: Boolean(subscription) };
}

export async function enablePushNotifications(): Promise<PushState> {
  if (!supportsPush()) return { supported: false, permission: 'unsupported', enabled: false };
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return { supported: true, permission, enabled: false };

  const registration = await ensureServiceWorker();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { data: publicKey, error } = await supabase.rpc('get_push_public_key');
    if (error || !publicKey) throw new Error(error?.message || 'Chave pública de notificações indisponível.');
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(String(publicKey)),
    });
  }
  await registerWithServer(subscription);
  return { supported: true, permission: 'granted', enabled: true };
}

export async function disablePushNotifications(): Promise<PushState> {
  if (!supportsPush()) return { supported: false, permission: 'unsupported', enabled: false };
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (subscription) {
    try { await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint); } catch {}
    try { await subscription.unsubscribe(); } catch {}
  }
  return { supported: true, permission: Notification.permission, enabled: false };
}

export async function disconnectPushOnLogout() {
  if (!supportsPush()) return;
  try { await disablePushNotifications(); } catch {}
}
