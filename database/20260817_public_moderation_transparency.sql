create or replace function public.get_public_moderation_transparency()
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $$
  with recent as (
    select * from public.content_reports where created_at >= now() - interval '30 days'
  ), handled as (
    select * from public.content_reports
    where status in ('resolved','ignored') and archived_at is not null and archived_at >= now() - interval '30 days'
  )
  select jsonb_build_object(
    'periodDays', 30,
    'reportsReceived', (select count(*) from recent),
    'pendingNow', (select count(*) from public.content_reports where status = 'pending'),
    'handled', (select count(*) from handled),
    'removed', (select count(*) from handled where status = 'resolved'),
    'kept', (select count(*) from handled where status = 'ignored'),
    'averageResponseHours', coalesce((select round(avg(extract(epoch from (archived_at - created_at)) / 3600.0)::numeric, 1) from handled where archived_at >= created_at), 0),
    'updatedAt', now()
  );
$$;
revoke all on function public.get_public_moderation_transparency() from public;
grant execute on function public.get_public_moderation_transparency() to anon, authenticated;
