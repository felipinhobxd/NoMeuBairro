import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Tenho interesse exige morador, currículo completo e vaga disponível', async () => {
  const migration = await read('supabase/migrations/20260907223824_fix_job_application_resume_policy_recursion_20260907.sql');

  assert.match(migration, /create or replace function public\.current_user_has_complete_resume\(\)/i);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /grant execute on function public\.current_user_has_complete_resume\(\) to authenticated/i);
  assert.match(migration, /status = 'interested'/i);
  assert.match(migration, /account_type = 'resident'/i);
  assert.match(migration, /public\.current_user_has_complete_resume\(\)/i);
  assert.match(migration, /from public\.public_job_posts p/i);
  assert.match(migration, /p\.is_active = true/i);
  assert.match(migration, /p\.expires_at is null or p\.expires_at >=/i);
});

test('retirada preserva histórico e revoga acesso ativo da empresa', async () => {
  const migration = await read('supabase/migrations/20260907224314_finalize_job_application_integrity_20260907.sql');

  assert.match(migration, /revoke delete on table public\.job_applications from authenticated/i);
  assert.match(migration, /drop policy if exists job_applications_owner_delete/i);
  assert.match(migration, /user_resumes_owner_delete[\s\S]*not exists[\s\S]*public\.job_applications[\s\S]*status <> 'withdrawn'/i);
  assert.match(migration, /new\.status = 'withdrawn'[\s\S]*delete from public\.notifications[\s\S]*type = 'job_interest'/i);
  assert.match(migration, /set search_path = ''/i);
});

test('currículo não pode ser esvaziado pelo cliente', async () => {
  const migration = await read('supabase/migrations/20260907224314_finalize_job_application_integrity_20260907.sql');

  assert.match(migration, /user_resumes_owner_insert[\s\S]*coalesce\(email, ''\)[\s\S]*coalesce\(phone, ''\)/i);
  assert.match(migration, /user_resumes_owner_update[\s\S]*coalesce\(objective, ''\)[\s\S]*coalesce\(experience, ''\)[\s\S]*coalesce\(education, ''\)[\s\S]*coalesce\(skills, ''\)/i);
});

test('frontend retira interesse por status e empresa abre a vaga da notificação', async () => {
  const [jobsPage, companyPage, notificationActivity] = await Promise.all([
    read('src/pages/Empregos.tsx'),
    read('src/pages/CompanyDashboard.tsx'),
    read('src/utils/notificationActivity.ts'),
  ]);

  assert.match(jobsPage, /update\(\{\s*status:\s*'withdrawn'\s*\}\)/i);
  assert.doesNotMatch(jobsPage, /from\('job_applications'\)\.delete\(/i);
  assert.match(notificationActivity, /sessionStorage\.setItem\('anb-company-focus-job',\s*notification\.jobId\)/i);
  assert.match(companyPage, /sessionStorage\.getItem\('anb-company-focus-job'\)/i);
  assert.match(companyPage, /applications\.some\(\(application\) => application\.job_id === focusedJobId\)/i);
  assert.match(companyPage, /setSelectedJobId\(focusedJobId\)/i);
});
