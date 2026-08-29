alter table public.posts
  add column if not exists image_thumbnail_url text;

comment on column public.posts.image_thumbnail_url is
  'Public URL of the pre-generated lightweight thumbnail for list and map views.';

alter table public.posts
  drop constraint if exists posts_image_thumbnail_url_length;

alter table public.posts
  add constraint posts_image_thumbnail_url_length
  check (image_thumbnail_url is null or char_length(image_thumbnail_url) <= 2048);
