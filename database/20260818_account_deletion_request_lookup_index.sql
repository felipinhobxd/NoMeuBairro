-- A RLS e a exportação da conta filtram por user_id inclusive após o pedido
-- deixar de estar pendente, então precisam de um índice não parcial.

create index if not exists account_deletion_requests_user_requested_idx
  on public.account_deletion_requests (user_id, requested_at desc);
