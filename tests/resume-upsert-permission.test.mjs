import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('currículo mantém upsert compatível com grants mínimos e RLS', async () => {
  const [jobsPage, migration] = await Promise.all([
    read('src/pages/Empregos.tsx'),
    read('supabase/migrations/20260907220800_fix_user_resume_upsert_permission_20260907.sql'),
  ]);

  assert.match(jobsPage, /user_id:\s*user\.id/i);
  assert.match(jobsPage, /from\('user_resumes'\)\.upsert\(payload,\s*\{\s*onConflict:\s*'user_id'\s*\}\)/i);
  assert.match(migration, /grant\s+update\s*\(\s*user_id\s*\)\s+on\s+table\s+public\.user_resumes\s+to\s+authenticated/i);
  assert.doesNotMatch(migration, /grant\s+update\s+on\s+table\s+public\.user_resumes/i);
});
