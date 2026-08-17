-- Ajustes finais do monitoramento após os advisors do Supabase.
create index if not exists client_error_logs_user_id_idx on public.client_error_logs(user_id) where user_id is not null;

create or replace function private.track_page_view_internal(p_path text)
returns void language plpgsql security definer set search_path = ''
as $function$
declare v_path text := left(coalesce(nullif(trim(p_path), ''), '/'), 120);
begin
  if v_path !~ '^/' then v_path := '/' || v_path; end if;
  if v_path ~ '^/post/' then v_path := '/post/:id'; end if;
  if v_path ~ '^/perfil/' then v_path := '/perfil/:id'; end if;
  if v_path ~ '^/empresa/' then v_path := '/empresa/:id'; end if;
  insert into public.site_analytics_daily(day, path, views)
  values ((now() at time zone 'America/Sao_Paulo')::date, v_path, 1)
  on conflict (day, path) do update set views = public.site_analytics_daily.views + 1;
  delete from public.client_error_logs where created_at < now() - interval '90 days';
end;
$function$;
