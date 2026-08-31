-- Harden the already-deployed collector; never store free-form browser errors.
-- CLI-created file aligned with the version assigned by the connected migration API.
-- Anonymous writes are intentionally append-only through a bounded private helper.
-- Reading details, resolving incidents and requesting a delivery test require a moderator.

alter table public.production_event_daily
  add column if not exists code text not null default 'legacy',
  add column if not exists is_test boolean not null default false;
alter table public.production_alerts
  add column if not exists code text not null default 'legacy',
  add column if not exists is_test boolean not null default false;

create table private.production_monitor_budget (
  singleton boolean primary key default true check (singleton),
  day date not null,
  minute timestamptz not null,
  daily_samples integer not null default 0 check (daily_samples between 0 and 10000),
  minute_samples integer not null default 0 check (minute_samples between 0 and 120)
);
create table private.production_monitor_windows (
  fingerprint text primary key check (length(fingerprint) = 64),
  started_at timestamptz not null,
  samples integer not null check (samples between 1 and 10000)
);
create index production_monitor_windows_started_idx on private.production_monitor_windows(started_at);
alter table private.production_monitor_budget enable row level security;
alter table private.production_monitor_windows enable row level security;
revoke all on private.production_monitor_budget, private.production_monitor_windows from public, anon, authenticated;

create or replace function private.log_production_event_internal(
  p_event_type text, p_path text default '/', p_target text default null,
  p_message text default null, p_duration_ms integer default null,
  p_status_code integer default null, p_device_class text default null,
  p_release text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_now timestamptz := now();
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_minute timestamptz := date_trunc('minute', now());
  v_path text := split_part(split_part(regexp_replace(left(coalesce(p_path, '/'), 500), '^#', ''), '?', 1), '#', 1);
  v_target text := left(coalesce(p_target, 'app'), 160);
  v_code text := left(coalesce(p_message, ''), 64);
  v_message text;
  v_severity text;
  v_status integer := case when p_status_code between 100 and 599 then p_status_code end;
  v_duration integer := case when p_duration_ms between 0 and 120000 then p_duration_ms end;
  v_device text := case when p_device_class in ('mobile','tablet','desktop') then p_device_class end;
  v_release text := case when p_release ~ '^(index-[A-Za-z0-9_-]{6,20}\.js|[a-f0-9]{12})$' then p_release end;
  v_test boolean := coalesce(p_message = 'monitoring.self_test', false);
  v_fingerprint text;
  v_daily_fingerprint text;
  v_budget private.production_monitor_budget%rowtype;
  v_window_samples integer;
begin
  if p_event_type is null or p_event_type not in ('client_error','render_error','resource_error','api_error','api_slow','page_slow') then
    return jsonb_build_object('accepted', false, 'reason', 'unsupported_event');
  end if;
  -- The one synthetic code is never available to an anonymous collector.
  if v_test and ((select auth.uid()) is null or not public.is_moderator()) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  v_message := case v_code
    when 'js.type_error' then 'Erro de tipo no aplicativo'
    when 'js.reference_error' then 'Referência indisponível no aplicativo'
    when 'js.syntax_error' then 'Erro de interpretação do aplicativo'
    when 'js.range_error' then 'Limite de execução excedido'
    when 'js.error' then 'Erro não tratado no aplicativo'
    when 'resource.chunk' then 'Falha ao carregar um módulo do aplicativo'
    when 'resource.script' then 'Falha ao carregar um script essencial'
    when 'resource.style' then 'Falha ao carregar os estilos'
    when 'resource.service_worker' then 'Falha ao registrar o modo offline'
    when 'api.http' then 'API retornou erro de serviço'
    when 'api.network' then 'Conexão com a API interrompida'
    when 'api.slow' then 'Resposta de API acima do limite de tempo'
    when 'page.lcp' then 'Conteúdo principal demorou a aparecer'
    when 'page.inp' then 'Interação demorou a responder'
    when 'page.navigation' then 'Carregamento da página acima de quatro segundos'
    when 'monitoring.self_test' then 'Teste de entrega solicitado pela administração; não é uma falha real'
  end;
  if v_message is null or p_message is distinct from v_code then
    return jsonb_build_object('accepted', false, 'reason', 'unsupported_code');
  end if;
  if not (
    (p_event_type in ('client_error','render_error') and (v_code like 'js.%' or v_code = 'resource.chunk' or v_test))
    or (p_event_type = 'resource_error' and v_code like 'resource.%')
    or (p_event_type = 'api_error' and v_code in ('api.http','api.network'))
    or (p_event_type = 'api_slow' and v_code = 'api.slow')
    or (p_event_type = 'page_slow' and v_code like 'page.%')
  ) then return jsonb_build_object('accepted', false, 'reason', 'invalid_code_type'); end if;

  if v_path ~ '^/(post|relato)/' then v_path := '/post/:id'; end if;
  if v_path ~ '^/perfil/' then v_path := '/perfil/:id'; end if;
  if v_path ~ '^/empresa/' then v_path := '/empresa/:id'; end if;
  if v_path not in ('/','/mapa','/estatisticas','/empregos','/mural','/denuncias','/perfil','/perfil/:id','/post/:id','/empresa','/empresa/:id','/notificacoes','/salvos','/admin','/privacidade','/termos','/login') then v_path := '/'; end if;
  if not (
    v_target ~ '^(app|lcp|inp|navigation|service-worker|asset/(script|link|chunk)|/external/(viacep|nominatim))$'
    or v_target ~ '^asset/[A-Za-z][A-Za-z0-9_-]{0,60}-[A-Za-z0-9_-]{6,20}\.js:[0-9]{1,7}:[0-9]{1,7}$'
    or v_target ~ '^/rest/v1/(rpc/)?[a-z_]{1,64}$'
    or v_target ~ '^/functions/v1/[a-z-]{1,64}$'
    or v_target ~ '^/auth/v1/[a-z_]{1,32}$'
    or v_target ~ '^/storage/v1/(object|render|upload|other)$'
    or v_target ~ '^/api/(share-post|post-image|health)$'
  ) then v_target := 'app'; end if;
  if v_test then v_path := '/admin'; v_target := 'app'; v_release := null; end if;
  if v_code = 'api.http' and (v_status is null or (v_status < 500 and v_status not in (408,429))) then
    return jsonb_build_object('accepted', false, 'reason', 'expected_http_status');
  end if;
  if v_code = 'api.network' then v_status := null; end if;
  if (v_code in ('api.slow','page.navigation') and coalesce(v_duration,0) < 4000)
    or (v_code = 'page.lcp' and coalesce(v_duration,0) <= 2500)
    or (v_code = 'page.inp' and coalesce(v_duration,0) <= 500) then
    return jsonb_build_object('accepted', false, 'reason', 'below_slow_threshold');
  end if;

  -- Do not queue telemetry behind concurrent traffic. One nonblocking lock makes
  -- global rate/cardinality limits race-safe without delaying application writes.
  if not pg_try_advisory_xact_lock(hashtext('nmb-production-telemetry-v2')) then
    return jsonb_build_object('accepted', false, 'reason', 'busy');
  end if;
  insert into private.production_monitor_budget(singleton,day,minute) values (true,v_day,v_minute)
    on conflict (singleton) do nothing;
  select * into v_budget from private.production_monitor_budget where singleton;
  if (v_budget.day = v_day and v_budget.daily_samples >= 10000)
    or (v_budget.minute = v_minute and v_budget.minute_samples >= 120) then
    return jsonb_build_object('accepted', false, 'reason', 'rate_limit');
  end if;
  v_fingerprint := encode(extensions.digest(convert_to(concat_ws('|',p_event_type,v_path,v_target,v_code,v_status::text),'UTF8'),'sha256'),'hex');
  v_daily_fingerprint := encode(extensions.digest(convert_to(concat_ws('|',v_fingerprint,v_device,v_release),'UTF8'),'sha256'),'hex');
  if not exists (select 1 from public.production_event_daily where day = v_day and fingerprint = v_daily_fingerprint)
    and (select count(*) from public.production_event_daily where day = v_day) >= 500 then
    return jsonb_build_object('accepted', false, 'reason', 'daily_cardinality_limit');
  end if;
  update private.production_monitor_budget set day = v_day, minute = v_minute,
    daily_samples = case when day = v_day then daily_samples + 1 else 1 end,
    minute_samples = case when minute = v_minute then minute_samples + 1 else 1 end
    where singleton;
  v_severity := case when v_test then 'warning'
    when p_event_type = 'render_error' or v_code in ('resource.chunk','resource.script','resource.style') or (v_code = 'api.http' and v_status >= 500) then 'critical'
    when p_event_type in ('api_error','client_error') then 'error' else 'warning' end;

  insert into public.production_event_daily(day,fingerprint,event_type,severity,path,target,message,code,is_test,
    status_code,device_class,release,samples,duration_samples,total_duration_ms,max_duration_ms,first_seen_at,last_seen_at)
  values (v_day,v_daily_fingerprint,p_event_type,v_severity,v_path,v_target,v_message,v_code,v_test,
    v_status,v_device,v_release,1,case when v_duration is null then 0 else 1 end,coalesce(v_duration,0),v_duration,v_now,v_now)
  on conflict (day,fingerprint) do update set samples = production_event_daily.samples + 1,
    duration_samples = production_event_daily.duration_samples + excluded.duration_samples,
    total_duration_ms = production_event_daily.total_duration_ms + excluded.total_duration_ms,
    max_duration_ms = greatest(production_event_daily.max_duration_ms,excluded.max_duration_ms), last_seen_at = v_now;

  insert into private.production_monitor_windows(fingerprint,started_at,samples) values(v_fingerprint,v_now,1)
  on conflict (fingerprint) do update set
    samples = case when production_monitor_windows.started_at < v_now - interval '15 minutes' then 1 else production_monitor_windows.samples + 1 end,
    started_at = case when production_monitor_windows.started_at < v_now - interval '15 minutes' then v_now else production_monitor_windows.started_at end
  returning samples into v_window_samples;

  if v_test or v_severity = 'critical' or p_event_type = 'client_error'
    or v_window_samples >= 3 then
    insert into public.production_alerts(fingerprint,event_type,severity,path,target,message,code,is_test,status_code,occurrences,status,first_triggered_at,last_triggered_at)
    values(v_fingerprint,p_event_type,v_severity,v_path,v_target,v_message,v_code,v_test,v_status,v_window_samples,'open',v_now,v_now)
    on conflict (fingerprint) where status = 'open' do update set
      occurrences = production_alerts.occurrences + 1, last_triggered_at = v_now;
  end if;
  -- Anonymous callers cannot inspect fingerprints, counters or alert IDs.
  return jsonb_build_object('accepted', true);
end;
$function$;
revoke all on function private.log_production_event_internal(text,text,text,text,integer,integer,text,text) from public;
grant execute on function private.log_production_event_internal(text,text,text,text,integer,integer,text,text) to anon, authenticated;

create or replace function public.get_production_monitoring(p_days integer default 7)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $function$
declare v_day date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if (select auth.uid()) is null or not public.is_moderator() then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  return jsonb_build_object('schemaVersion',2,'generatedAt',now(),
    'summary',jsonb_build_object(
      'openAlerts',(select count(*) from public.production_alerts where status = 'open' and not is_test),
      'criticalOpenAlerts',(select count(*) from public.production_alerts where status = 'open' and severity = 'critical' and not is_test),
      'clientErrorsToday',(select coalesce(sum(samples),0) from public.production_event_daily where day = v_day and event_type in ('client_error','render_error','resource_error') and not is_test),
      'apiFailuresToday',(select coalesce(sum(samples),0) from public.production_event_daily where day = v_day and event_type = 'api_error' and not is_test),
      'slowPagesToday',(select coalesce(sum(samples),0) from public.production_event_daily where day = v_day and event_type = 'page_slow' and not is_test),
      'slowApisToday',(select coalesce(sum(samples),0) from public.production_event_daily where day = v_day and event_type = 'api_slow' and not is_test),
      'latestEventAt',(select max(last_seen_at) from public.production_event_daily where not is_test)),
    'alerts',(select coalesce(jsonb_agg(to_jsonb(a) order by (a.status = 'open') desc,a.last_triggered_at desc),'[]'::jsonb) from (
      select id,fingerprint,event_type,severity,path,target,message,code,is_test,status_code,occurrences,status,first_triggered_at,last_triggered_at,resolved_at
      from public.production_alerts order by (status = 'open') desc,last_triggered_at desc limit 60) a),
    'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.last_seen_at desc),'[]'::jsonb) from (
      select day,fingerprint,event_type,severity,path,target,message,code,is_test,status_code,device_class,release,samples,
        case when duration_samples > 0 then round(total_duration_ms::numeric / duration_samples)::integer end as avg_duration_ms,
        max_duration_ms,first_seen_at,last_seen_at
      from public.production_event_daily
      where day >= v_day - (least(greatest(coalesce(p_days,7),1),45) - 1)
      order by last_seen_at desc limit 120) e));
end;
$function$;

-- A deliberately public, fixed-shape aggregate for the uptime probe. No event
-- text, routes, user/account identifiers or individual incident IDs are exposed.
create function private.get_production_health_internal()
returns jsonb language sql stable security definer set search_path = ''
as $function$
  select jsonb_build_object('schemaVersion',2,
    'openIncidents',least(count(*) filter(where not is_test),10000),
    'criticalIncidents',least(count(*) filter(where not is_test and severity = 'critical'),10000),
    'testSequence',coalesce(max(id) filter(where is_test),0))
  from public.production_alerts where status = 'open';
$function$;
revoke all on function private.get_production_health_internal() from public;
grant execute on function private.get_production_health_internal() to anon, authenticated;
create function public.get_production_health()
returns jsonb language sql stable security invoker set search_path = ''
as $function$ select private.get_production_health_internal(); $function$;
revoke all on function public.get_production_health() from public;
grant execute on function public.get_production_health() to anon, authenticated;

create function public.test_production_monitoring()
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not public.is_moderator() then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if exists(select 1 from public.production_alerts where is_test and (status = 'open' or last_triggered_at > now() - interval '15 minutes')) then
    return jsonb_build_object('accepted',false,'reason','test_already_requested');
  end if;
  return private.log_production_event_internal('client_error','/admin','app','monitoring.self_test');
end;
$function$;
revoke all on function public.test_production_monitoring() from public, anon;
grant execute on function public.test_production_monitoring() to authenticated;
revoke all on function public.get_production_monitoring(integer) from public, anon;
grant execute on function public.get_production_monitoring(integer) to authenticated;

-- Retention is independent of visits. Only monitoring records are affected.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant select on cron.job to postgres;
grant select, delete on cron.job_run_details to postgres;
create function private.prune_production_monitoring()
returns void language plpgsql security invoker set search_path = ''
as $function$
begin
  delete from public.client_error_logs where created_at < now() - interval '90 days';
  delete from public.production_event_daily where day < (now() at time zone 'America/Sao_Paulo')::date - 44;
  delete from public.production_alerts where status = 'resolved' and resolved_at < now() - interval '180 days';
  delete from private.production_monitor_windows where started_at < now() - interval '2 days';
  delete from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'nmb-production-monitor-retention') and end_time < now() - interval '14 days';
end;
$function$;
revoke all on function private.prune_production_monitoring() from public, anon, authenticated;
select cron.schedule('nmb-production-monitor-retention','17 6 * * *','select private.prune_production_monitoring();');

comment on table public.production_event_daily is 'Bounded daily production samples; fixed error codes, generic paths, no user content. 45-day retention.';
comment on table public.production_alerts is 'Moderator-only incidents. Synthetic delivery tests excluded from health counts. Resolved records retained 180 days.';
notify pgrst, 'reload schema';
