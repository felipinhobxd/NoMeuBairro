-- Fix writes to posts/events/jobs after helper RPC hardening.
--
-- The locality trigger previously ran as the caller and invoked
-- best_curitiba_locality(), whose EXECUTE privilege was intentionally revoked
-- from browser roles. That made authenticated inserts fail with
-- "permission denied for function best_curitiba_locality".
--
-- Keep the helper functions private to browser roles, but let the trigger run
-- with its owner privileges and a locked search_path.

create or replace function public.apply_nearest_curitiba_locality()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.locality := public.best_curitiba_locality(
    new.latitude::double precision,
    new.longitude::double precision,
    new.location::text
  );
  return new;
end;
$$;

revoke all on function public.apply_nearest_curitiba_locality()
  from public, anon, authenticated;

grant execute on function public.apply_nearest_curitiba_locality()
  to service_role;
