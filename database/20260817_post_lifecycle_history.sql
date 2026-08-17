-- Post lifecycle tracking: Aberto -> Em andamento -> Resolvido
-- The persisted enum keeps `pending` for backwards compatibility; the UI calls it "Aberto".

create table if not exists public.post_status_history (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  old_status public.post_status,
  new_status public.post_status not null,
  changed_by uuid references public.users(id) on delete set null,
  source text not null default 'system',
  changed_at timestamptz not null default now(),
  constraint post_status_history_source_check check (
    source = any (array['created'::text,'author'::text,'anonymous_owner'::text,'moderation'::text,'system'::text,'baseline'::text])
  )
);

create index if not exists idx_post_status_history_post_changed
  on public.post_status_history (post_id, changed_at desc);

alter table public.post_status_history enable row level security;

revoke all on table public.post_status_history from anon, authenticated;
grant select (id, post_id, old_status, new_status, source, changed_at)
  on public.post_status_history to anon, authenticated;

drop policy if exists post_status_history_select on public.post_status_history;
create policy post_status_history_select
  on public.post_status_history
  for select
  to public
  using (true);

create or replace function public.log_post_status_history()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_source text;
begin
  v_source := case
    when auth.uid() is not null and public.is_moderator() then 'moderation'
    when auth.uid() is not null and new.author_id = auth.uid() then 'author'
    when new.is_anonymous is true then 'anonymous_owner'
    else 'system'
  end;

  if tg_op = 'INSERT' then
    insert into public.post_status_history(post_id, old_status, new_status, changed_by, source, changed_at)
    values (new.id, null, new.status, auth.uid(), 'created', coalesce(new.created_at, now()));
  elsif old.status is distinct from new.status then
    insert into public.post_status_history(post_id, old_status, new_status, changed_by, source)
    values (new.id, old.status, new.status, auth.uid(), v_source);
  end if;

  return new;
end;
$$;

revoke all on function public.log_post_status_history() from public, anon, authenticated;

drop trigger if exists trg_log_post_status_history on public.posts;
create trigger trg_log_post_status_history
after insert or update of status on public.posts
for each row execute function public.log_post_status_history();

insert into public.post_status_history(post_id, old_status, new_status, changed_by, source, changed_at)
select p.id, null, p.status, null, 'baseline', p.created_at
from public.posts p
where not exists (
  select 1 from public.post_status_history h where h.post_id = p.id
);

drop policy if exists posts_update on public.posts;
create policy posts_update
  on public.posts
  for update
  to authenticated
  using ((select auth.uid()) = author_id or public.is_moderator())
  with check ((select auth.uid()) = author_id or public.is_moderator());
