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
- `supabase_realtime` publicava 9 tabelas, embora o frontend atual use Realtime apenas para `posts` e `notifications`.
- O script histórico de Web Push ainda apontava para o projeto Supabase antigo.

## Hardening aplicado

- Grants mínimos por tabela/coluna, mantendo RLS como autorização por linha.
- `app_roles` somente leitura para `authenticated` e sem escrita pelo cliente.
- `get_push_server_config()` restrito ao fluxo server-side/service role.
- Funções de trigger deixaram de ser RPCs de browser.
- Contatos de empresa passaram a ser privados por padrão e só entram na projeção pública por flags explícitas.
- Currículos e candidaturas ficaram sem acesso anônimo e sem privilégios SQL desnecessários.
- Novas imagens base64 em `posts` foram bloqueadas; compatibilidade antiga permaneceu isolada.
- Realtime foi reduzido a `posts` e `notifications`, que são as tabelas assinadas pelo frontend atual.
- Rate limits server-side foram adicionados para relatos, comentários, denúncias, eventos, vagas, geocoding, uploads, Push e analytics.
- Storage recebeu quotas e validações de tamanho/MIME/ownership.
- As migrations aplicadas ao novo projeto estão versionadas em `supabase/migrations/` até `20260907190250`.

## Estado após aplicação

- Grants, RLS e funções sensíveis foram validados no novo Supabase.
- `send-push` e `anonymous-post-control` ficaram ativas no novo projeto.
- VAPID/private dispatch/rate-limit secrets permanecem fora do repositório e no armazenamento server-side apropriado.
- Security Advisor e Performance Advisor foram revisados após as migrations finais.
- Auth passou a ter usuários confirmados durante a validação real do fluxo.
- Testes transacionais de publicação, moderação, limites e Push foram executados com rollback/limpeza.
- O banco e o Storage permaneceram pequenos, sem sinal de crescimento anormal.

## Pendências externas que não mudam o estado aplicado do banco

- A conexão Vercel disponível ao ChatGPT ainda não permite auditar deployments/envs diretamente; isso é uma limitação de acesso da integração, não uma migration pendente.
- A entrega Push ainda precisa ser exercitada em um navegador/dispositivo real quando houver uma subscription registrada.

O Supabase antigo não foi alterado.
