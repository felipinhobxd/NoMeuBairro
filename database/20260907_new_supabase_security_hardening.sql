-- NoMeuBairro — hardening audited against the NEW Supabase project on 2026-09-07.
-- Target project ref: gowuvofidacpdavdkpar
-- This file intentionally contains no passwords, service-role keys, JWT secrets or Vault values.
-- It is kept in database/ until the connected Supabase migration history can be read again;
-- when applied through Supabase, version the exact applied migration under supabase/migrations/.

-- -----------------------------------------------------------------------------
-- 1. Least-privilege SQL grants (RLS remains the row-authorization layer)
-- -----------------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke all privileges on all tables in schema private from anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- users contains the login email and internal fields. Browser clients receive only
-- the profile columns they actually need, and may edit only name/avatar/timestamp.
revoke all privileges on table public.users from anon, authenticated;
grant select (id, name, avatar_url, reputation, created_at)
  on table public.users to anon;
grant select (id, name, avatar_url, reputation, created_at, updated_at, account_type)
  on table public.users to authenticated;
grant update (name, avatar_url, updated_at)
  on table public.users to authenticated;

-- Administrative roles are server-controlled. An authenticated user may only read
-- their own row through the existing RLS policy.
revoke all privileges on table public.app_roles from anon, authenticated;
grant select on table public.app_roles to authenticated;

-- Public projection tables are read-only to browser roles.
revoke all privileges on table public.public_user_profiles from anon, authenticated;
grant select on table public.public_user_profiles to anon, authenticated;
revoke all privileges on table public.public_company_profiles from anon, authenticated;
grant select on table public.public_company_profiles to anon, authenticated;
revoke all privileges on table public.public_job_posts from anon, authenticated;
grant select on table public.public_job_posts to anon, authenticated;

-- Company registration/contact data stays private and owner-scoped by RLS.
alter table public.company_profiles
  add column if not exists public_email_enabled boolean not null default false,
  add column if not exists public_phone_enabled boolean not null default false,
  add column if not exists public_whatsapp_enabled boolean not null default false,
  add column if not exists public_address_enabled boolean not null default false;

revoke all privileges on table public.company_profiles from anon, authenticated;
grant select on table public.company_profiles to authenticated;
grant update (
  company_name, description, logo_url, email, phone, whatsapp, website, address,
  neighborhood, public_email_enabled, public_phone_enabled,
  public_whatsapp_enabled, public_address_enabled
) on table public.company_profiles to authenticated;

-- Résumés contain private contact and career information.
revoke all privileges on table public.user_resumes from anon, authenticated;
grant select on table public.user_resumes to authenticated;
grant insert (user_id, email, phone, neighborhood, objective, experience, education, skills)
  on table public.user_resumes to authenticated;
grant update (email, phone, neighborhood, objective, experience, education, skills)
  on table public.user_resumes to authenticated;
grant delete on table public.user_resumes to authenticated;

-- Applications: only the operations used by the product; row ownership remains RLS-enforced.
revoke all privileges on table public.job_applications from anon, authenticated;
grant select on table public.job_applications to authenticated;
grant insert (job_id, user_id, status) on table public.job_applications to authenticated;
grant update (status) on table public.job_applications to authenticated;
grant delete on table public.job_applications to authenticated;

-- Push subscription endpoints and crypto material are never public.
revoke all privileges on table public.push_subscriptions from anon, authenticated;
grant select, delete on table public.push_subscriptions to authenticated;

-- Anonymous ownership controls and legacy base64 payloads are backend-only.
revoke all privileges on table public.anonymous_post_controls from anon, authenticated;
revoke all privileges on table private.legacy_post_images from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. SECURITY DEFINER / RPC surface
-- -----------------------------------------------------------------------------
-- Trigger/event-trigger functions are implementation details, not public RPCs.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_get_function_result(p.oid) in ('trigger', 'event_trigger')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.fn);
  end loop;
end;
$$;

-- Contains VAPID private key and internal dispatch token: service-role only.
revoke all on function public.get_push_server_config() from public, anon, authenticated;
grant execute on function public.get_push_server_config() to service_role;

-- -----------------------------------------------------------------------------
-- 3. Public company profile privacy
-- -----------------------------------------------------------------------------
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
    insert into public.public_company_profiles (
      id, company_name, description, logo_url, email, phone, whatsapp,
      website, address, neighborhood, created_at, updated_at
    ) values (
      new.id,
      new.company_name,
      new.description,
      new.logo_url,
      case when new.public_email_enabled then new.email else null end,
      case when new.public_phone_enabled then new.phone else null end,
      case when new.public_whatsapp_enabled then new.whatsapp else null end,
      new.website,
      case when new.public_address_enabled then new.address else null end,
      new.neighborhood,
      new.created_at,
      new.updated_at
    )
    on conflict (id) do update set
      company_name = excluded.company_name,
      description = excluded.description,
      logo_url = excluded.logo_url,
      email = excluded.email,
      phone = excluded.phone,
      whatsapp = excluded.whatsapp,
      website = excluded.website,
      address = excluded.address,
      neighborhood = excluded.neighborhood,
      updated_at = excluded.updated_at;

    update public.public_job_posts p
       set company_name = new.company_name,
           company_logo_url = new.logo_url,
           company_website = new.website
     where p.company_id = new.id;
  end if;

  return coalesce(new, old);
end;
$$;
revoke execute on function public.sync_public_company_profile() from public, anon, authenticated;

-- Anything mirrored before the visibility flags existed becomes private by default.
update public.public_company_profiles
   set email = null,
       phone = null,
       whatsapp = null,
       address = null
 where email is not null
    or phone is not null
    or whatsapp is not null
    or address is not null;

-- -----------------------------------------------------------------------------
-- 4. Do not store new base64 images in Postgres
-- -----------------------------------------------------------------------------
alter table public.posts drop constraint if exists posts_no_inline_image_data;
alter table public.posts add constraint posts_no_inline_image_data
  check (image_url is null or image_url not like 'data:image/%');

-- The new project contains no legacy post-image rows. Keep the private table so the
-- compatibility /api/post-image path can still be supported if a row is deliberately restored,
-- but do not create new inline/base64 rows.
drop trigger if exists trg_isolate_legacy_post_image on public.posts;
revoke execute on function public.isolate_legacy_post_image() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Realtime: publish only tables currently subscribed by the frontend
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'badges', 'comments', 'content_reports', 'event_attendance',
    'events', 'post_supports', 'users'
  ]
  loop
    if exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end;
$$;

-- posts and notifications deliberately remain in supabase_realtime.
