-- Product polish: busca global, anti-spam, analytics agregados e observabilidade.
-- Aplicada ao Supabase conectado em 2026-08-17.

create extension if not exists unaccent with schema extensions;

create or replace function public.global_search(p_query text, p_limit integer default 16)
returns table(result_type text, id text, title text, subtitle text, description text, path text, created_at timestamptz, score integer)
language sql stable security invoker set search_path = ''
as $function$
  with input as (select lower(extensions.unaccent(trim(coalesce(p_query, '')))) as q),
  results as (
    select 'post'::text, p.id::text, p.title::text,
      coalesce(nullif(p.neighborhood,''),nullif(p.locality,''),nullif(p.location::text,''),'Relato da comunidade')::text,
      left(coalesce(p.description,''),220)::text, ('/post/'||p.id::text)::text, p.created_at,
      (case when lower(extensions.unaccent(p.title::text))=i.q then 100 when lower(extensions.unaccent(p.title::text)) like i.q||'%' then 85 when lower(extensions.unaccent(p.title::text)) like '%'||i.q||'%' then 65 else 35 end)::integer
    from public.posts p cross join input i
    where length(i.q)>=2 and lower(extensions.unaccent(concat_ws(' ',p.title,p.description,p.location,p.neighborhood,p.locality,p.category::text))) like '%'||i.q||'%'
    union all
    select 'event',e.id::text,e.title::text,
      coalesce(nullif(e.neighborhood,''),nullif(e.locality,''),nullif(e.location::text,''),'Evento do mural')::text,
      left(coalesce(e.description,''),220)::text,'/mural',e.created_at,
      (case when lower(extensions.unaccent(e.title::text))=i.q then 100 when lower(extensions.unaccent(e.title::text)) like i.q||'%' then 85 when lower(extensions.unaccent(e.title::text)) like '%'||i.q||'%' then 65 else 35 end)::integer
    from public.events e cross join input i
    where length(i.q)>=2 and lower(extensions.unaccent(concat_ws(' ',e.title,e.description,e.location,e.neighborhood,e.locality,e.type::text))) like '%'||i.q||'%'
    union all
    select 'job',j.id::text,j.title::text,concat_ws(' · ',nullif(j.company_name::text,''),nullif(j.neighborhood::text,''),nullif(j.work_model::text,''))::text,
      left(coalesce(j.description,''),220)::text,'/empregos',j.created_at,
      (case when lower(extensions.unaccent(j.title::text))=i.q then 100 when lower(extensions.unaccent(j.title::text)) like i.q||'%' then 85 when lower(extensions.unaccent(j.title::text)) like '%'||i.q||'%' then 65 else 35 end)::integer
    from public.public_job_posts j cross join input i
    where length(i.q)>=2 and coalesce(j.is_active,true) and (j.expires_at is null or j.expires_at>=current_date)
      and lower(extensions.unaccent(concat_ws(' ',j.title,j.description,j.company_name,j.location,j.neighborhood,j.work_model,j.employment_type))) like '%'||i.q||'%'
    union all
    select 'neighborhood',n.name,n.name,
      (case when n.kind='locality' then concat('Localidade de ',coalesce(n.parent_neighborhood,'Curitiba')) else 'Bairro de Curitiba' end)::text,
      (case when cardinality(n.aliases)>0 then concat('Também conhecido como: ',array_to_string(n.aliases,', ')) else 'Use este resultado para filtrar a comunidade.' end)::text,
      '/',null::timestamptz,
      (case when lower(extensions.unaccent(n.name))=i.q then 110 when lower(extensions.unaccent(n.name)) like i.q||'%' then 90 else 55 end)::integer
    from public.curitiba_neighborhoods n cross join input i
    where length(i.q)>=2 and lower(extensions.unaccent(concat_ws(' ',n.name,array_to_string(n.aliases,' '),n.parent_neighborhood))) like '%'||i.q||'%'
  )
  select * from results order by score desc, created_at desc nulls last, title asc
  limit least(greatest(coalesce(p_limit,16),1),24);
$function$;
revoke all on function public.global_search(text,integer) from public;
grant execute on function public.global_search(text,integer) to anon,authenticated;

create or replace function private.guard_post_rate_limit()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare recent_hour integer; recent_day integer;
begin
  if new.author_id is not null then
    select count(*)::integer into recent_hour from public.posts where author_id=new.author_id and created_at>=now()-interval '1 hour';
    select count(*)::integer into recent_day from public.posts where author_id=new.author_id and created_at>=now()-interval '24 hours';
    if recent_hour>=8 then raise exception 'Você publicou muitos relatos em pouco tempo. Aguarde um pouco e tente novamente.' using errcode='P0001'; end if;
    if recent_day>=30 then raise exception 'Limite diário de relatos atingido. Tente novamente amanhã.' using errcode='P0001'; end if;
  else
    select count(*)::integer into recent_hour from public.posts where author_id is null and created_at>=now()-interval '1 hour';
    select count(*)::integer into recent_day from public.posts where author_id is null and created_at>=now()-interval '24 hours';
    if recent_hour>=60 then raise exception 'Muitos relatos anônimos foram enviados recentemente. Aguarde alguns minutos.' using errcode='P0001'; end if;
    if recent_day>=300 then raise exception 'O envio anônimo atingiu o limite de segurança de hoje.' using errcode='P0001'; end if;
  end if;
  return new;
end;$function$;

create or replace function private.guard_comment_rate_limit()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare recent_hour integer; recent_day integer;
begin
  if new.author_id is null then return new; end if;
  select count(*)::integer into recent_hour from public.comments where author_id=new.author_id and created_at>=now()-interval '1 hour';
  select count(*)::integer into recent_day from public.comments where author_id=new.author_id and created_at>=now()-interval '24 hours';
  if recent_hour>=30 then raise exception 'Você enviou muitos comentários em pouco tempo. Aguarde alguns minutos.' using errcode='P0001'; end if;
  if recent_day>=120 then raise exception 'Limite diário de comentários atingido. Tente novamente amanhã.' using errcode='P0001'; end if;
  return new;
end;$function$;

create or replace function private.guard_report_rate_limit()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare recent_hour integer; recent_day integer;
begin
  if new.reporter_id is null then return new; end if;
  select count(*)::integer into recent_hour from public.content_reports where reporter_id=new.reporter_id and created_at>=now()-interval '1 hour';
  select count(*)::integer into recent_day from public.content_reports where reporter_id=new.reporter_id and created_at>=now()-interval '24 hours';
  if recent_hour>=15 then raise exception 'Você enviou muitas denúncias em pouco tempo. Aguarde alguns minutos.' using errcode='P0001'; end if;
  if recent_day>=60 then raise exception 'Limite diário de denúncias atingido.' using errcode='P0001'; end if;
  return new;
end;$function$;

revoke all on function private.guard_post_rate_limit() from public,anon,authenticated;
revoke all on function private.guard_comment_rate_limit() from public,anon,authenticated;
revoke all on function private.guard_report_rate_limit() from public,anon,authenticated;
drop trigger if exists trg_guard_post_rate_limit on public.posts;
create trigger trg_guard_post_rate_limit before insert on public.posts for each row execute function private.guard_post_rate_limit();
drop trigger if exists trg_guard_comment_rate_limit on public.comments;
create trigger trg_guard_comment_rate_limit before insert on public.comments for each row execute function private.guard_comment_rate_limit();
drop trigger if exists trg_guard_report_rate_limit on public.content_reports;
create trigger trg_guard_report_rate_limit before insert on public.content_reports for each row execute function private.guard_report_rate_limit();

create unique index if not exists content_reports_unique_pending_post_reporter on public.content_reports(reporter_id,post_id) where status='pending' and reporter_id is not null and post_id is not null;
create unique index if not exists content_reports_unique_pending_comment_reporter on public.content_reports(reporter_id,comment_id) where status='pending' and reporter_id is not null and comment_id is not null;
create unique index if not exists content_reports_unique_pending_event_reporter on public.content_reports(reporter_id,event_id) where status='pending' and reporter_id is not null and event_id is not null;

create table if not exists public.site_analytics_daily(day date not null,path text not null,views bigint not null default 0 check(views>=0),primary key(day,path));
alter table public.site_analytics_daily enable row level security;
revoke all on table public.site_analytics_daily from anon,authenticated;
grant select on table public.site_analytics_daily to authenticated;
drop policy if exists site_analytics_admin_select on public.site_analytics_daily;
create policy site_analytics_admin_select on public.site_analytics_daily for select to authenticated using((select public.is_moderator()));

create or replace function private.track_page_view_internal(p_path text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_path text:=left(coalesce(nullif(trim(p_path),''),'/'),120);
begin
  if v_path !~ '^/' then v_path:='/'||v_path; end if;
  if v_path~'^/post/' then v_path:='/post/:id'; end if;
  if v_path~'^/perfil/' then v_path:='/perfil/:id'; end if;
  if v_path~'^/empresa/' then v_path:='/empresa/:id'; end if;
  insert into public.site_analytics_daily(day,path,views) values((now() at time zone 'America/Sao_Paulo')::date,v_path,1)
  on conflict(day,path) do update set views=public.site_analytics_daily.views+1;
end;$function$;
revoke all on function private.track_page_view_internal(text) from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.track_page_view_internal(text) to anon,authenticated;

create or replace function public.track_page_view(p_path text) returns void language sql security invoker set search_path='' as $function$ select private.track_page_view_internal(p_path); $function$;
revoke all on function public.track_page_view(text) from public;
grant execute on function public.track_page_view(text) to anon,authenticated;

create or replace function public.get_usage_analytics(p_days integer default 30)
returns table(day date,path text,views bigint) language sql stable security invoker set search_path=''
as $function$ select a.day,a.path,a.views from public.site_analytics_daily a where a.day>=current_date-(least(greatest(coalesce(p_days,30),1),90)-1) order by a.day desc,a.views desc,a.path asc; $function$;
revoke all on function public.get_usage_analytics(integer) from public,anon;
grant execute on function public.get_usage_analytics(integer) to authenticated;

create table if not exists public.client_error_logs(
  id bigint generated by default as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid null references public.users(id) on delete set null,
  path text not null default '/', message text not null, stack text null, component_stack text null, user_agent text null
);
create index if not exists client_error_logs_created_at_idx on public.client_error_logs(created_at desc);
alter table public.client_error_logs enable row level security;
revoke all on table public.client_error_logs from anon,authenticated;
grant select on table public.client_error_logs to authenticated;
drop policy if exists client_error_logs_admin_select on public.client_error_logs;
create policy client_error_logs_admin_select on public.client_error_logs for select to authenticated using((select public.is_moderator()));

create or replace function private.log_client_error_internal(p_message text,p_stack text default null,p_component_stack text default null,p_path text default '/',p_user_agent text default null)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=(select auth.uid()); recent_count integer;
begin
  if nullif(trim(coalesce(p_message,'')),'') is null then return; end if;
  if v_user is not null and not exists(select 1 from public.users where id=v_user) then v_user:=null; end if;
  if v_user is null then select count(*)::integer into recent_count from public.client_error_logs where user_id is null and created_at>=now()-interval '1 minute'; if recent_count>=50 then return; end if;
  else select count(*)::integer into recent_count from public.client_error_logs where user_id=v_user and created_at>=now()-interval '1 minute'; if recent_count>=12 then return; end if; end if;
  delete from public.client_error_logs where created_at<now()-interval '90 days';
  insert into public.client_error_logs(user_id,path,message,stack,component_stack,user_agent) values(v_user,left(coalesce(nullif(trim(p_path),''),'/'),180),left(trim(p_message),1000),nullif(left(coalesce(p_stack,''),6000),''),nullif(left(coalesce(p_component_stack,''),6000),''),nullif(left(coalesce(p_user_agent,''),500),''));
end;$function$;
revoke all on function private.log_client_error_internal(text,text,text,text,text) from public;
grant execute on function private.log_client_error_internal(text,text,text,text,text) to anon,authenticated;

create or replace function public.log_client_error(p_message text,p_stack text default null,p_component_stack text default null,p_path text default '/',p_user_agent text default null)
returns void language sql security invoker set search_path='' as $function$ select private.log_client_error_internal(p_message,p_stack,p_component_stack,p_path,p_user_agent); $function$;
revoke all on function public.log_client_error(text,text,text,text,text) from public;
grant execute on function public.log_client_error(text,text,text,text,text) to anon,authenticated;

create or replace function public.get_client_error_logs(p_limit integer default 100)
returns table(id bigint,created_at timestamptz,user_id uuid,user_name text,path text,message text,stack text,component_stack text,user_agent text)
language sql stable security invoker set search_path=''
as $function$
  select e.id,e.created_at,e.user_id,coalesce(u.name::text,'Visitante'),e.path,e.message,e.stack,e.component_stack,e.user_agent
  from public.client_error_logs e left join public.users u on u.id=e.user_id
  order by e.created_at desc limit least(greatest(coalesce(p_limit,100),1),250);
$function$;
revoke all on function public.get_client_error_logs(integer) from public,anon;
grant execute on function public.get_client_error_logs(integer) to authenticated;
