-- Keep moderation functional while removing broad table-wide UPDATE.
revoke update on table public.content_reports from authenticated;

grant update (
  status,
  archived_title,
  archived_description,
  archived_image_url,
  archived_author_name,
  archived_content_type,
  archived_at,
  archived_by,
  post_id,
  comment_id,
  event_id
) on public.content_reports to authenticated;
