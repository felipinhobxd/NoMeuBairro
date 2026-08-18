create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  job_id uuid references public.job_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_items_single_target_check check (num_nonnulls(post_id, event_id, job_id) = 1)
);
create unique index if not exists saved_items_post_unique on public.saved_items(user_id, post_id) where post_id is not null;
create unique index if not exists saved_items_event_unique on public.saved_items(user_id, event_id) where event_id is not null;
create unique index if not exists saved_items_job_unique on public.saved_items(user_id, job_id) where job_id is not null;
create index if not exists saved_items_user_created_idx on public.saved_items(user_id, created_at desc);
alter table public.saved_items enable row level security;
revoke all on table public.saved_items from anon, authenticated;
grant select, insert, delete on table public.saved_items to authenticated;
drop policy if exists saved_items_select_own on public.saved_items;
create policy saved_items_select_own on public.saved_items for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists saved_items_insert_own on public.saved_items;
create policy saved_items_insert_own on public.saved_items for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists saved_items_delete_own on public.saved_items;
create policy saved_items_delete_own on public.saved_items for delete to authenticated using ((select auth.uid()) = user_id);
