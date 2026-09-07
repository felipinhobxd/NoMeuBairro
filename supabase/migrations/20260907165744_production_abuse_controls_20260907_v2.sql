-- Robust upload counters and server-side anonymous request hashing.

create table if not exists private.storage_upload_limits (
  user_id uuid not null,
  bucket_id text not null,
  day date not null,
  attempts integer not null default 0 check (attempts >= 0),
  primary key (user_id, bucket_id, day)
);
alter table private.storage_upload_limits enable row level security;
revoke all privileges on table private.storage_upload_limits from public, anon, authenticated;

create or replace function public.can_upload_owned_storage_object(
  p_bucket text,
  p_name text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_total bigint;
  v_attempts integer;
  v_daily_limit integer;
begin
  if v_uid is null or p_bucket not in ('avatars', 'post-images') then return false; end if;
  if split_part(p_name, '/', 1) <> v_uid::text or p_name like '%..%' then return false; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_bucket || ':' || v_uid::text, 0));
  select count(*) into v_total from storage.objects o where o.bucket_id = p_bucket and split_part(o.name, '/', 1) = v_uid::text;

  if p_bucket = 'avatars' then
    if v_total >= 5 then return false; end if;
    v_daily_limit := 20;
  else
    if v_total >= 300 then return false; end if;
    v_daily_limit := 50;
  end if;

  insert into private.storage_upload_limits(user_id, bucket_id, day, attempts)
  values (v_uid, p_bucket, current_date, 1)
  on conflict (user_id, bucket_id, day)
  do update set attempts = private.storage_upload_limits.attempts + 1
  where private.storage_upload_limits.attempts < v_daily_limit
  returning attempts into v_attempts;

  delete from private.storage_upload_limits where day < current_date - 14;
  return v_attempts is not null;
end;
$$;
revoke all on function public.can_upload_owned_storage_object(text,text) from public, anon, authenticated;
grant execute on function public.can_upload_owned_storage_object(text,text) to authenticated;

create or replace function public.consume_anonymous_post_rate_limit(
  p_action text,
  p_client_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window timestamptz;
  v_limit integer;
  v_global_limit integer;
  v_count integer;
  v_global_count integer;
  v_pepper text;
  v_client_hash text;
begin
  if p_client_hash is null or char_length(p_client_hash) < 3 or char_length(p_client_hash) > 1000 then return false; end if;

  select decrypted_secret into v_pepper
    from vault.decrypted_secrets
   where name = 'nmb_anon_rate_limit_pepper'
   limit 1;
  if v_pepper is null or v_pepper = '' then return false; end if;

  v_client_hash := encode(extensions.digest(v_pepper || ':' || p_client_hash, 'sha256'), 'hex');

  case p_action
    when 'resolve_location' then
      v_window := date_bin(interval '15 minutes', v_now, timestamptz '2000-01-01 00:00:00+00'); v_limit := 30; v_global_limit := 5000;
    when 'create' then
      v_window := date_trunc('hour', v_now); v_limit := 5; v_global_limit := 250;
    when 'upload' then
      v_window := date_trunc('day', v_now); v_limit := 10; v_global_limit := 100;
    else return false;
  end case;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_action || ':' || v_client_hash, 0));

  insert into private.anonymous_request_limits(action, client_hash, window_start, request_count)
  values (p_action, v_client_hash, v_window, 1)
  on conflict (action, client_hash, window_start)
  do update set request_count = private.anonymous_request_limits.request_count + 1
  where private.anonymous_request_limits.request_count < v_limit
  returning request_count into v_count;
  if v_count is null then return false; end if;

  insert into private.anonymous_request_limits(action, client_hash, window_start, request_count)
  values (p_action || ':global', 'global', date_trunc('day', v_now), 1)
  on conflict (action, client_hash, window_start)
  do update set request_count = private.anonymous_request_limits.request_count + 1
  where private.anonymous_request_limits.request_count < v_global_limit
  returning request_count into v_global_count;

  delete from private.anonymous_request_limits where window_start < v_now - interval '3 days';
  return v_global_count is not null;
end;
$$;
revoke all on function public.consume_anonymous_post_rate_limit(text,text) from public, anon, authenticated;
grant execute on function public.consume_anonymous_post_rate_limit(text,text) to service_role;
