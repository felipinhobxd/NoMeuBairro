alter table public.job_posts drop constraint if exists job_posts_location_precision_check;
alter table public.job_posts
  add constraint job_posts_location_precision_check
  check (location_precision is null or location_precision = any (array['exact'::text, 'reverse'::text, 'neighborhood'::text]));

alter table public.public_job_posts drop constraint if exists public_job_posts_location_precision_check;
alter table public.public_job_posts
  add constraint public_job_posts_location_precision_check
  check (location_precision is null or location_precision = any (array['exact'::text, 'reverse'::text, 'neighborhood'::text]));
