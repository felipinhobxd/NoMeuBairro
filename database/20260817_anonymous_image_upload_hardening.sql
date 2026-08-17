-- As imagens de denúncias anônimas agora são validadas e enviadas pela Edge Function
-- anonymous-post-control. Visitantes não devem poder usar o bucket diretamente.

drop policy if exists "Anonymous report image insert" on storage.objects;
drop policy if exists "Authenticated anonymous report image insert" on storage.objects;
