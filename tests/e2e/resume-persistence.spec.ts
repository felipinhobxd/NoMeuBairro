import { expect, test, type Page } from '@playwright/test';

const residentId = '11111111-2222-4333-8444-555555555555';
const residentEmail = 'resident@example.test';
const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0yMjIyLTQzMzMtODQ0NC01NTU1NTU1NTU1NTUiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImV4cCI6NDEwMjQ0NDgwMCwiYXVkIjoiYXV0aGVudGljYXRlZCIsImVtYWlsIjoicmVzaWRlbnRAZXhhbXBsZS50ZXN0In0.test';

function authUser() {
  const now = '2026-09-07T21:00:00.000Z';
  return {
    id: residentId,
    aud: 'authenticated',
    role: 'authenticated',
    email: residentEmail,
    email_confirmed_at: now,
    phone: '',
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { name: 'Morador E2E', account_type: 'resident' },
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  };
}

async function prepareAuthenticatedResident(page: Page) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('nmb-font-size-v1', 'medium');
    localStorage.setItem('anb-cookie-consent', 'essential');
    localStorage.setItem('nmb-onboarding-v6', 'done');
    localStorage.setItem('nmb-pwa-install-dismissed-at', String(Date.now()));
    localStorage.setItem('sb-127-auth-token', JSON.stringify({
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 4102444800,
      refresh_token: 'e2e-refresh-token',
      user,
    }));
  }, { token: accessToken, user: authUser() });
}

test('currículo é criado, persiste após reload e pode ser reaberto', async ({ page }) => {
  let storedResume: Record<string, unknown> | null = null;
  const user = authUser();
  const profile = {
    id: residentId,
    name: 'Morador E2E',
    avatar_url: null,
    reputation: 0,
    created_at: '2026-09-07T21:00:00.000Z',
  };

  await page.route('**/supabase-mock/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const accept = request.headers().accept || '';
    const single = accept.includes('vnd.pgrst.object+json');

    const fulfill = async (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body),
    });

    if (path.includes('/auth/v1/user')) {
      await fulfill(user);
      return;
    }
    if (path.endsWith('/rest/v1/users')) {
      await fulfill(single ? profile : [profile]);
      return;
    }
    if (path.endsWith('/rest/v1/app_roles')) {
      await fulfill(single ? { role: null } : [{ role: null }]);
      return;
    }
    if (path.endsWith('/rest/v1/user_resumes')) {
      if (request.method() === 'POST') {
        const payload = request.postDataJSON() as Record<string, unknown>;
        storedResume = {
          ...payload,
          created_at: '2026-09-07T21:05:00.000Z',
          updated_at: '2026-09-07T21:05:00.000Z',
        };
        await fulfill(storedResume, 201);
        return;
      }
      await fulfill(single ? storedResume : (storedResume ? [storedResume] : []));
      return;
    }
    if (path.endsWith('/rest/v1/public_job_posts') || path.endsWith('/rest/v1/job_applications')) {
      await fulfill([]);
      return;
    }

    await fulfill(single ? null : []);
  });

  await prepareAuthenticatedResident(page);
  await page.goto('/#/empregos');

  await expect(page.getByRole('heading', { name: 'Empregos' })).toBeVisible();
  const createResume = page.getByRole('button', { name: 'Criar currículo' });
  await expect(createResume).toBeVisible();
  await createResume.click();

  const dialog = page.getByRole('dialog', { name: 'Meu currículo' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('E-mail').fill(residentEmail);
  await dialog.getByLabel('Telefone / WhatsApp').fill('(41) 99999-1111');
  await dialog.getByLabel('Bairro').fill('Centro');
  await dialog.getByLabel('Objetivo profissional').fill('Atendimento ao cliente');
  await dialog.getByLabel('Experiência').fill('Experiência demonstrativa');
  await dialog.getByLabel('Formação').fill('Ensino médio completo');
  await dialog.getByLabel('Habilidades').fill('Atendimento, Excel');
  await dialog.getByRole('button', { name: 'Salvar currículo' }).click();

  await expect(page.getByText('Currículo salvo com sucesso.')).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(storedResume).toMatchObject({
    user_id: residentId,
    email: residentEmail,
    phone: '(41) 99999-1111',
    neighborhood: 'Centro',
    objective: 'Atendimento ao cliente',
    experience: 'Experiência demonstrativa',
    education: 'Ensino médio completo',
    skills: 'Atendimento, Excel',
  });

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Empregos' })).toBeVisible();
  const editResume = page.getByRole('button', { name: 'Editar currículo' });
  await expect(editResume).toBeVisible();
  await editResume.click();

  const reopened = page.getByRole('dialog', { name: 'Meu currículo' });
  await expect(reopened.getByLabel('E-mail')).toHaveValue(residentEmail);
  await expect(reopened.getByLabel('Telefone / WhatsApp')).toHaveValue('(41) 99999-1111');
  await expect(reopened.getByLabel('Bairro')).toHaveValue('Centro');
  await expect(reopened.getByLabel('Objetivo profissional')).toHaveValue('Atendimento ao cliente');
  await expect(reopened.getByLabel('Experiência')).toHaveValue('Experiência demonstrativa');
  await expect(reopened.getByLabel('Formação')).toHaveValue('Ensino médio completo');
  await expect(reopened.getByLabel('Habilidades')).toHaveValue('Atendimento, Excel');
});
