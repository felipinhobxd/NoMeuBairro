-- Mantém as operações privilegiadas fora do schema exposto pela Data API.
-- O schema public oferece apenas wrappers SECURITY INVOKER com contratos mínimos.

create or replace function private.get_public_moderation_transparency_internal()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with recent as (
    select * from public.content_reports where created_at >= now() - interval '30 days'
  ), handled as (
    select * from public.content_reports
    where status in ('resolved','ignored') and archived_at is not null and archived_at >= now() - interval '30 days'
  )
  select jsonb_build_object(
    'periodDays', 30,
    'reportsReceived', (select count(*) from recent),
    'pendingNow', (select count(*) from public.content_reports where status = 'pending'),
    'handled', (select count(*) from handled),
    'removed', (select count(*) from handled where status = 'resolved'),
    'kept', (select count(*) from handled where status = 'ignored'),
    'averageResponseHours', coalesce((select round(avg(extract(epoch from (archived_at - created_at)) / 3600.0)::numeric, 1) from handled where archived_at >= created_at), 0),
    'updatedAt', now()
  );
$function$;

revoke all on function private.get_public_moderation_transparency_internal() from public;
grant execute on function private.get_public_moderation_transparency_internal() to anon, authenticated;

create or replace function public.get_public_moderation_transparency()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.get_public_moderation_transparency_internal();
$function$;

revoke all on function public.get_public_moderation_transparency() from public;
grant execute on function public.get_public_moderation_transparency() to anon, authenticated;

create or replace function private.register_push_subscription_internal(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 2048 then raise exception 'invalid push endpoint'; end if;
  if p_p256dh is null or char_length(p_p256dh) not between 40 and 512 then raise exception 'invalid p256dh key'; end if;
  if p_auth is null or char_length(p_auth) not between 8 and 256 then raise exception 'invalid auth key'; end if;

  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth_key, user_agent, updated_at)
  values (v_user_id, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 500), now())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth_key = excluded.auth_key,
        user_agent = excluded.user_agent,
        updated_at = now()
    where public.push_subscriptions.user_id = v_user_id;

  if not found then raise exception 'push endpoint belongs to another account'; end if;
  return true;
end;
$function$;

revoke all on function private.register_push_subscription_internal(text,text,text,text) from public, anon;
grant execute on function private.register_push_subscription_internal(text,text,text,text) to authenticated;

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.register_push_subscription_internal(p_endpoint, p_p256dh, p_auth, p_user_agent);
$function$;

revoke all on function public.register_push_subscription(text,text,text,text) from public, anon;
grant execute on function public.register_push_subscription(text,text,text,text) to authenticated;
