-- Auditoria de segurança de 17/08/2026.
-- Registra no repositório os endurecimentos já aplicados no Supabase de produção.
-- As policies continuam sendo a camada de autorização por linha; os GRANTs abaixo
-- reduzem a superfície da Data API e impedem clientes de alterar campos internos.

-- 1) Não expor e-mail de moradores pela tabela base users.
revoke select on table public.users from anon, authenticated;

grant select (id, name, avatar_url, reputation, created_at)
on table public.users to anon;

grant select (id, name, avatar_url, reputation, created_at, updated_at, account_type)
on table public.users to authenticated;

-- Fila de moderação não deve sequer ser executável anonimamente.
revoke execute on function public.get_moderation_queue(integer) from public, anon;
grant execute on function public.get_moderation_queue(integer) to authenticated;

-- 2) Objetos novos criados pelo papel postgres não recebem privilégios públicos
-- automaticamente. Cada nova tabela/função deve declarar os acessos necessários.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- 3) Posts anônimos somente pela Edge Function com token privado de controle.
drop policy if exists posts_insert on public.posts;
create policy posts_insert
on public.posts
for insert
to authenticated
with check (
  is_anonymous = false
  and author_id = (select auth.uid())
);

revoke insert on table public.posts from anon, authenticated;
grant insert (
  author_id, category, title, description, image_url, location, latitude, longitude,
  neighborhood, locality, location_precision, is_anonymous
) on table public.posts to authenticated;

-- O cliente só altera o status do próprio relato. Contadores, autoria e timestamps
-- ficam sob controle do banco/triggers.
revoke update on table public.posts from authenticated;
grant update (status) on table public.posts to authenticated;

-- 4) Denúncias de conteúdo sempre pertencem ao usuário autenticado, começam
-- pendentes e apontam para exatamente um conteúdo.
drop policy if exists reports_insert on public.content_reports;
create policy reports_insert
on public.content_reports
for insert
to authenticated
with check (
  reporter_id = (select auth.uid())
  and status = 'pending'
  and archived_title is null
  and archived_description is null
  and archived_image_url is null
  and archived_author_name is null
  and archived_content_type is null
  and archived_at is null
  and archived_by is null
  and num_nonnulls(post_id, comment_id, event_id) = 1
);

revoke insert on table public.content_reports from anon, authenticated;
grant insert (reporter_id, post_id, comment_id, event_id, reason)
on table public.content_reports to authenticated;

alter table public.content_reports
  drop constraint if exists content_reports_reason_length_check,
  add constraint content_reports_reason_length_check
    check (char_length(trim(reason)) between 1 and 1500);

-- 5) Impedir clientes de forjar ids e timestamps em interações comunitárias.
revoke insert on table public.comments from authenticated;
grant insert (post_id, author_id, parent_id, content) on table public.comments to authenticated;

revoke insert on table public.events from authenticated;
grant insert (
  title, description, event_date, location, latitude, longitude, type, created_by,
  neighborhood, locality, location_precision
) on table public.events to authenticated;

revoke insert on table public.post_supports from authenticated;
grant insert (user_id, post_id) on table public.post_supports to authenticated;

revoke insert on table public.event_attendance from authenticated;
grant insert (event_id, user_id) on table public.event_attendance to authenticated;

-- 6) Candidaturas: candidato/empresa podem mudar somente o status após a criação.
revoke insert on table public.job_applications from authenticated;
grant insert (job_id, user_id, status) on table public.job_applications to authenticated;
revoke update on table public.job_applications from authenticated;
grant update (status) on table public.job_applications to authenticated;

-- Notificações são geradas pelo banco; o destinatário só marca leitura.
revoke update on table public.notifications from authenticated;
grant update (is_read) on table public.notifications to authenticated;

-- 7) Vagas: impedir alteração de id/timestamps diretamente pelo cliente.
revoke insert on table public.job_posts from authenticated;
grant insert (
  company_id, title, description, requirements, benefits, salary_min, salary_max,
  employment_type, work_model, location, neighborhood, locality, latitude, longitude,
  location_precision, contact_email, contact_whatsapp, contact_email_enabled,
  contact_whatsapp_enabled, is_active, expires_at
) on table public.job_posts to authenticated;

revoke update on table public.job_posts from authenticated;
grant update (
  company_id, title, description, requirements, benefits, salary_min, salary_max,
  employment_type, work_model, location, neighborhood, locality, latitude, longitude,
  location_precision, contact_email, contact_whatsapp, contact_email_enabled,
  contact_whatsapp_enabled, is_active, expires_at
) on table public.job_posts to authenticated;

-- Perfil empresarial: somente campos editáveis da empresa.
revoke update on table public.company_profiles from authenticated;
grant update (
  company_name, description, logo_url, email, phone, whatsapp, website, address, neighborhood
) on table public.company_profiles to authenticated;
