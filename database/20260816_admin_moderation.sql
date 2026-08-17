-- Extends the existing moderation system to mural events and grants the requested admin role.
-- Apply this migration to the connected Supabase project before merging/deploying the frontend.

alter table public.content_reports
  add column if not exists event_id uuid references public.events(id) on delete cascade;

create index if not exists idx_content_reports_event_id
  on public.content_reports(event_id);

drop policy if exists events_delete on public.events;
drop policy if exists events_delete_allowed on public.events;
create policy events_delete_allowed
on public.events
for delete
to authenticated
using (
  (select auth.uid()) = created_by
  or exists (
    select 1
    from public.app_roles r
    where r.user_id = (select auth.uid())
      and r.role in ('moderator', 'admin')
  )
);

create or replace function public.get_moderation_queue_v2(p_limit integer default 50)
returns table(
  report_id uuid,
  reason text,
  report_status text,
  reported_at timestamptz,
  post_id uuid,
  comment_id uuid,
  event_id uuid,
  content_type text,
  content_title text,
  content_preview text,
  content_author_name text,
  reporter_name text
)
language plpgsql
set search_path to 'public'
as $function$
begin
  if not public.is_moderator() then
    raise exception 'not authorized';
  end if;

  return query
  select
    r.id,
    r.reason::text,
    r.status::text,
    r.created_at,
    coalesce(r.post_id, c.post_id),
    r.comment_id,
    r.event_id,
    (case
      when r.event_id is not null then 'event'
      when r.comment_id is not null then 'comment'
      else 'post'
    end)::text,
    coalesce(p.title::text, e.title::text, 'Comentário'::text),
    coalesce(p.description::text, c.content::text, e.description::text, r.archived_description::text, ''::text),
    coalesce(pu.name::text, cu.name::text, eu.name::text, 'Morador'::text),
    coalesce(ru.name::text, 'Não identificado'::text)
  from public.content_reports r
  left join public.posts p on p.id = r.post_id
  left join public.comments c on c.id = r.comment_id
  left join public.events e on e.id = r.event_id
  left join public.users pu on pu.id = p.author_id
  left join public.users cu on cu.id = c.author_id
  left join public.users eu on eu.id = e.created_by
  left join public.users ru on ru.id = r.reporter_id
  where r.status = 'pending'
  order by r.created_at asc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$function$;

create or replace function public.moderate_content_report(p_report_id uuid, p_action text)
returns boolean
language plpgsql
set search_path to 'public'
as $function$
declare
  v_report public.content_reports%rowtype;
  v_title text;
  v_description text;
  v_image text;
begin
  if not public.is_moderator() then
    raise exception 'not authorized';
  end if;

  if p_action not in ('ignore', 'remove') then
    raise exception 'invalid action';
  end if;

  select * into v_report
  from public.content_reports
  where id = p_report_id
  for update;

  if not found then
    return false;
  end if;

  if p_action = 'ignore' then
    update public.content_reports
    set status = 'ignored', archived_at = now(), archived_by = (select auth.uid())
    where id = p_report_id;
    return true;
  end if;

  if v_report.event_id is not null then
    select e.title, e.description
    into v_title, v_description
    from public.events e
    where e.id = v_report.event_id;

    update public.content_reports
    set archived_title = coalesce(v_title, 'Evento removido'),
        archived_description = v_description,
        archived_image_url = null,
        archived_at = now(),
        archived_by = (select auth.uid()),
        status = 'resolved',
        event_id = null
    where id = p_report_id;

    delete from public.events where id = v_report.event_id;
    return true;
  end if;

  if v_report.post_id is not null then
    select p.title, p.description, p.image_url
    into v_title, v_description, v_image
    from public.posts p
    where p.id = v_report.post_id;

    update public.content_reports
    set archived_title = coalesce(v_title, 'Relato removido'),
        archived_description = v_description,
        archived_image_url = v_image,
        archived_at = now(),
        archived_by = (select auth.uid()),
        status = 'resolved',
        post_id = null
    where id = p_report_id;

    delete from public.posts where id = v_report.post_id;
    return true;
  end if;

  if v_report.comment_id is not null then
    select c.content into v_description
    from public.comments c
    where c.id = v_report.comment_id;

    update public.content_reports
    set archived_title = 'Comentário removido',
        archived_description = v_description,
        archived_at = now(),
        archived_by = (select auth.uid()),
        status = 'resolved',
        comment_id = null
    where id = p_report_id;

    delete from public.comments where id = v_report.comment_id;
    return true;
  end if;

  update public.content_reports
  set status = 'resolved', archived_at = now(), archived_by = (select auth.uid())
  where id = p_report_id;
  return true;
end;
$function$;

revoke all on function public.get_moderation_queue_v2(integer) from public, anon;
grant execute on function public.get_moderation_queue_v2(integer) to authenticated;

revoke all on function public.moderate_content_report(uuid, text) from public, anon;
grant execute on function public.moderate_content_report(uuid, text) to authenticated;

insert into public.app_roles(user_id, role)
values ('4ce4ff38-5aeb-4e13-bcdc-f45423f31bc0'::uuid, 'admin')
on conflict (user_id) do update set role = excluded.role;

-- 2026-08-17: persist moderation snapshots and expose a read-only history RPC.
alter table public.content_reports
  add column if not exists archived_content_type text,
  add column if not exists archived_author_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'content_reports_archived_content_type_check'
      and conrelid = 'public.content_reports'::regclass
  ) then
    alter table public.content_reports
      add constraint content_reports_archived_content_type_check
      check (archived_content_type is null or archived_content_type in ('post','comment','event'));
  end if;
end $$;

update public.content_reports
set archived_content_type = case
  when post_id is not null then 'post'
  when comment_id is not null then 'comment'
  when event_id is not null then 'event'
  when archived_title = 'Comentário removido' then 'comment'
  when archived_image_url is not null then 'post'
  when status = 'resolved' and archived_title is not null then 'post'
  else archived_content_type
end
where archived_content_type is null;

create or replace function public.moderate_content_report(p_report_id uuid, p_action text)
returns boolean
language plpgsql
set search_path to 'public'
as $function$
declare
  v_report public.content_reports%rowtype;
  v_title text;
  v_description text;
  v_image text;
  v_author_name text;
  v_actor uuid := (select auth.uid());
begin
  if not public.is_moderator() then raise exception 'not authorized'; end if;
  if p_action not in ('ignore','remove') then raise exception 'invalid action'; end if;

  select * into v_report from public.content_reports where id = p_report_id for update;
  if not found then return false; end if;

  if v_report.post_id is not null then
    select p.title, p.description, p.image_url, u.name
      into v_title, v_description, v_image, v_author_name
    from public.posts p left join public.users u on u.id = p.author_id
    where p.id = v_report.post_id;

    update public.content_reports set
      archived_title = coalesce(archived_title, v_title, case when p_action = 'remove' then 'Relato removido' else 'Relato' end),
      archived_description = coalesce(archived_description, v_description),
      archived_image_url = coalesce(archived_image_url, v_image),
      archived_author_name = coalesce(archived_author_name, v_author_name),
      archived_content_type = coalesce(archived_content_type, 'post'),
      archived_at = now(), archived_by = v_actor,
      status = case when p_action = 'ignore' then 'ignored' else 'resolved' end,
      post_id = case when p_action = 'remove' then null else post_id end
    where post_id = v_report.post_id and status = 'pending';

    if p_action = 'remove' then delete from public.posts where id = v_report.post_id; end if;
    return true;
  end if;

  if v_report.comment_id is not null then
    select c.content, u.name into v_description, v_author_name
    from public.comments c left join public.users u on u.id = c.author_id
    where c.id = v_report.comment_id;

    update public.content_reports set
      archived_title = coalesce(archived_title, case when p_action = 'remove' then 'Comentário removido' else 'Comentário' end),
      archived_description = coalesce(archived_description, v_description),
      archived_author_name = coalesce(archived_author_name, v_author_name),
      archived_content_type = coalesce(archived_content_type, 'comment'),
      archived_at = now(), archived_by = v_actor,
      status = case when p_action = 'ignore' then 'ignored' else 'resolved' end,
      comment_id = case when p_action = 'remove' then null else comment_id end
    where comment_id = v_report.comment_id and status = 'pending';

    if p_action = 'remove' then delete from public.comments where id = v_report.comment_id; end if;
    return true;
  end if;

  if v_report.event_id is not null then
    select e.title, e.description, u.name into v_title, v_description, v_author_name
    from public.events e left join public.users u on u.id = e.created_by
    where e.id = v_report.event_id;

    update public.content_reports set
      archived_title = coalesce(archived_title, v_title, case when p_action = 'remove' then 'Evento removido' else 'Evento' end),
      archived_description = coalesce(archived_description, v_description),
      archived_author_name = coalesce(archived_author_name, v_author_name),
      archived_content_type = coalesce(archived_content_type, 'event'),
      archived_at = now(), archived_by = v_actor,
      status = case when p_action = 'ignore' then 'ignored' else 'resolved' end,
      event_id = case when p_action = 'remove' then null else event_id end
    where event_id = v_report.event_id and status = 'pending';

    if p_action = 'remove' then delete from public.events where id = v_report.event_id; end if;
    return true;
  end if;

  update public.content_reports
  set status = case when p_action = 'ignore' then 'ignored' else 'resolved' end,
      archived_at = now(), archived_by = v_actor
  where id = p_report_id and status = 'pending';
  return true;
end;
$function$;

create or replace function public.get_moderation_history(p_limit integer default 100)
returns table(
  report_id uuid, reason text, report_status text, reported_at timestamptz,
  moderated_at timestamptz, moderator_id uuid, moderator_name text,
  moderation_action text, content_type text, content_title text,
  content_preview text, content_author_name text, reporter_name text
)
language plpgsql
set search_path to 'public'
as $function$
begin
  if not public.is_moderator() then raise exception 'not authorized'; end if;

  return query
  select
    r.id, r.reason::text, r.status::text, r.created_at, r.archived_at, r.archived_by,
    coalesce(mu.name::text, 'Administrador'::text),
    (case when r.status = 'ignored' then 'ignore' else 'remove' end)::text,
    coalesce(r.archived_content_type,
      case when r.post_id is not null then 'post'
           when r.comment_id is not null then 'comment'
           when r.event_id is not null then 'event'
           when r.archived_title = 'Comentário removido' then 'comment'
           when r.archived_image_url is not null then 'post'
           else 'post' end)::text,
    coalesce(r.archived_title::text, p.title::text, e.title::text,
      case when r.comment_id is not null then 'Comentário'::text else 'Conteúdo moderado'::text end),
    coalesce(r.archived_description::text, p.description::text, c.content::text, e.description::text, ''::text),
    coalesce(r.archived_author_name::text, pu.name::text, cu.name::text, eu.name::text, 'Não identificado'::text),
    coalesce(ru.name::text, 'Não identificado'::text)
  from public.content_reports r
  left join public.posts p on p.id = r.post_id
  left join public.comments c on c.id = r.comment_id
  left join public.events e on e.id = r.event_id
  left join public.users pu on pu.id = p.author_id
  left join public.users cu on cu.id = c.author_id
  left join public.users eu on eu.id = e.created_by
  left join public.users ru on ru.id = r.reporter_id
  left join public.users mu on mu.id = r.archived_by
  where r.status <> 'pending' and r.archived_at is not null
  order by r.archived_at desc, r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$function$;

revoke all on function public.get_moderation_history(integer) from public;
revoke all on function public.get_moderation_history(integer) from anon;
grant execute on function public.get_moderation_history(integer) to authenticated;
