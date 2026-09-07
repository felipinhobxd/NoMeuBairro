-- NoMeuBairro post-hardening verification for the NEW Supabase only.
-- No private Vault values are returned.

select
  has_column_privilege('anon','public.users','email','SELECT') as anon_can_read_email,
  has_column_privilege('authenticated','public.users','email','SELECT') as authenticated_can_read_email,
  has_column_privilege('authenticated','public.users','reputation','UPDATE') as authenticated_can_update_reputation,
  has_column_privilege('authenticated','public.users','account_type','UPDATE') as authenticated_can_update_account_type,
  has_function_privilege('anon','public.get_push_server_config()','EXECUTE') as anon_can_get_push_server_config,
  has_function_privilege('authenticated','public.get_push_server_config()','EXECUTE') as authenticated_can_get_push_server_config,
  has_function_privilege('service_role','public.get_push_server_config()','EXECUTE') as service_role_can_get_push_server_config,
  has_schema_privilege('anon','private','USAGE') as anon_can_use_private,
  has_schema_privilege('authenticated','private','USAGE') as authenticated_can_use_private;

select tablename
from pg_publication_tables
where pubname='supabase_realtime' and schemaname='public'
order by tablename;
