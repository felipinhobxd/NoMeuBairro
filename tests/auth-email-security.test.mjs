import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('e-mails de autenticação usam somente a origem canônica de produção', async () => {
  const [security, login] = await Promise.all([
    read('src/config/authSecurity.ts'),
    read('src/pages/Login.tsx'),
  ]);

  assert.match(security, /AUTH_EMAIL_REDIRECT_TO = 'https:\/\/nomeubairro\.vercel\.app\/'/);
  assert.doesNotMatch(security, /#\/login/);
  assert.match(login, /emailRedirectTo: AUTH_EMAIL_REDIRECT_TO/);
  assert.match(login, /options: \{ emailRedirectTo: AUTH_EMAIL_REDIRECT_TO \}/);
  assert.match(login, /`\$\{AUTH_EMAIL_REDIRECT_TO\}\?recovery=1`/);
  assert.doesNotMatch(login, /const redirectTo = `\$\{window\.location\.origin\}/);
});
