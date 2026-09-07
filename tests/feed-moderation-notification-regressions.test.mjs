import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('feed mostra contadores diretamente sobre apoio e comentários', async () => {
  const actions = await read('src/components/FeedPostActions.tsx');

  assert.match(actions, /compactCount\(props\.supports\)/);
  assert.match(actions, /compactCount\(props\.commentsCount\)/);
  assert.match(actions, /Apoiar — \$\{props\.supports\}/);
  assert.match(actions, /Comentar — \$\{props\.commentsCount\}/);
  assert.match(actions, /absolute -right-3 -top-2/);
});

test('moderação mantém UPDATE da tabela protegido por RLS para o RPC invoker', async () => {
  const migration = await read('supabase/migrations/20260907183856_restore_moderation_report_update_permission_20260907.sql');
  assert.match(migration, /grant update on table public\.content_reports to authenticated;/i);
});

test('notificações continuam carregadas e sincronizadas por Realtime', async () => {
  const data = await read('src/contexts/DataContext.tsx');

  assert.match(data, /from\('notifications'\)\.select\(NOTIFICATION_SELECT\)/);
  assert.match(data, /table: 'notifications', filter: `user_id=eq\.\$\{user\.id\}`/);
  assert.match(data, /update\(\{ is_read: true \}\)/);
});
