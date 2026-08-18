-- A solicitação precisa sobreviver à exclusão do usuário no Auth para que o
-- administrador consiga encerrá-la depois da remoção real da conta.
-- O registro preserva apenas o UUID técnico; e-mail não é armazenado nesta fila.

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_user_id_fkey;

comment on column public.account_deletion_requests.user_id is
  'UUID técnico do solicitante, mantido para concluir a revisão após a exclusão da conta; não armazena e-mail.';
