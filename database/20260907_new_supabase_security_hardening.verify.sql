-- Read-only verification queries for 20260907_new_supabase_security_hardening.sql.
-- Run after the hardening migration is applied to project gowuvofidacpdavdkpar.

select
  has_column_privilege('anon', 'public.users', 'email', 'SELECT') as anon_can_read_user_email,
  has_column_privilege('authenticated', 'public.users', 'email', 'SELECT') as authenticated_can_read_user_email,
  has_column_privilege('authenticated', 'public.users', 'account_type', 'UPDATE') as authenticated_can_update_account_type,
  has_column_privilege('authenticated', 'public.users', 'reputation', 'UPDATE') as authenticated_can_update_reputation;

select
  has_table_privilege('anon', 'public.user_resumes', 'SELECT') as anon_can_read_resumes,
  has_table_privilege('anon', 'public.job_applications', 'SELECT') as anon_can_read_applications,
  has_table_privilege('anon', 'public.push_subscriptions', 'SELECT') as anon_can_read_push_subscriptions,
  has_table_privilege('authenticated', 'public.user_resumes', 'TRUNCATE') as authenticated_can_truncate_resumes,
  has_table_privilege('authenticated', 'public.job_applications', 'TRUNCATE') as authenticated_can_truncate_applications;

select
  has_function_privilege('anon', 'public.get_push_server_config()', 'EXECUTE') as anon_can_get_push_server_config,
  has_function_privilege('authenticated', 'public.get_push_server_config()', 'EXECUTE') as authenticated_can_get_push_server_config,
  has_function_privilege('service_role', 'public.get_push_server_config()', 'EXECUTE') as service_role_can_get_push_server_config;

select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by schemaname, tablename;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('avatars', 'post-images')
order by id;

select count(*) as auth_users from auth.users;
