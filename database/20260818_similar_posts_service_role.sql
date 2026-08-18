-- A Edge Function de denúncias anônimas usa o RPC com service_role para
-- verificar duplicados antes de enviar a imagem ao Storage.

grant execute on function public.find_similar_posts(
  public.post_category, double precision, double precision, integer, integer
) to service_role;
