# Auditoria do novo ambiente Supabase — 2026-09-07

Projeto auditado: `gowuvofidacpdavdkpar`.

Este arquivo registra somente constatações técnicas e não contém segredos.

## Estado de referência

- Branch principal no início da auditoria: `3f5179737ef39012656041a0c868531f68df1654`.
- Auth do novo Supabase estava vazio (`auth.users = 0`).
- Storage do novo Supabase estava vazio.
- Buckets `avatars` e `post-images`: públicos, limite de 3 MiB, MIME JPEG/PNG/WebP.
- As policies de escrita do Storage restringiam o caminho à pasta do próprio `auth.uid()`.
- Nenhuma Edge Function estava implantada no novo projeto no momento do inventário.
- O Vault novo não continha VAPID/dispatch secrets no momento do inventário.

## Riscos confirmados antes das correções

- `public.get_push_server_config()` era `SECURITY DEFINER` e estava executável por `anon` e `authenticated`, apesar de retornar VAPID private key e dispatch token.
- `public.users` tinha leitura pública por RLS e continha `email`; grants de tabela permitiam solicitar a coluna diretamente pela Data API.
- `public.public_company_profiles` recebia automaticamente `email`, `phone`, `whatsapp` e `address` de `company_profiles`; o signup empresarial preenchia `company_profiles.email` com o e-mail de login.
- `user_resumes` e `job_applications` tinham grants SQL muito mais amplos do que o frontend necessita, incluindo privilégios como `TRUNCATE`, `REFERENCES` e `TRIGGER`.
- `private.legacy_post_images` tinha grants de leitura de browser e pode armazenar payloads base64.
- Várias funções de trigger `SECURITY DEFINER` estavam executáveis diretamente por roles de browser.
- `supabase_realtime` publicava 9 tabelas, mas o frontend atual assina apenas `posts` e `notifications`.
- O script histórico de Web Push ainda apontava para o projeto Supabase antigo.

## Decisões de hardening preparadas

- Grants mínimos por tabela/coluna, mantendo RLS como autorização por linha.
- `app_roles` somente leitura para authenticated e sem escrita pelo cliente.
- `get_push_server_config()` somente `service_role`.
- Funções de trigger deixam de ser RPCs de browser.
- Contatos de empresa passam a ser privados por padrão e sincronizados à projeção pública somente por flags explícitas.
- Currículos e candidaturas ficam sem acesso anônimo e sem privilégios DDL-like.
- Novas imagens base64 ficam proibidas em `posts`; compatibilidade antiga permanece isolada.
- Realtime mantém apenas `posts` e `notifications`.

## Pendências que exigem a conexão Supabase/Vercel ativa para concluir

- Aplicar o hardening no banco e gravar a versão real em `supabase/migrations/`.
- Validar grants e policies como `anon`/`authenticated` após a migration.
- Configurar VAPID/dispatch no Vault e implantar `send-push` + `anonymous-post-control`.
- Adicionar quota de quantidade de objetos no Storage e validar uploads.
- Rodar novamente Security Advisor e Performance Advisor.
- Conferir/configurar as variáveis Vite no Vercel e fazer redeploy.
- Executar testes finais de signup/login/perfil/relato/comentário/apoio/notificações/empregos/currículo/Storage/Realtime/logout.

O Supabase antigo não foi alterado.
