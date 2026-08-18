create or replace function public.get_neighborhood_weekly_summary(p_area text, p_kind text default 'official')
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_area text := trim(coalesce(p_area, ''));
  v_kind text := coalesce(p_kind, 'official');
  v_result jsonb;
begin
  if char_length(v_area) < 2 or v_kind not in ('official', 'locality') then
    return jsonb_build_object('area', v_area, 'newReports', 0, 'previousReports', 0, 'resolvedReports', 0, 'upcomingEvents', 0, 'newJobs', 0, 'topCategory', null, 'topCategoryCount', 0, 'updatedAt', now());
  end if;

  with recent_posts as (
    select p.id, p.category from public.posts p
    where p.is_anonymous is false and p.created_at >= now() - interval '7 days'
      and ((v_kind = 'official' and p.neighborhood = v_area) or (v_kind = 'locality' and p.locality = v_area))
  ), previous_posts as (
    select p.id from public.posts p
    where p.is_anonymous is false and p.created_at >= now() - interval '14 days' and p.created_at < now() - interval '7 days'
      and ((v_kind = 'official' and p.neighborhood = v_area) or (v_kind = 'locality' and p.locality = v_area))
  ), resolved_posts as (
    select distinct p.id from public.post_status_history h join public.posts p on p.id = h.post_id
    where h.new_status = 'resolved'::public.post_status and h.changed_at >= now() - interval '7 days' and p.is_anonymous is false
      and ((v_kind = 'official' and p.neighborhood = v_area) or (v_kind = 'locality' and p.locality = v_area))
  ), upcoming_events as (
    select e.id from public.events e
    where e.event_date >= current_date and e.event_date <= current_date + 7
      and ((v_kind = 'official' and e.neighborhood = v_area) or (v_kind = 'locality' and e.locality = v_area))
  ), new_jobs as (
    select j.id from public.job_posts j
    where j.is_active is true and j.created_at >= now() - interval '7 days' and (j.expires_at is null or j.expires_at >= current_date)
      and ((v_kind = 'official' and j.neighborhood = v_area) or (v_kind = 'locality' and j.locality = v_area))
  ), top_category as (
    select rp.category, count(*)::int as amount from recent_posts rp group by rp.category order by count(*) desc, rp.category limit 1
  )
  select jsonb_build_object(
    'area', v_area,
    'newReports', (select count(*) from recent_posts),
    'previousReports', (select count(*) from previous_posts),
    'resolvedReports', (select count(*) from resolved_posts),
    'upcomingEvents', (select count(*) from upcoming_events),
    'newJobs', (select count(*) from new_jobs),
    'topCategory', (select category::text from top_category),
    'topCategoryCount', coalesce((select amount from top_category), 0),
    'updatedAt', now()
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_neighborhood_weekly_summary(text, text) from public;
grant execute on function public.get_neighborhood_weekly_summary(text, text) to anon, authenticated;
