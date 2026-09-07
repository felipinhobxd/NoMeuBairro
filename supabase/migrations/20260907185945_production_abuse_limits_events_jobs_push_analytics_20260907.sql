-- NoMeuBairro: close remaining authenticated/public write-amplification paths.
-- Target: NEW Supabase production project only.

-- 1) Efficient rate-limit lookups for event/job creation.
create index if not exists events_created_by_created_at_idx
  on public.events (created_by, created_at desc);

create index if not exists job_posts_company_created_at_idx
  on public.job_posts (company_id, created_at desc);

create or replace function private.guard_event_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_hour integer;
  recent_day integer;
begin
  if new.created_by is null then
    raise exception 'Usuário inválido para publicar evento.' using errcode = 'P0001';
  end if;

  select count(*)::integer into recent_hour
  from public.events
  where created_by = new.created_by
    and created_at >= now() - interval '1 hour';

  select count(*)::integer into recent_day
  from public.events
  where created_by = new.created_by
    and created_at >= now() - interval '24 hours';

  if recent_hour >= 20 then
    raise exception 'Você publicou muitos eventos em pouco tempo. Aguarde um pouco e tente novamente.' using errcode = 'P0001';
  end if;
  if recent_day >= 100 then
    raise exception 'Limite diário de eventos atingido. Tente novamente amanhã.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_event_rate_limit() from public, anon, authenticated;

drop trigger if exists trg_guard_event_rate_limit on public.events;
create trigger trg_guard_event_rate_limit
before insert on public.events
for each row execute function private.guard_event_rate_limit();

create or replace function private.guard_job_post_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_hour integer;
  recent_day integer;
begin
  if new.company_id is null then
    raise exception 'Empresa inválida para publicar vaga.' using errcode = 'P0001';
  end if;

  select count(*)::integer into recent_hour
  from public.job_posts
  where company_id = new.company_id
    and created_at >= now() - interval '1 hour';

  select count(*)::integer into recent_day
  from public.job_posts
  where company_id = new.company_id
    and created_at >= now() - interval '24 hours';

  if recent_hour >= 20 then
    raise exception 'Você publicou muitas vagas em pouco tempo. Aguarde um pouco e tente novamente.' using errcode = 'P0001';
  end if;
  if recent_day >= 100 then
    raise exception 'Limite diário de vagas atingido. Tente novamente amanhã.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_job_post_rate_limit() from public, anon, authenticated;

drop trigger if exists trg_guard_job_post_rate_limit on public.job_posts;
create trigger trg_guard_job_post_rate_limit
before insert on public.job_posts
for each row execute function private.guard_job_post_rate_limit();

-- 2) Bound Push fan-out/storage per account. Existing endpoints can refresh;
-- only adding an 11th distinct endpoint is rejected.
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
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_existing_user uuid;
  v_total integer;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 2048 then raise exception 'invalid push endpoint'; end if;
  if p_p256dh is null or char_length(p_p256dh) not between 40 and 512 then raise exception 'invalid p256dh key'; end if;
  if p_auth is null or char_length(p_auth) not between 8 and 256 then raise exception 'invalid auth key'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('push-subscriptions:' || v_user_id::text, 0));

  select user_id into v_existing_user
  from public.push_subscriptions
  where endpoint = p_endpoint;

  if v_existing_user is not null and v_existing_user <> v_user_id then
    raise exception 'push endpoint belongs to another account';
  end if;

  if v_existing_user is null then
    select count(*)::integer into v_total
    from public.push_subscriptions
    where user_id = v_user_id;
    if v_total >= 10 then
      raise exception 'push subscription limit reached';
    end if;
  end if;

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
$$;

revoke all on function private.register_push_subscription_internal(text,text,text,text) from public, anon, authenticated;

-- 3) Bound anonymous analytics writes. Cardinality was already fixed to an
-- allow-list; this adds a global write budget without impacting page loads.
create table if not exists private.site_analytics_budget (
  singleton boolean primary key default true check (singleton),
  day date not null,
  minute timestamptz not null,
  daily_samples integer not null default 0 check (daily_samples >= 0),
  minute_samples integer not null default 0 check (minute_samples >= 0)
);

revoke all on table private.site_analytics_budget from public, anon, authenticated;

create or replace function private.track_page_view_internal(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text := left(coalesce(nullif(trim(p_path), ''), '/'), 120);
  v_now timestamptz := now();
  v_day date := (v_now at time zone 'America/Sao_Paulo')::date;
  v_minute timestamptz := date_trunc('minute', v_now);
  v_first_view_today boolean;
  v_budget private.site_analytics_budget%rowtype;
begin
  if v_path !~ '^/' then v_path := '/' || v_path; end if;
  if v_path ~ '^/post/' then v_path := '/post/:id'; end if;
  if v_path ~ '^/perfil/' then v_path := '/perfil/:id'; end if;
  if v_path ~ '^/empresa/' then v_path := '/empresa/:id'; end if;

  if v_path not in (
    '/', '/mapa', '/estatisticas', '/empregos', '/mural', '/denuncias',
    '/perfil', '/perfil/:id', '/post/:id', '/empresa', '/empresa/:id',
    '/notificacoes', '/salvos', '/admin', '/privacidade', '/termos', '/login'
  ) then
    return;
  end if;

  -- Analytics are best-effort. Never queue real users behind bot traffic.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext('nmb-site-analytics-v1')) then
    return;
  end if;

  insert into private.site_analytics_budget(singleton, day, minute)
  values (true, v_day, v_minute)
  on conflict (singleton) do nothing;

  select * into v_budget
  from private.site_analytics_budget
  where singleton;

  if (v_budget.day = v_day and v_budget.daily_samples >= 50000)
     or (v_budget.minute = v_minute and v_budget.minute_samples >= 600) then
    return;
  end if;

  update private.site_analytics_budget
  set day = v_day,
      minute = v_minute,
      daily_samples = case when day = v_day then daily_samples + 1 else 1 end,
      minute_samples = case when minute = v_minute then minute_samples + 1 else 1 end
  where singleton;

  select not exists (
    select 1 from public.site_analytics_daily where day = v_day
  ) into v_first_view_today;

  insert into public.site_analytics_daily(day, path, views)
  values (v_day, v_path, 1)
  on conflict (day, path) do update
    set views = public.site_analytics_daily.views + 1;

  if v_first_view_today then
    delete from public.client_error_logs where created_at < v_now - interval '90 days';
    delete from public.production_event_daily where day < v_day - 44;
    delete from public.production_alerts
      where status = 'resolved' and resolved_at < v_now - interval '180 days';
  end if;
end;
$$;

revoke all on function private.track_page_view_internal(text) from public, anon, authenticated;
