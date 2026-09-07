import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('eventos e vagas têm limites server-side com consultas indexadas', async () => {
  const migration = await read('supabase/migrations/20260907185945_production_abuse_limits_events_jobs_push_analytics_20260907.sql');
  assert.match(migration, /events_created_by_created_at_idx/);
  assert.match(migration, /job_posts_company_created_at_idx/);
  assert.match(migration, /guard_event_rate_limit/);
  assert.match(migration, /recent_hour >= 20/);
  assert.match(migration, /recent_day >= 100/);
  assert.match(migration, /guard_job_post_rate_limit/);
  assert.match(migration, /revoke all on function private\.guard_event_rate_limit\(\) from public, anon, authenticated/);
  assert.match(migration, /revoke all on function private\.guard_job_post_rate_limit\(\) from public, anon, authenticated/);
});

test('push limita fan-out por usuário sem permitir apropriar endpoint alheio', async () => {
  const migration = await read('supabase/migrations/20260907185945_production_abuse_limits_events_jobs_push_analytics_20260907.sql');
  assert.match(migration, /v_total >= 10/);
  assert.match(migration, /push subscription limit reached/);
  assert.match(migration, /push endpoint belongs to another account/);
  assert.match(migration, /pg_advisory_xact_lock/);
});

test('analytics público tem orçamento global e não bloqueia a navegação', async () => {
  const migration = await read('supabase/migrations/20260907185945_production_abuse_limits_events_jobs_push_analytics_20260907.sql');
  assert.match(migration, /private\.site_analytics_budget/);
  assert.match(migration, /pg_try_advisory_xact_lock/);
  assert.match(migration, /daily_samples >= 50000/);
  assert.match(migration, /minute_samples >= 600/);
});

test('moderação usa somente as colunas necessárias, sem UPDATE amplo da tabela', async () => {
  const migration = await read('supabase/migrations/20260907190250_narrow_moderation_report_update_columns_20260907.sql');
  assert.match(migration, /revoke update on table public\.content_reports from authenticated/);
  assert.match(migration, /grant update \(/);
  assert.match(migration, /status,/);
  assert.match(migration, /post_id,/);
  assert.match(migration, /comment_id,/);
  assert.match(migration, /event_id/);
  assert.doesNotMatch(migration, /grant update on table public\.content_reports to authenticated/);
});
