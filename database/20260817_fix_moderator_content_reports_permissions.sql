-- Corrige a moderação de denúncias pelo cliente autenticado.
--
-- A tabela content_reports já possui RLS que restringe UPDATE a contas com
-- papel moderator/admin. Porém, o papel PostgreSQL `authenticated` não tinha
-- o privilégio de tabela UPDATE, então o PostgreSQL bloqueava a operação antes
-- mesmo da policy ser avaliada, retornando:
--   permission denied for table content_reports
--
-- Mantemos a autorização na RLS e concedemos apenas o privilégio necessário
-- para que a função SECURITY INVOKER moderate_content_report possa atualizar
-- o histórico/status da denúncia.

grant update on table public.content_reports to authenticated;
