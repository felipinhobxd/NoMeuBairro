-- Run as the migration owner after applying the monitoring migrations.
-- All synthetic samples, role settings, counters and resolutions are rolled back.
begin;
set local statement_timeout = '20s';
do $test$
declare
  v_result jsonb;
  v_before jsonb;
  v_after jsonb;
  v_denied boolean;
  v_admin uuid;
  v_test_id bigint;
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_fingerprint text;
begin
  select r.user_id into v_admin from public.app_roles r join public.users u on u.id = r.user_id
    where r.role in ('admin','moderator') order by (r.role = 'admin') desc limit 1;
  if v_admin is null then raise exception 'A moderator fixture is required'; end if;

  perform set_config('request.jwt.claims','{}',true);
  execute 'set local role anon';
  v_result := public.get_production_health();
  if v_result->>'schemaVersion' <> '2' or v_result ? 'alerts' or v_result ? 'events' then raise exception 'Invalid public health shape'; end if;
  v_denied := false;
  begin perform 1 from public.production_event_daily limit 1; exception when insufficient_privilege then v_denied := true; end;
  if not v_denied then raise exception 'Anonymous table read was allowed'; end if;
  v_denied := false;
  begin perform public.get_production_monitoring(); exception when insufficient_privilege then v_denied := true; end;
  if not v_denied then raise exception 'Anonymous panel read was allowed'; end if;
  v_denied := false;
  begin perform public.test_production_monitoring(); exception when insufficient_privilege then v_denied := true; end;
  if not v_denied then raise exception 'Anonymous delivery test was allowed'; end if;
  v_denied := false;
  begin perform public.log_production_event('client_error','/admin','app','monitoring.self_test'); exception when insufficient_privilege then v_denied := true; end;
  if not v_denied then raise exception 'Anonymous synthetic code was accepted'; end if;

  v_result := public.log_production_event('client_error','/perfil/private-person','app','private@example.test');
  if v_result->>'reason' <> 'unsupported_code' then raise exception 'Free-form message accepted'; end if;
  v_result := public.log_production_event('api_error','/','/rest/v1/posts','api.http',10,401);
  if v_result->>'reason' <> 'expected_http_status' then raise exception 'Expected HTTP error accepted'; end if;
  v_result := public.log_production_event('page_slow','/','inp','page.inp',300);
  if v_result->>'reason' <> 'below_slow_threshold' then raise exception 'Healthy INP accepted'; end if;
  v_result := public.log_production_event('page_slow','/','lcp','page.lcp',2000);
  if v_result->>'reason' <> 'below_slow_threshold' then raise exception 'Healthy LCP accepted'; end if;
  v_result := public.log_production_event('client_error','/perfil/private-person?email=private@example.test','https://private.example/token','js.type_error',null,null,'mobile','private-release-email');
  if v_result <> '{"accepted":true}'::jsonb then raise exception 'Collector response leaks internals or rejects valid sample'; end if;
  execute 'reset role';
  if not exists(select 1 from public.production_event_daily where day = v_day and path = '/perfil/:id' and target = 'app' and code = 'js.type_error' and release is null and message = 'Erro de tipo no aplicativo') then raise exception 'Sanitization failed'; end if;

  -- API/network and slow events alert only after a repeated 15-minute window.
  execute 'set local role anon';
  perform public.log_production_event('api_error','/login','/rest/v1/rpc/nmb_monitor_fixture','api.network',100);
  perform public.log_production_event('api_error','/login','/rest/v1/rpc/nmb_monitor_fixture','api.network',100);
  execute 'reset role';
  if exists(select 1 from public.production_alerts where target = '/rest/v1/rpc/nmb_monitor_fixture' and code = 'api.network' and status = 'open') then raise exception 'Network incident opened too early'; end if;
  execute 'set local role anon';
  perform public.log_production_event('api_error','/login','/rest/v1/rpc/nmb_monitor_fixture','api.network',100);
  execute 'reset role';
  select fingerprint into v_fingerprint from public.production_alerts where target = '/rest/v1/rpc/nmb_monitor_fixture' and code = 'api.network' and status = 'open';
  if v_fingerprint is null then raise exception 'Repeated API failure did not alert'; end if;
  update private.production_monitor_windows set started_at = now() - interval '16 minutes' where fingerprint = v_fingerprint;
  perform public.log_production_event('api_error','/login','/rest/v1/rpc/nmb_monitor_fixture','api.network',100);
  if (select samples from private.production_monitor_windows where fingerprint = v_fingerprint) <> 1 then raise exception 'Window did not reset'; end if;

  -- Authenticated is not the same thing as authorized.
  perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}',true);
  execute 'set local role authenticated';
  if exists(select 1 from public.production_event_daily) then raise exception 'Ordinary account sees telemetry'; end if;
  v_denied := false;
  begin perform public.get_production_monitoring(); exception when insufficient_privilege then v_denied := true; end;
  if not v_denied then raise exception 'Ordinary account reads admin RPC'; end if;
  v_denied := false;
  begin perform public.test_production_monitoring(); exception when insufficient_privilege then v_denied := true; end;
  if not v_denied then raise exception 'Ordinary account can request tests'; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  v_before := public.get_production_monitoring();
  v_result := public.test_production_monitoring();
  if v_result->>'accepted' <> 'true' then raise exception 'Authorized delivery test was rejected'; end if;
  v_after := public.get_production_monitoring();
  if v_before->'summary' is distinct from v_after->'summary' then raise exception 'Synthetic test polluted real counters'; end if;
  v_test_id := (public.get_production_health()->>'testSequence')::bigint;
  if v_test_id < 1 then raise exception 'Synthetic sequence missing'; end if;
  if not public.resolve_production_alert(v_test_id) then raise exception 'Moderator cannot resolve own test'; end if;
  if (public.get_production_health()->>'testSequence')::bigint <> 0 then raise exception 'Resolved test still pending'; end if;
  execute 'reset role';

  update private.production_monitor_budget set minute = date_trunc('minute',now()),minute_samples = 120;
  v_result := public.log_production_event('client_error','/','app','js.range_error');
  if v_result->>'reason' <> 'rate_limit' then raise exception 'Minute limit failed'; end if;
  update private.production_monitor_budget set minute_samples = 0,day = v_day,daily_samples = 10000;
  v_result := public.log_production_event('client_error','/','app','js.range_error');
  if v_result->>'reason' <> 'rate_limit' then raise exception 'Day limit failed'; end if;
  update private.production_monitor_budget set daily_samples = 0;
  insert into public.production_event_daily(day,fingerprint,event_type,severity,path,target,message,code)
    select v_day,encode(extensions.digest('monitor-sql-cardinality-' || i,'sha256'),'hex'),'client_error','warning','/admin','app','Rollback-only cardinality test','test.sql'
    from generate_series(1,500) i on conflict(day,fingerprint) do nothing;
  v_result := public.log_production_event('client_error','/','app','js.range_error');
  if v_result->>'reason' <> 'daily_cardinality_limit' then raise exception 'Cardinality limit failed'; end if;

  insert into public.production_event_daily(day,fingerprint,event_type,severity,path,message,code)
    values(v_day - 50,repeat('f',64),'client_error','warning','/admin','Rollback-only retention test','test.sql') on conflict do nothing;
  perform private.prune_production_monitoring();
  if exists(select 1 from public.production_event_daily where day = v_day - 50 and fingerprint = repeat('f',64)) then raise exception 'Retention failed'; end if;
end;
$test$;
rollback;
select 'Production monitoring: permissions, privacy, thresholds, counters, cooldown windows, limits and retention passed; test data rolled back' as verification;
