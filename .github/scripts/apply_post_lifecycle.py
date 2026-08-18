from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


push_util = r'''import { supabase } from './supabase';

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
'''
write('src/utils/pushNotifications.ts', push_util)

sw = r'''const CACHE_NAME = 'nmb-shell-v3';
const SHELL = ['/', '/logo.png', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallbackPath) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request.mode === 'navigate' ? '/' : request, copy)).catch(() => {});
    }
    return response;
  } catch {
    return (await caches.match(request)) || (fallbackPath ? await caches.match(fallbackPath) : null) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/'));
    return;
  }
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (['image', 'font'].includes(request.destination) || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
      }
      return response;
    })));
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || '' }; }
  const title = payload.title || 'No Meu Bairro';
  const body = [payload.body, payload.context].filter(Boolean).join(' · ');
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'nmb-activity',
    renotify: false,
    data: {
      url: payload.url || '/notificacoes',
      notificationId: payload.notificationId || null,
    },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data?.url || '/notificacoes';
  const targetUrl = new URL(path, self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('navigate' in client) {
        try { await client.navigate(targetUrl); } catch {}
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});
'''
write('public/sw.js', sw)

notifications = r'''import { useEffect, useState } from 'react';
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
'''
write('src/pages/Notifications.tsx', notifications)

# Disconnect this browser's subscription before sign-out to avoid notifications
# reaching a shared device after the account leaves.
path = 'src/contexts/AuthContext.tsx'
text = read(path)
text = replace_once(text, "import { supabase } from '../utils/supabase';\n", "import { supabase } from '../utils/supabase';\nimport { disconnectPushOnLogout } from '../utils/pushNotifications';\n", 'Auth push import')
text = replace_once(text, "  const logout = useCallback(async () => {\n    await supabase.auth.signOut();", "  const logout = useCallback(async () => {\n    await disconnectPushOnLogout();\n    await supabase.auth.signOut();", 'Auth disconnect push')
write(path, text)

# Push deep links: convert query parameters to the existing focus storage keys.
path = 'src/pages/Mural.tsx'
text = read(path)
focus = """  useEffect(() => {
    const focusedId = sessionStorage.getItem('anb-mural-focus-event');
    if (!focusedId || events.length === 0) return;
"""
query_focus = """  useEffect(() => {
    const focusedId = new URLSearchParams(window.location.search).get('evento');
    if (!focusedId) return;
    try { sessionStorage.setItem('anb-mural-focus-event', focusedId); } catch {}
    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', cleanUrl);
  }, []);

""" + focus
text = replace_once(text, focus, query_focus, 'Mural push deep link')
write(path, text)

path = 'src/pages/Empregos.tsx'
text = read(path)
focus = """  useEffect(() => {
    const focusedId = sessionStorage.getItem('anb-job-focus');
    if (!focusedId || loading) return;
"""
query_focus = """  useEffect(() => {
    const focusedId = new URLSearchParams(window.location.search).get('vaga');
    if (!focusedId) return;
    try { sessionStorage.setItem('anb-job-focus', focusedId); } catch {}
    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', cleanUrl);
  }, []);

""" + focus
text = replace_once(text, focus, query_focus, 'Jobs push deep link')
write(path, text)

edge = r'''import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type PushConfig = { publicKey?: string; privateKey?: string; dispatchToken?: string };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try { const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); return keys.default || Object.values(keys)[0]; }
  catch { return undefined; }
}
function safeEqual(a: string, b: string) { const encoder = new TextEncoder(); const aa = encoder.encode(a); const bb = encoder.encode(b); if (aa.length !== bb.length) return false; let diff = 0; for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i]; return diff === 0; }
function messageFor(n: any) { const actor = n.users?.name || (n.type === "post_resolved" ? "No Meu Bairro" : "Alguém"); switch (n.type) { case "support": return `${actor} apoiou seu relato`; case "comment": return `${actor} comentou no seu relato`; case "reply": return `${actor} respondeu ao seu comentário`; case "post_resolved": return "Seu relato foi marcado como resolvido"; case "job_interest": return `${actor} demonstrou interesse em uma vaga`; case "application_viewed": return "Sua candidatura foi visualizada"; case "application_contacted": return "Há uma atualização de contato na sua candidatura"; case "event_attendance": return `${actor} confirmou presença no seu evento`; case "neighborhood_post": return `${actor} publicou um novo relato em um bairro que você segue`; case "neighborhood_event": return `${actor} publicou um novo evento em um bairro que você segue`; case "neighborhood_job": return "Nova vaga publicada em um bairro que você segue"; default: return "Você tem uma nova atividade no No Meu Bairro"; } }
function targetFor(n: any) { if (n.post_id) return { url: `/post/${n.post_id}`, label: n.posts?.title || "Relato" }; if (n.event_id) return { url: `/mural?evento=${encodeURIComponent(n.event_id)}`, label: n.events?.title || "Evento" }; if (n.job_id) return { url: `/empregos?vaga=${encodeURIComponent(n.job_id)}`, label: n.job_posts?.title || "Vaga" }; return { url: "/notificacoes", label: "" }; }

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL"); const key = serviceKey();
  if (!supabaseUrl || !key) return json({ error: "server configuration unavailable" }, 500);
  const admin = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: configData, error: configError } = await admin.rpc("get_push_server_config"); const config = (configData || {}) as PushConfig;
  if (configError || !config.publicKey || !config.privateKey || !config.dispatchToken) return json({ error: "push configuration unavailable" }, 500);
  const suppliedToken = req.headers.get("x-push-dispatch-token") || "";
  if (!safeEqual(suppliedToken, config.dispatchToken)) return json({ error: "unauthorized" }, 401);
  let body: any; try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const notificationId = typeof body?.notificationId === "string" ? body.notificationId : "";
  if (!notificationId) return json({ error: "notificationId required" }, 400);
  const { data: notification, error: notificationError } = await admin.from("notifications").select("id,user_id,actor_id,type,post_id,comment_id,job_id,application_id,event_id,users:actor_id(name),posts:post_id(title),job_posts:job_id(title),events:event_id(title)").eq("id", notificationId).maybeSingle();
  if (notificationError) return json({ error: "notification lookup failed" }, 500);
  if (!notification) return json({ ok: true, sent: 0, removed: 0, failed: 0, reason: "notification not found" });
  const { data: subscriptions, error: subscriptionError } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("user_id", notification.user_id);
  if (subscriptionError) return json({ error: "subscription lookup failed" }, 500);
  if (!subscriptions?.length) return json({ ok: true, sent: 0, removed: 0, failed: 0 });
  webpush.setVapidDetails("https://nomeubairro.vercel.app/", config.publicKey, config.privateKey);
  const target = targetFor(notification);
  const payload = JSON.stringify({ title: "No Meu Bairro", body: messageFor(notification), context: target.label, url: target.url, notificationId: notification.id, tag: `nmb-${notification.id}` });
  let sent = 0, removed = 0, failed = 0; const successfulIds: string[] = [];
  await Promise.all(subscriptions.map(async (subscription: any) => { try { await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, payload, { TTL: 3600, urgency: "normal" }); sent += 1; successfulIds.push(subscription.id); } catch (error: any) { const statusCode = Number(error?.statusCode || error?.status || 0); if (statusCode === 404 || statusCode === 410) { const { error: deleteError } = await admin.from("push_subscriptions").delete().eq("id", subscription.id); if (!deleteError) removed += 1; else failed += 1; } else { failed += 1; console.error("Web push delivery failed", { statusCode, message: error?.message }); } } }));
  if (successfulIds.length) await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in("id", successfulIds);
  return json({ ok: true, sent, removed, failed });
});
'''
write('supabase/functions/send-push/index.ts', edge)

migration = r'''-- Web Push infrastructure. VAPID private material and the internal dispatcher token
-- are intentionally NOT versioned here; production values live in Supabase Vault.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  constraint push_subscriptions_endpoint_check check (endpoint like 'https://%' and char_length(endpoint) <= 2048),
  constraint push_subscriptions_p256dh_check check (char_length(p256dh) between 40 and 512),
  constraint push_subscriptions_auth_check check (char_length(auth_key) between 8 and 256)
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id, updated_at desc);
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, delete on table public.push_subscriptions to authenticated;
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns boolean language plpgsql security definer set search_path = 'public' as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 2048 then raise exception 'invalid push endpoint'; end if;
  if p_p256dh is null or char_length(p_p256dh) not between 40 and 512 then raise exception 'invalid p256dh key'; end if;
  if p_auth is null or char_length(p_auth) not between 8 and 256 then raise exception 'invalid auth key'; end if;
  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth_key, user_agent, updated_at)
  values (v_user_id, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 500), now())
  on conflict (endpoint) do update set user_id=excluded.user_id, p256dh=excluded.p256dh, auth_key=excluded.auth_key, user_agent=excluded.user_agent, updated_at=now();
  return true;
end; $$;
revoke all on function public.register_push_subscription(text,text,text,text) from public, anon;
grant execute on function public.register_push_subscription(text,text,text,text) to authenticated;

create or replace function public.get_push_public_key() returns text language sql stable security definer set search_path = 'public','vault' as $$
  select decrypted_secret from vault.decrypted_secrets where name='nmb_vapid_public_key' limit 1;
$$;
revoke all on function public.get_push_public_key() from public;
grant execute on function public.get_push_public_key() to anon, authenticated;

create or replace function public.get_push_server_config() returns jsonb language sql stable security definer set search_path = 'public','vault' as $$
  select jsonb_build_object(
    'publicKey',(select decrypted_secret from vault.decrypted_secrets where name='nmb_vapid_public_key' limit 1),
    'privateKey',(select decrypted_secret from vault.decrypted_secrets where name='nmb_vapid_private_key' limit 1),
    'dispatchToken',(select decrypted_secret from vault.decrypted_secrets where name='nmb_push_dispatch_token' limit 1)
  );
$$;
revoke all on function public.get_push_server_config() from public, anon, authenticated;
grant execute on function public.get_push_server_config() to service_role;

create or replace function public.dispatch_push_for_notification() returns trigger language plpgsql security definer set search_path='public','vault','extensions' as $$
declare v_token text;
begin
  if not exists (select 1 from public.push_subscriptions where user_id=new.user_id) then return new; end if;
  select decrypted_secret into v_token from vault.decrypted_secrets where name='nmb_push_dispatch_token' limit 1;
  if v_token is null or v_token='' then return new; end if;
  begin
    perform net.http_post(
      url := 'https://cytlgpionviibvojlkgp.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type','application/json','x-push-dispatch-token',v_token),
      body := jsonb_build_object('notificationId',new.id), timeout_milliseconds := 5000
    );
  exception when others then null;
  end;
  return new;
end; $$;
revoke all on function public.dispatch_push_for_notification() from public, anon, authenticated;
drop trigger if exists trg_dispatch_push_notification on public.notifications;
create trigger trg_dispatch_push_notification after insert on public.notifications for each row execute function public.dispatch_push_for_notification();
'''
write('database/20260817_web_push.sql', migration)

print('Real Web Push upgrade applied successfully.')
