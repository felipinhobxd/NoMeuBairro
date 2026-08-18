-- Reduce externally executable SECURITY DEFINER surface.
-- Weekly summary reads only sources already intended for public aggregate display.
alter function public.get_neighborhood_weekly_summary(text, text) security invoker;

-- Browsers receive the VAPID public key from the frontend bundle. The private
-- VAPID key and dispatcher token remain encrypted in Vault and available only
-- through the service-role-only get_push_server_config RPC.
revoke all on function public.get_push_public_key() from public, anon, authenticated;
drop function if exists public.get_push_public_key();
