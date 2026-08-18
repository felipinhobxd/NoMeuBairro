-- Acompanhamento cívico: protocolo oficial, prevenção de relatos duplicados
-- e solicitações de exclusão de conta com RLS e privilégios mínimos.

alter table public.posts
  add column if not exists official_agency text,
  add column if not exists official_protocol varchar(80),
  add column if not exists official_status text,
  add column if not exists official_contacted_at timestamptz;

alter table public.posts
  drop constraint if exists posts_official_agency_length_check,
  add constraint posts_official_agency_length_check
    check (official_agency is null or char_length(trim(official_agency)) between 2 and 120),
  drop constraint if exists posts_official_protocol_length_check,
  add constraint posts_official_protocol_length_check
    check (official_protocol is null or char_length(trim(official_protocol)) between 1 and 80),
  drop constraint if exists posts_official_status_check,
  add constraint posts_official_status_check
    check (official_status is null or official_status = any (array['submitted'::text, 'in_progress'::text, 'resolved'::text]));

grant select (official_agency, official_protocol, official_status, official_contacted_at)
  on table public.posts to anon, authenticated;
grant insert (official_agency, official_protocol, official_status, official_contacted_at)
  on table public.posts to authenticated;
grant update (official_agency, official_protocol, official_status, official_contacted_at)
  on table public.posts to authenticated;

create index if not exists posts_open_category_location_created_idx
  on public.posts (category, created_at desc)
  where latitude is not null and longitude is not null and status <> 'resolved';

create or replace function public.find_similar_posts(
  p_category public.post_category,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m integer default 600,
  p_limit integer default 5
)
returns table (
  id uuid,
  title text,
  description text,
  status public.post_status,
  location text,
  neighborhood text,
  locality text,
  latitude double precision,
  longitude double precision,
  distance_m integer,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with candidates as (
    select
      p.id,
      p.title::text,
      p.description,
      p.status,
      p.location::text,
      p.neighborhood,
      p.locality,
      p.latitude::double precision as latitude,
      p.longitude::double precision as longitude,
      round(
        6371000::double precision * 2 * asin(sqrt(least(
          1::double precision,
          power(sin(radians((p.latitude::double precision - p_latitude) / 2)), 2)
          + cos(radians(p_latitude)) * cos(radians(p.latitude::double precision))
          * power(sin(radians((p.longitude::double precision - p_longitude) / 2)), 2)
        )))
      )::integer as distance_m,
      p.created_at
    from public.posts p
    where p.category = p_category
      and p.status <> 'resolved'
      and p.latitude is not null
      and p.longitude is not null
      and p_latitude between -90 and 90
      and p_longitude between -180 and 180
  )
  select
    c.id, c.title, c.description, c.status, c.location, c.neighborhood, c.locality,
    c.latitude, c.longitude, c.distance_m, c.created_at
  from candidates c
  where c.distance_m <= least(greatest(coalesce(p_radius_m, 600), 50), 5000)
  order by c.distance_m asc, c.created_at desc
  limit least(greatest(coalesce(p_limit, 5), 1), 5);
$function$;

revoke all on function public.find_similar_posts(public.post_category, double precision, double precision, integer, integer) from public;
grant execute on function public.find_similar_posts(public.post_category, double precision, double precision, integer, integer) to anon, authenticated;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reason text,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  admin_note text,
  constraint account_deletion_requests_status_check
    check (status = any (array['pending'::text, 'completed'::text, 'cancelled'::text])),
  constraint account_deletion_requests_reason_length_check
    check (reason is null or char_length(trim(reason)) between 1 and 1000),
  constraint account_deletion_requests_admin_note_length_check
    check (admin_note is null or char_length(trim(admin_note)) between 1 and 1500)
);

create unique index if not exists account_deletion_requests_one_pending_user_idx
  on public.account_deletion_requests (user_id)
  where status = 'pending';
create index if not exists account_deletion_requests_status_requested_idx
  on public.account_deletion_requests (status, requested_at desc);
create index if not exists account_deletion_requests_reviewed_by_idx
  on public.account_deletion_requests (reviewed_by)
  where reviewed_by is not null;

alter table public.account_deletion_requests enable row level security;

revoke all on table public.account_deletion_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.account_deletion_requests to authenticated;
grant all on table public.account_deletion_requests to service_role;

drop policy if exists account_deletion_requests_select on public.account_deletion_requests;
create policy account_deletion_requests_select
  on public.account_deletion_requests
  for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_moderator()));

drop policy if exists account_deletion_requests_insert on public.account_deletion_requests;
create policy account_deletion_requests_insert
  on public.account_deletion_requests
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and admin_note is null
  );

drop policy if exists account_deletion_requests_delete on public.account_deletion_requests;
create policy account_deletion_requests_delete
  on public.account_deletion_requests
  for delete
  to authenticated
  using (user_id = (select auth.uid()) and status = 'pending');

drop policy if exists account_deletion_requests_moderator_update on public.account_deletion_requests;
create policy account_deletion_requests_moderator_update
  on public.account_deletion_requests
  for update
  to authenticated
  using ((select public.is_moderator()))
  with check ((select public.is_moderator()));

comment on column public.posts.official_protocol is 'Protocolo informado pelo morador após contato com o órgão oficial.';
comment on table public.account_deletion_requests is 'Fila auditável de solicitações de exclusão de conta; a remoção efetiva exige revisão administrativa.';
