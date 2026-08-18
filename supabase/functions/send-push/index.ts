import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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
