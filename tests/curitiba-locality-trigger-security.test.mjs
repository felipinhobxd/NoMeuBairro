import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('trigger de localidade usa privilégios do owner sem reabrir RPC interno ao browser', async () => {
  const migration = await read('supabase/migrations/20260907180750_fix_curitiba_locality_trigger_permissions_20260907.sql');

  assert.match(migration, /create or replace function public\.apply_nearest_curitiba_locality\(\)/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /public\.best_curitiba_locality\(/i);
  assert.match(migration, /revoke all on function public\.apply_nearest_curitiba_locality\(\)[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.apply_nearest_curitiba_locality\(\)[\s\S]*to service_role/i);
  assert.doesNotMatch(migration, /grant execute on function public\.best_curitiba_locality[\s\S]*authenticated/i);
});
