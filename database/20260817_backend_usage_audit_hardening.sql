-- Auditoria de uso do backend: reduz trabalho no caminho quente, remove privilégio
-- desnecessário e completa índices úteis para integridade referencial.

create or replace function private.track_page_view_internal(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_path text := left(coalesce(nullif(trim(p_path), ''), '/'), 120);
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_first_view_today boolean;
begin
  if v_path !~ '^/' then v_path := '/' || v_path; end if;
  if v_path ~ '^/post/' then v_path := '/post/:id'; end if;
  if v_path ~ '^/perfil/' then v_path := '/perfil/:id'; end if;
  if v_path ~ '^/empresa/' then v_path := '/empresa/:id'; end if;

  if v_path not in (
    '/', '/mapa', '/estatisticas', '/empregos', '/mural', '/denuncias',
    '/perfil', '/perfil/:id', '/post/:id', '/empresa', '/empresa/:id',
    '/notificacoes', '/admin', '/privacidade', '/termos', '/login'
  ) then
    return;
  end if;

  select not exists (
    select 1
    from public.site_analytics_daily
    where day = v_day
  ) into v_first_view_today;

  insert into public.site_analytics_daily(day, path, views)
  values (v_day, v_path, 1)
  on conflict (day, path) do update
    set views = public.site_analytics_daily.views + 1;

  -- A retenção de erros não precisa rodar em cada visualização de página.
  -- A primeira visualização do dia é suficiente; uma corrida simultânea aqui
  -- causaria, no máximo, duas limpezas idempotentes no mesmo instante.
  if v_first_view_today then
    delete from public.client_error_logs
    where created_at < now() - interval '90 days';
  end if;
end;
$function$;

create or replace function public.get_community_contribution_summary(p_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'postsCount', (select count(*) from public.posts p where p.author_id = p_user_id and coalesce(p.is_anonymous, false) = false),
    'resolvedCount', (select count(*) from public.posts p where p.author_id = p_user_id and coalesce(p.is_anonymous, false) = false and p.status = 'resolved'),
    'supportsReceived', (select count(*) from public.post_supports s join public.posts p on p.id = s.post_id where p.author_id = p_user_id and coalesce(p.is_anonymous, false) = false),
    'supportsGiven', (select count(*) from public.post_supports s where s.user_id = p_user_id),
    'commentsCount', (select count(*) from public.comments c where c.author_id = p_user_id),
    'repliesCount', (select count(*) from public.comments c where c.author_id = p_user_id and c.parent_id is not null),
    'eventsCount', (select count(*) from public.events e where e.created_by = p_user_id),
    'eventsAttended', (select count(*) from public.event_attendance a where a.user_id = p_user_id)
  );
$function$;

create index if not exists post_status_history_changed_by_idx
  on public.post_status_history(changed_by)
  where changed_by is not null;

create index if not exists saved_items_post_id_idx
  on public.saved_items(post_id)
  where post_id is not null;

create index if not exists saved_items_event_id_idx
  on public.saved_items(event_id)
  where event_id is not null;

create index if not exists saved_items_job_id_idx
  on public.saved_items(job_id)
  where job_id is not null;
