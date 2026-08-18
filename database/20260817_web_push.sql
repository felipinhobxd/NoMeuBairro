-- Web Push infrastructure. VAPID private material and the internal dispatcher token
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
