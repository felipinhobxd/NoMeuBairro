create or replace function public.get_community_contribution_summary(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $$
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
$$;
revoke all on function public.get_community_contribution_summary(uuid) from public;
grant execute on function public.get_community_contribution_summary(uuid) to anon, authenticated;
