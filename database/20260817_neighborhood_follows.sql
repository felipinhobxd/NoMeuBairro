create table if not exists public.neighborhood_follows (
  user_id uuid not null references public.users(id) on delete cascade,
  area text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, area, kind),
  constraint neighborhood_follows_area_check check (char_length(trim(area)) between 2 and 100),
  constraint neighborhood_follows_kind_check check (kind = any (array['official'::text, 'locality'::text]))
);

create index if not exists idx_neighborhood_follows_area on public.neighborhood_follows (kind, area);
alter table public.neighborhood_follows enable row level security;
revoke all on table public.neighborhood_follows from anon, authenticated;
grant select, insert, delete on table public.neighborhood_follows to authenticated;

drop policy if exists neighborhood_follows_select_own on public.neighborhood_follows;
create policy neighborhood_follows_select_own on public.neighborhood_follows for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists neighborhood_follows_insert_own on public.neighborhood_follows;
create policy neighborhood_follows_insert_own on public.neighborhood_follows for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists neighborhood_follows_delete_own on public.neighborhood_follows;
create policy neighborhood_follows_delete_own on public.neighborhood_follows for delete to authenticated using ((select auth.uid()) = user_id);

create unique index if not exists notifications_neighborhood_post_unique on public.notifications (user_id, post_id, type) where type = 'neighborhood_post' and post_id is not null;
create unique index if not exists notifications_neighborhood_event_unique on public.notifications (user_id, event_id, type) where type = 'neighborhood_event' and event_id is not null;
create unique index if not exists notifications_neighborhood_job_unique on public.notifications (user_id, job_id, type) where type = 'neighborhood_job' and job_id is not null;

create or replace function public.notify_neighborhood_followers_post()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  if new.is_anonymous is true then return new; end if;
  insert into public.notifications(user_id, actor_id, type, post_id)
  select f.user_id, new.author_id, 'neighborhood_post', new.id
  from public.neighborhood_follows f
  where ((f.kind = 'official' and new.neighborhood is not null and f.area = new.neighborhood)
      or (f.kind = 'locality' and new.locality is not null and f.area = new.locality))
    and f.user_id is distinct from new.author_id
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.notify_neighborhood_followers_event()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  insert into public.notifications(user_id, actor_id, type, event_id)
  select f.user_id, new.created_by, 'neighborhood_event', new.id
  from public.neighborhood_follows f
  where ((f.kind = 'official' and new.neighborhood is not null and f.area = new.neighborhood)
      or (f.kind = 'locality' and new.locality is not null and f.area = new.locality))
    and f.user_id is distinct from new.created_by
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.notify_neighborhood_followers_job()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  if new.is_active is not true then return new; end if;
  insert into public.notifications(user_id, actor_id, type, job_id)
  select f.user_id, null, 'neighborhood_job', new.id
  from public.neighborhood_follows f
  where ((f.kind = 'official' and new.neighborhood is not null and f.area = new.neighborhood)
      or (f.kind = 'locality' and new.locality is not null and f.area = new.locality))
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.notify_neighborhood_followers_post() from public, anon, authenticated;
revoke all on function public.notify_neighborhood_followers_event() from public, anon, authenticated;
revoke all on function public.notify_neighborhood_followers_job() from public, anon, authenticated;

drop trigger if exists trg_notify_neighborhood_followers_post on public.posts;
create trigger trg_notify_neighborhood_followers_post after insert on public.posts for each row execute function public.notify_neighborhood_followers_post();
drop trigger if exists trg_notify_neighborhood_followers_event on public.events;
create trigger trg_notify_neighborhood_followers_event after insert on public.events for each row execute function public.notify_neighborhood_followers_event();
drop trigger if exists trg_notify_neighborhood_followers_job on public.job_posts;
create trigger trg_notify_neighborhood_followers_job after insert on public.job_posts for each row execute function public.notify_neighborhood_followers_job();
