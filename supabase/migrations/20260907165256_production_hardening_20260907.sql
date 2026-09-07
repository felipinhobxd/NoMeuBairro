-- NoMeuBairro production hardening for NEW Supabase project gowuvofidacpdavdkpar.
-- Audited 2026-09-07. No secret values are stored in this migration.

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all tables in schema private from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
revoke all on schema vault from public, anon, authenticated;
revoke all privileges on table vault.secrets from public, anon, authenticated;
revoke all privileges on table vault.decrypted_secrets from public, anon, authenticated;

grant select on table public.badges, public.comments, public.curitiba_neighborhoods, public.event_attendance, public.events, public.post_status_history, public.post_supports, public.posts, public.public_company_profiles, public.public_job_posts, public.public_user_profiles to anon, authenticated;

grant select (id, name, avatar_url, reputation, created_at) on table public.users to anon;
grant select (id, name, avatar_url, reputation, created_at, updated_at, account_type) on table public.users to authenticated;
grant update (name, avatar_url, updated_at) on table public.users to authenticated;
grant select on table public.app_roles to authenticated;

grant select, delete on table public.account_deletion_requests to authenticated;
grant insert (user_id, reason, status) on table public.account_deletion_requests to authenticated;
grant update (status, reviewed_at, reviewed_by, admin_note) on table public.account_deletion_requests to authenticated;

grant insert (post_id, author_id, parent_id, content) on table public.comments to authenticated;
grant delete on table public.comments to authenticated;

alter table public.company_profiles
  add column if not exists public_email_enabled boolean not null default false,
  add column if not exists public_phone_enabled boolean not null default false,
  add column if not exists public_whatsapp_enabled boolean not null default false,
  add column if not exists public_address_enabled boolean not null default false;

grant select on table public.company_profiles to authenticated;
grant insert (id, company_name, description, logo_url, email, phone, whatsapp, website, address, neighborhood, public_email_enabled, public_phone_enabled, public_whatsapp_enabled, public_address_enabled) on table public.company_profiles to authenticated;
grant update (company_name, description, logo_url, email, phone, whatsapp, website, address, neighborhood, public_email_enabled, public_phone_enabled, public_whatsapp_enabled, public_address_enabled) on table public.company_profiles to authenticated;

grant select on table public.content_reports to authenticated;
grant insert (reporter_id, post_id, comment_id, event_id, reason) on table public.content_reports to authenticated;
grant update (status, archived_title, archived_description, archived_image_url, archived_at, archived_by, archived_content_type, archived_author_name) on table public.content_reports to authenticated;

grant insert (event_id, user_id) on table public.event_attendance to authenticated;
grant delete on table public.event_attendance to authenticated;
grant insert (title, description, event_date, location, latitude, longitude, type, created_by, neighborhood, locality, location_precision) on table public.events to authenticated;
grant delete on table public.events to authenticated;

grant select on table public.job_applications to authenticated;
grant insert (job_id, user_id, status) on table public.job_applications to authenticated;
grant update (status) on table public.job_applications to authenticated;
grant delete on table public.job_applications to authenticated;

grant select on table public.job_posts to authenticated;
grant insert (company_id, title, description, requirements, benefits, salary_min, salary_max, employment_type, work_model, location, neighborhood, contact_email, contact_whatsapp, contact_email_enabled, contact_whatsapp_enabled, is_active, expires_at, latitude, longitude, location_precision, locality) on table public.job_posts to authenticated;
grant update (title, description, requirements, benefits, salary_min, salary_max, employment_type, work_model, location, neighborhood, contact_email, contact_whatsapp, contact_email_enabled, contact_whatsapp_enabled, is_active, expires_at, latitude, longitude, location_precision, locality, updated_at) on table public.job_posts to authenticated;
grant delete on table public.job_posts to authenticated;

grant select on table public.neighborhood_follows to authenticated;
grant insert (user_id, area, kind) on table public.neighborhood_follows to authenticated;
grant delete on table public.neighborhood_follows to authenticated;

grant select, delete on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;

grant insert (user_id, post_id) on table public.post_supports to authenticated;
grant delete on table public.post_supports to authenticated;

grant insert (author_id, category, title, description, image_url, image_thumbnail_url, location, latitude, longitude, neighborhood, locality, location_precision, is_anonymous, official_agency, official_protocol, official_status, official_contacted_at) on table public.posts to authenticated;
grant update (status, official_agency, official_protocol, official_status, official_contacted_at, updated_at) on table public.posts to authenticated;
grant delete on table public.posts to authenticated;

grant select on table public.client_error_logs to authenticated;
grant select on table public.production_alerts to authenticated;
grant update (status, resolved_at, resolved_by) on table public.production_alerts to authenticated;
grant select on table public.production_event_daily to authenticated;
grant select on table public.site_analytics_daily to authenticated;

grant select, delete on table public.push_subscriptions to authenticated;

grant select on table public.saved_items to authenticated;
grant insert (user_id, post_id, event_id, job_id) on table public.saved_items to authenticated;
grant delete on table public.saved_items to authenticated;

grant select on table public.user_resumes to authenticated;
grant insert (user_id, email, phone, neighborhood, objective, experience, education, skills) on table public.user_resumes to authenticated;
grant update (email, phone, neighborhood, objective, experience, education, skills) on table public.user_resumes to authenticated;
grant delete on table public.user_resumes to authenticated;

revoke all privileges on table public.anonymous_post_controls from anon, authenticated;
revoke all privileges on table private.legacy_post_images from anon, authenticated;

create or replace function public.sync_public_company_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.public_company_profiles where id = old.id;
    delete from public.public_job_posts where company_id = old.id;
  else
    insert into public.public_company_profiles (id, company_name, description, logo_url, email, phone, whatsapp, website, address, neighborhood, created_at, updated_at)
    values (new.id, new.company_name, new.description, new.logo_url,
      case when new.public_email_enabled then new.email else null end,
      case when new.public_phone_enabled then new.phone else null end,
      case when new.public_whatsapp_enabled then new.whatsapp else null end,
      new.website,
      case when new.public_address_enabled then new.address else null end,
      new.neighborhood, new.created_at, new.updated_at)
    on conflict (id) do update set
      company_name = excluded.company_name, description = excluded.description, logo_url = excluded.logo_url,
      email = excluded.email, phone = excluded.phone, whatsapp = excluded.whatsapp, website = excluded.website,
      address = excluded.address, neighborhood = excluded.neighborhood, updated_at = excluded.updated_at;
    update public.public_job_posts p
       set company_name = new.company_name, company_logo_url = new.logo_url, company_website = new.website
     where p.company_id = new.id;
  end if;
  return coalesce(new, old);
end;
$$;

update public.public_company_profiles set email = null, phone = null, whatsapp = null, address = null
where email is not null or phone is not null or whatsapp is not null or address is not null;

alter table public.posts drop constraint if exists posts_no_inline_image_data;
alter table public.posts add constraint posts_no_inline_image_data check (image_url is null or image_url not like 'data:image/%');
drop trigger if exists trg_isolate_legacy_post_image on public.posts;

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and pg_get_function_result(p.oid) in ('trigger', 'event_trigger')
  loop execute format('revoke execute on function %s from public, anon, authenticated', r.fn); end loop;
end;
$$;

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private'
  loop execute format('revoke execute on function %s from public, anon, authenticated', r.fn); end loop;
end;
$$;

create or replace function public.get_production_health() returns jsonb language sql stable security definer set search_path = '' as $$ select private.get_production_health_internal(); $$;
create or replace function public.get_public_moderation_transparency() returns jsonb language sql stable security definer set search_path = '' as $$ select private.get_public_moderation_transparency_internal(); $$;
create or replace function public.log_production_event(p_event_type text, p_path text default null, p_target text default null, p_message text default null, p_duration_ms integer default null, p_status_code integer default null, p_device_class text default null, p_release text default null) returns jsonb language sql security definer set search_path = '' as $$ select private.log_production_event_internal(p_event_type, p_path, p_target, p_message, p_duration_ms, p_status_code, p_device_class, p_release); $$;
create or replace function public.track_page_view(p_path text) returns void language sql security definer set search_path = '' as $$ select private.track_page_view_internal(p_path); $$;
create or replace function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null) returns boolean language sql security definer set search_path = '' as $$ select private.register_push_subscription_internal(p_endpoint, p_p256dh, p_auth, p_user_agent); $$;

revoke all on function public.get_production_health() from public, anon, authenticated;
grant execute on function public.get_production_health() to anon, authenticated, service_role;
revoke all on function public.get_public_moderation_transparency() from public, anon, authenticated;
grant execute on function public.get_public_moderation_transparency() to anon, authenticated, service_role;
revoke all on function public.log_production_event(text,text,text,text,integer,integer,text,text) from public, anon, authenticated;
grant execute on function public.log_production_event(text,text,text,text,integer,integer,text,text) to anon, authenticated, service_role;
revoke all on function public.track_page_view(text) from public, anon, authenticated;
grant execute on function public.track_page_view(text) to anon, authenticated, service_role;
revoke all on function public.register_push_subscription(text,text,text,text) from public, anon, authenticated;
grant execute on function public.register_push_subscription(text,text,text,text) to authenticated, service_role;
revoke all on function public.log_client_error(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.log_client_error(text,text,text,text,text) to service_role;

create or replace function public.get_push_server_config()
returns jsonb language sql stable security definer set search_path = ''
as $$ select jsonb_build_object(
  'publicKey', (select decrypted_secret from vault.decrypted_secrets where name = 'nmb_vapid_public_key' limit 1),
  'privateKey', (select decrypted_secret from vault.decrypted_secrets where name = 'nmb_vapid_private_key' limit 1),
  'dispatchToken', (select decrypted_secret from vault.decrypted_secrets where name = 'nmb_push_dispatch_token' limit 1)
); $$;
revoke all on function public.get_push_server_config() from public, anon, authenticated;
grant execute on function public.get_push_server_config() to service_role;

revoke execute on function public.find_similar_posts(post_category,double precision,double precision,integer,integer) from anon;
grant execute on function public.find_similar_posts(post_category,double precision,double precision,integer,integer) to authenticated, service_role;

do $$
declare fn regprocedure;
begin
  foreach fn in array array[
    to_regprocedure('public.get_client_error_logs(integer)'), to_regprocedure('public.get_moderation_history(integer)'),
    to_regprocedure('public.get_moderation_queue(integer)'), to_regprocedure('public.get_moderation_queue_v2(integer)'),
    to_regprocedure('public.get_production_monitoring(integer)'), to_regprocedure('public.get_usage_analytics(integer)'),
    to_regprocedure('public.moderate_content_report(uuid,text)'), to_regprocedure('public.resolve_production_alert(bigint)'),
    to_regprocedure('public.test_production_monitoring()')]
  loop if fn is not null then execute format('revoke execute on function %s from public, anon', fn); execute format('grant execute on function %s to authenticated, service_role', fn); end if; end loop;
end;
$$;

do $$
declare fn regprocedure;
begin
  foreach fn in array array[to_regprocedure('public.apply_nearest_curitiba_locality()'), to_regprocedure('public.best_curitiba_locality(double precision,double precision,text)'), to_regprocedure('public.normalize_location_text(text)')]
  loop if fn is not null then execute format('revoke execute on function %s from public, anon, authenticated', fn); end if; end loop;
end;
$$;

create or replace function public.can_upload_owned_storage_object(p_bucket text, p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_total bigint; v_today bigint;
begin
  if v_uid is null or p_bucket not in ('avatars','post-images') then return false; end if;
  if split_part(p_name,'/',1) <> v_uid::text or p_name like '%..%' then return false; end if;
  select count(*) into v_total from storage.objects o where o.bucket_id=p_bucket and split_part(o.name,'/',1)=v_uid::text;
  if p_bucket='avatars' then return v_total < 5; end if;
  if v_total >= 300 then return false; end if;
  select count(*) into v_today from storage.objects o where o.bucket_id=p_bucket and split_part(o.name,'/',1)=v_uid::text and o.created_at >= date_trunc('day',now());
  return v_today < 50;
end;
$$;
revoke all on function public.can_upload_owned_storage_object(text,text) from public, anon, authenticated;
grant execute on function public.can_upload_owned_storage_object(text,text) to authenticated;

drop policy if exists "Avatar uploads own folder" on storage.objects;
create policy "Avatar uploads own folder" on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and public.can_upload_owned_storage_object(bucket_id,name));
drop policy if exists "Post images authenticated insert" on storage.objects;
create policy "Post images authenticated insert" on storage.objects for insert to authenticated with check (bucket_id='post-images' and (storage.foldername(name))[1]=(select auth.uid())::text and public.can_upload_owned_storage_object(bucket_id,name));

create table if not exists private.anonymous_request_limits (
  action text not null,
  client_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (action, client_hash, window_start)
);
create index if not exists anonymous_request_limits_window_idx on private.anonymous_request_limits (window_start);
alter table private.anonymous_request_limits enable row level security;
revoke all privileges on table private.anonymous_request_limits from public, anon, authenticated;

create or replace function public.consume_anonymous_post_rate_limit(p_action text, p_client_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz:=clock_timestamp(); v_window timestamptz; v_limit integer; v_global_limit integer; v_count integer; v_global_count integer;
begin
  if p_client_hash is null or p_client_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  case p_action when 'resolve_location' then v_window:=date_bin(interval '15 minutes',v_now,timestamptz '2000-01-01 00:00:00+00'); v_limit:=30; v_global_limit:=5000;
    when 'create' then v_window:=date_trunc('hour',v_now); v_limit:=5; v_global_limit:=250;
    when 'upload' then v_window:=date_trunc('day',v_now); v_limit:=10; v_global_limit:=100;
    else return false; end case;
  insert into private.anonymous_request_limits(action,client_hash,window_start,request_count) values(p_action,p_client_hash,v_window,1)
  on conflict(action,client_hash,window_start) do update set request_count=private.anonymous_request_limits.request_count+1 where private.anonymous_request_limits.request_count<v_limit returning request_count into v_count;
  if v_count is null then return false; end if;
  insert into private.anonymous_request_limits(action,client_hash,window_start,request_count) values(p_action||':global','global',date_trunc('day',v_now),1)
  on conflict(action,client_hash,window_start) do update set request_count=private.anonymous_request_limits.request_count+1 where private.anonymous_request_limits.request_count<v_global_limit returning request_count into v_global_count;
  delete from private.anonymous_request_limits where window_start < v_now - interval '3 days';
  return v_global_count is not null;
end;
$$;
revoke all on function public.consume_anonymous_post_rate_limit(text,text) from public, anon, authenticated;
grant execute on function public.consume_anonymous_post_rate_limit(text,text) to service_role;

do $$
declare t text;
begin
  foreach t in array array['badges','comments','content_reports','event_attendance','events','post_supports','users'] loop
    if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime drop table public.%I',t); end if;
  end loop;
end;
$$;
